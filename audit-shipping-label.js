/**
 * Read-only audit for messages carrying Purchases/Shipping that are not
 * explained by any of the current shipping/archive rules.
 *
 * This script NEVER modifies Gmail.
 */
import { google } from "googleapis";
import { authorize } from "./auth.js";
import { rules } from "./rules.js";

const LABEL = "Purchases/Shipping";
const PAGE_SIZE = 500;

async function allIds(gmail, query) {
  const ids = [];
  let pageToken;
  do {
    const r = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: PAGE_SIZE,
      pageToken,
    });
    ids.push(...(r.data.messages || []).map(m => m.id));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return ids;
}

async function metadata(gmail, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const rows = await Promise.all(batch.map(async id => {
      const r = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const h = Object.fromEntries((r.data.payload?.headers || []).map(x => [x.name.toLowerCase(), x.value]));
      return { id, from: h.from || "", subject: h.subject || "", date: h.date || "" };
    }));
    out.push(...rows);
  }
  return out;
}

const auth = await authorize();
const gmail = google.gmail({ version: "v1", auth });

const shippingRules = rules.filter(r => r.label === LABEL && r.archive);
if (!shippingRules.length) throw new Error(`No archive rules found for label ${LABEL}`);

const labeledIds = new Set(await allIds(gmail, `label:"${LABEL}" -in:trash -in:spam`));
const explainedIds = new Set();

for (const rule of shippingRules) {
  const ids = await allIds(gmail, `(${rule.query}) -in:trash -in:spam`);
  for (const id of ids) explainedIds.add(id);
  console.log(`${rule.name}: ${ids.length} current match(es)`);
}

const unexplained = [...labeledIds].filter(id => !explainedIds.has(id));

console.log("\nSHIPPING LABEL AUDIT — READ ONLY");
console.log(`Messages carrying ${LABEL}: ${labeledIds.size}`);
console.log(`Explained by current shipping rules: ${[...labeledIds].filter(id => explainedIds.has(id)).length}`);
console.log(`Unexplained labeled messages: ${unexplained.length}`);
console.log("NO MESSAGES CHANGED.");

if (unexplained.length) {
  const rows = await metadata(gmail, unexplained);
  const bySender = new Map();
  for (const row of rows) {
    const key = row.from || "(unknown)";
    if (!bySender.has(key)) bySender.set(key, []);
    bySender.get(key).push(row);
  }

  console.log("\nUNEXPLAINED BY SENDER");
  for (const [sender, items] of [...bySender.entries()].sort((a,b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    console.log(`\n[${items.length}] ${sender}`);
    for (const x of items.slice(0, 8)) console.log(`  - ${x.subject}`);
    if (items.length > 8) console.log(`  ... ${items.length - 8} more`);
  }
}
