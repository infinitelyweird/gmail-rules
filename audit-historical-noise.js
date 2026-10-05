/**
 * V4.28 historical noise audit — READ ONLY.
 *
 * Produces a ranked inventory of historical Gmail cleanup opportunities.
 * This script never changes messages, labels, filters, or thread state.
 */
import { google } from "googleapis";
import { getAuth } from "./auth.js";

const auth = await getAuth();
const gmail = google.gmail({ version: "v1", auth });

const MAX_SENDER_SAMPLE = 1000;
const HEADER_BATCH_SIZE = 10;
const HEADER_BATCH_DELAY_MS = 1200;
const RATE_LIMIT_RETRIES = 6;
const OLD_INBOX_CUTOFF = "2026/01/01";

async function count(query) {
  // Gmail resultSizeEstimate is deliberately approximate. Page through IDs so
  // audit totals are exact without spending message.get quota.
  let total = 0;
  let pageToken;
  do {
    const r = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 500,
      pageToken,
    });
    total += (r.data.messages || []).length;
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return total;
}

async function ids(query, limit = MAX_SENDER_SAMPLE) {
  const out = [];
  let pageToken;
  do {
    const r = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(500, limit - out.length),
      pageToken,
    });
    out.push(...(r.data.messages || []).map(m => m.id));
    pageToken = r.data.nextPageToken;
  } while (pageToken && out.length < limit);
  return out.slice(0, limit);
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimit(error) {
  const reason = error?.response?.data?.error?.errors?.[0]?.reason;
  return error?.response?.status === 429 ||
    (error?.response?.status === 403 && reason === "rateLimitExceeded");
}

async function getMetadata(id) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const h = Object.fromEntries(
        (r.data.payload?.headers || []).map(x => [x.name.toLowerCase(), x.value])
      );
      return {
        id,
        from: h.from || "(unknown)",
        subject: h.subject || "(no subject)",
        date: h.date || "",
      };
    } catch (error) {
      if (!isRateLimit(error) || attempt >= RATE_LIMIT_RETRIES) throw error;
      const waitMs = Math.min(60000, 5000 * (2 ** attempt));
      console.log(`Rate limit reached; waiting ${Math.round(waitMs / 1000)}s before retry...`);
      await sleep(waitMs);
    }
  }
}

async function headers(messageIds) {
  const out = [];
  for (let i = 0; i < messageIds.length; i += HEADER_BATCH_SIZE) {
    const batch = messageIds.slice(i, i + HEADER_BATCH_SIZE);

    // Intentionally small concurrency: Gmail message.get is quota-expensive.
    const rows = await Promise.all(batch.map(id => getMetadata(id)));
    out.push(...rows);

    if (i + HEADER_BATCH_SIZE < messageIds.length) {
      await sleep(HEADER_BATCH_DELAY_MS);
    }
  }
  return out;
}

function senderAddress(from) {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function printCounts(title, rows) {
  console.log("\n" + title);
  for (const [name, value] of rows) {
    console.log(String(value).padStart(7) + "  " + name);
  }
}

console.log("V4.28 HISTORICAL NOISE AUDIT — READ ONLY");

const stateQueries = [
  ["Inbox", "in:inbox -in:trash -in:spam"],
  ["Unread Inbox", "in:inbox is:unread -in:trash -in:spam"],
  ["Old Inbox (before 2026)", `in:inbox before:${OLD_INBOX_CUTOFF} -in:trash -in:spam`],
  ["Promotions", "category:promotions -in:trash -in:spam"],
  ["Social", "category:social -in:trash -in:spam"],
  ["Updates", "category:updates -in:trash -in:spam"],
  ["Forums", "category:forums -in:trash -in:spam"],
];

const stateRows = [];
for (const [name, q] of stateQueries) stateRows.push([name, await count(q)]);
printCounts("MAIL STATE", stateRows);

const labelResponse = await gmail.users.labels.list({ userId: "me" });
const customLabels = (labelResponse.data.labels || [])
  .filter(l => l.type === "user");

// labels.list returns label identities but not reliable message totals. Fetch
// each label resource individually; labels.get includes messagesTotal.
const customLabelCounts = [];
for (const label of customLabels) {
  const detail = await gmail.users.labels.get({ userId: "me", id: label.id });
  customLabelCounts.push([label.name, detail.data.messagesTotal || 0]);
}
customLabelCounts.sort((a, b) => b[1] - a[1]);

printCounts("TOP CUSTOM LABELS", customLabelCounts.slice(0, 30));

const sampleIds = await ids("in:inbox -in:trash -in:spam");
const sample = await headers(sampleIds);
const senders = new Map();
for (const m of sample) {
  const sender = senderAddress(m.from);
  senders.set(sender, (senders.get(sender) || 0) + 1);
}
const senderRows = [...senders.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);

console.log(`\nTOP INBOX SENDERS (sampled up to ${MAX_SENDER_SAMPLE} Inbox messages)`);
for (const [sender, n] of senderRows) {
  console.log(String(n).padStart(7) + "  " + sender);
}

const oldIds = await ids(`in:inbox before:${OLD_INBOX_CUTOFF} -in:trash -in:spam`, 500);
const old = await headers(oldIds);
const oldSenders = new Map();
for (const m of old) {
  const sender = senderAddress(m.from);
  oldSenders.set(sender, (oldSenders.get(sender) || 0) + 1);
}

console.log("\nTOP OLD-INBOX SENDERS (before 2026; sampled up to 500)");
for (const [sender, n] of [...oldSenders.entries()].sort((a,b) => b[1]-a[1]).slice(0,40)) {
  console.log(String(n).padStart(7) + "  " + sender);
}

console.log("\nNO MESSAGES CHANGED.");
