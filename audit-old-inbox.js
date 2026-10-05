/**
 * V4.29 old Inbox evidence audit — READ ONLY.
 *
 * Enumerates every Inbox message before 2026 and groups it by sender, with
 * dates and subjects for classification. Intentionally quota-throttled.
 */
import { google } from "googleapis";
import { getAuth } from "./auth.js";

const auth = await getAuth();
const gmail = google.gmail({ version: "v1", auth });
const QUERY = "in:inbox before:2026/01/01 -in:trash -in:spam";
const BATCH_SIZE = 10;
const DELAY_MS = 1200;
const RETRIES = 6;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function isRateLimit(error) {
  const reason = error?.response?.data?.error?.errors?.[0]?.reason;
  return error?.response?.status === 429 ||
    (error?.response?.status === 403 && reason === "rateLimitExceeded");
}

async function allIds() {
  const out = [];
  let pageToken;
  do {
    const r = await gmail.users.messages.list({
      userId: "me", q: QUERY, maxResults: 500, pageToken,
    });
    out.push(...(r.data.messages || []).map(m => m.id));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return out;
}

async function metadata(id) {
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
        from: h.from || "(unknown)",
        subject: h.subject || "(no subject)",
        date: h.date || "",
      };
    } catch (error) {
      if (!isRateLimit(error) || attempt >= RETRIES) throw error;
      const wait = Math.min(60000, 5000 * (2 ** attempt));
      console.log(`RATE LIMIT: waiting ${Math.round(wait / 1000)}s...`);
      await sleep(wait);
    }
  }
}

function senderAddress(from) {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

console.log("V4.29 OLD INBOX EVIDENCE AUDIT — READ ONLY");
const messageIds = await allIds();
console.log(`Old Inbox messages: ${messageIds.length}`);

const rows = [];
for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
  rows.push(...await Promise.all(messageIds.slice(i, i + BATCH_SIZE).map(metadata)));
  if (i + BATCH_SIZE < messageIds.length) await sleep(DELAY_MS);
}

const groups = new Map();
for (const row of rows) {
  const sender = senderAddress(row.from);
  if (!groups.has(sender)) groups.set(sender, []);
  groups.get(sender).push(row);
}

for (const [sender, messages] of [...groups.entries()].sort((a,b) => b[1].length - a[1].length)) {
  console.log(`\n=== ${sender} (${messages.length}) ===`);
  for (const m of messages) {
    console.log(`${m.date} | ${m.subject.replace(/\s+/g, " ").trim()}`);
  }
}

console.log("\nNO MESSAGES CHANGED.");
