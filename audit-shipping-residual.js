/**
 * V4.23 residual shipping audit — READ ONLY.
 *
 * Lists messages that still carry Purchases/Shipping but are not explained by
 * any current archive rule for that label. No Gmail state is modified.
 */
import { google } from "googleapis";
import { getAuth } from "./auth.js";
import { rules } from "./rules.js";

const LABEL = "Purchases/Shipping";
const PAGE_SIZE = 500;

async function allIds(gmail, query) {
  const ids = [];
  let pageToken;
  do {
    const r = await gmail.users.messages.list({
      userId: "me", q: query, maxResults: PAGE_SIZE, pageToken,
    });
    ids.push(...(r.data.messages || []).map(m => m.id));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return ids;
}

function header(headers, name) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

const auth = await getAuth();
const gmail = google.gmail({ version: "v1", auth });

const shippingRules = rules.filter(r => r.label === LABEL && r.archive);
if (!shippingRules.length) throw new Error(`No archive rules found for label ${LABEL}`);

const labeledIds = new Set(await allIds(gmail, `label:"${LABEL}" -in:trash -in:spam`));
const explainedIds = new Set();

for (const rule of shippingRules) {
  for (const id of await allIds(gmail, `(${rule.query}) -in:trash -in:spam`)) {
    explainedIds.add(id);
  }
}

const residualIds = [...labeledIds].filter(id => !explainedIds.has(id));
const rows = [];

for (const id of residualIds) {
  const r = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["Date", "From", "Subject"],
  });
  const headers = r.data.payload?.headers || [];
  rows.push({
    date: header(headers, "Date"),
    from: header(headers, "From"),
    subject: header(headers, "Subject"),
    internalDate: Number(r.data.internalDate || 0),
  });
}

rows.sort((a, b) => b.internalDate - a.internalDate);

console.log("V4.23 RESIDUAL SHIPPING AUDIT — READ ONLY");
console.log(`Messages carrying ${LABEL}: ${labeledIds.size}`);
console.log(`Explained by current shipping rules: ${[...labeledIds].filter(id => explainedIds.has(id)).length}`);
console.log(`Unexplained labeled messages: ${rows.length}`);
console.log("");
console.log("DATE | FROM | SUBJECT");
console.log("-".repeat(120));

for (const row of rows) {
  console.log(`${row.date} | ${row.from} | ${row.subject}`);
}

console.log("");
console.log("NO MESSAGES CHANGED.");
