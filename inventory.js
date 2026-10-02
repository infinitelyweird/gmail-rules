/**
 * Gmail sender inventory scanner.
 *
 * Goal: sample a large slice of the mailbox so future rules are based on real
 * sender/subject patterns rather than guesses.
 *
 * Design:
 * - Downloads only From + Subject metadata, never bodies/attachments.
 * - Excludes Trash and Spam.
 * - Uses deliberately low concurrency to respect Gmail API query-cost quotas.
 * - Retries rate-limit failures with exponential backoff.
 * - Checkpoints progress so long scans can resume after interruption.
 * - Writes JSON for automation and CSV for convenient human inspection.
 *
 * Common commands:
 *   npm run inventory
 *   npm run inventory:big
 *   node inventory.js --months=24 --max=10000 --concurrency=2 --delay=500
 */
import fs from "node:fs/promises";
import {google} from "googleapis";
import {getAuth} from "./auth.js";

const argv = process.argv.slice(2);
const numericArg = (name, defaultValue) =>
  Number((argv.find((x) => x.startsWith("--" + name + "=")) || "--" + name + "=" + defaultValue).split("=")[1]);

const months = numericArg("months", 12);
const maxMessages = numericArg("max", 5000);

// Keep concurrency conservative. Higher values previously exhausted Gmail's
// per-user Total Query Cost quota.
const concurrency = numericArg("concurrency", 3);
const delayMs = numericArg("delay", 250);

const CHECKPOINT = "inventory-checkpoint.json";
const JSON_OUT = "sender-inventory.json";
const CSV_OUT = "sender-inventory.csv";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gmail = google.gmail({version: "v1", auth: await getAuth()});
const query = "newer_than:" + months + "m -in:trash -in:spam";

/**
 * Retry only quota/rate-limit failures. Other errors are surfaced immediately
 * because retries would usually hide a real code/configuration problem.
 *
 * Backoff starts at 2 seconds, doubles each retry, and caps at 60 seconds.
 */
async function retry(fn, label) {
  let wait = 2000;

  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const msg = error?.response?.data?.error?.message || error?.message || "";
      const reason = error?.response?.data?.error?.errors?.[0]?.reason || "";
      const rateLimited =
        error?.response?.status === 429 ||
        (error?.response?.status === 403 &&
          (reason === "rateLimitExceeded" || /quota|rate limit/i.test(msg)));

      if (!rateLimited || attempt === 8) throw error;

      console.log(
        "  quota pause (" + label + ") — " + Math.round(wait / 1000) +
          "s, retry " + attempt + "/8",
      );
      await sleep(wait);
      wait = Math.min(wait * 2, 60000);
    }
  }
}

/** Collect up to maxMessages IDs using Gmail's 500-message page size. */
async function getIds() {
  let ids = [];
  let pageToken;

  while (ids.length < maxMessages) {
    const response = await retry(
      () =>
        gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: 500,
          pageToken,
        }),
      "message list",
    );

    ids.push(...(response.data.messages || []));
    pageToken = response.data.nextPageToken;
    if (!pageToken) break;

    // Even ID listing is throttled slightly to avoid unnecessary API bursts.
    await sleep(300);
  }

  return ids.slice(0, maxMessages).map((message) => message.id);
}

/*
 * Checkpoint format:
 * {
 *   query, months, max,
 *   done: { messageId: { from, subject }, ... },
 *   startedAt, updatedAt
 * }
 *
 * A checkpoint is reused only when query + max match this run.
 */
let checkpoint = {
  query,
  months,
  max: maxMessages,
  done: {},
  startedAt: new Date().toISOString(),
};

try {
  const previous = JSON.parse(await fs.readFile(CHECKPOINT, "utf8"));
  if (previous.query === query && previous.max === maxMessages) {
    checkpoint = previous;
    console.log(
      "Resuming checkpoint with " +
        Object.keys(checkpoint.done).length +
        " completed messages.",
    );
  }
} catch {
  // Missing checkpoint is normal on a fresh scan.
}

const ids = await getIds();
console.log("Inventory target: " + ids.length + " messages");
console.log("Concurrency: " + concurrency + "; inter-batch delay: " + delayMs + "ms");

/** Fetch only the headers required for sender classification. */
async function fetchOne(id) {
  return retry(async () => {
    const response = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });

    const headers = Object.fromEntries(
      (response.data.payload?.headers || []).map((x) => [
        x.name.toLowerCase(),
        x.value,
      ]),
    );

    return {
      from: headers.from || "(unknown)",
      subject: headers.subject || "",
    };
  }, id.slice(-8));
}

let completed = Object.keys(checkpoint.done).length;

/*
 * Process only a few messages concurrently. Already-checkpointed IDs are
 * skipped, which makes rerunning the same command resumable.
 */
for (let i = 0; i < ids.length; i += concurrency) {
  const batch = ids.slice(i, i + concurrency).filter((id) => !checkpoint.done[id]);

  if (batch.length) {
    const results = await Promise.all(
      batch.map(async (id) => [id, await fetchOne(id)]),
    );

    for (const [id, data] of results) {
      checkpoint.done[id] = data;
      completed++;
    }
  }

  // Persist roughly every 50 completed messages and always at the end.
  if (completed % 50 < concurrency || i + concurrency >= ids.length) {
    checkpoint.updatedAt = new Date().toISOString();
    await fs.writeFile(CHECKPOINT, JSON.stringify(checkpoint));
    console.log(
      "  " + completed + "/" + ids.length + " complete (checkpoint saved)",
    );
  }

  await sleep(delayMs);
}

/*
 * Normalize From headers to email addresses and retain up to eight distinct
 * sample subjects per sender. Eight gives useful classification context without
 * turning the inventory into a copy of the mailbox.
 */
const counts = new Map();
const samples = new Map();

for (const {from, subject} of Object.values(checkpoint.done)) {
  const email = (from.match(/<([^>]+)>/)?.[1] || from).trim().toLowerCase();

  counts.set(email, (counts.get(email) || 0) + 1);

  if (!samples.has(email)) samples.set(email, []);
  if (samples.get(email).length < 8 && !samples.get(email).includes(subject)) {
    samples.get(email).push(subject);
  }
}

const report = [...counts]
  .sort((a, b) => b[1] - a[1])
  .map(([sender, count]) => ({
    sender,
    count,
    sampleSubjects: samples.get(sender),
  }));

const output = {
  query,
  messageCount: ids.length,
  processedCount: Object.keys(checkpoint.done).length,
  generatedAt: new Date().toISOString(),
  senders: report,
};

await fs.writeFile(JSON_OUT, JSON.stringify(output, null, 2));

const csvEscape = (value) => String(value).replaceAll('"', '""');
await fs.writeFile(
  CSV_OUT,
  "count,sender,sample subjects\n" +
    report
      .map(
        (x) =>
          x.count +
          ',"' +
          csvEscape(x.sender) +
          '","' +
          csvEscape(x.sampleSubjects.join(" | ")) +
          '"',
      )
      .join("\n"),
);

console.log(
  "\nDONE — " +
    output.processedCount +
    " messages, " +
    report.length +
    " unique senders.",
);
console.log("Top 30:");
report.slice(0, 30).forEach((x) =>
  console.log(
    String(x.count).padStart(5),
    x.sender,
    "—",
    x.sampleSubjects[0] || "",
  ),
);
console.log(
  "\nWrote " + JSON_OUT + ", " + CSV_OUT + ", and resumable " + CHECKPOINT + ".",
);
