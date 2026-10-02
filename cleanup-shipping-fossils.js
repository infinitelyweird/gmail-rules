/**
 * V4.18 shipping fossil cleanup.
 *
 * Preview-only by default. Execution requires BOTH --apply and --yes.
 * Removes ONLY the Purchases/Shipping label from high-confidence historical
 * false positives that are no longer explained by any current shipping rule.
 */
import { google } from "googleapis";
import { getAuth } from "./auth.js";
import { rules } from "./rules.js";

const LABEL = "Purchases/Shipping";
const PAGE_SIZE = 500;
const execute = process.argv.includes("--apply") && process.argv.includes("--yes");

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



const auth = await getAuth();
const gmail = google.gmail({ version: "v1", auth });
const labels = await gmail.users.labels.list({ userId: "me" });
const label = (labels.data.labels || []).find(x => x.name === LABEL);
if (!label?.id) throw new Error(`Gmail label not found: ${LABEL}`);

const shippingRules = rules.filter(r => r.label === LABEL && r.archive);
if (!shippingRules.length) throw new Error(`No archive rules found for label ${LABEL}`);

const labeledIds = new Set(await allIds(gmail, `label:"${LABEL}" -in:trash -in:spam`));
const explainedIds = new Set();
for (const rule of shippingRules) {
  for (const id of await allIds(gmail, `(${rule.query}) -in:trash -in:spam`)) explainedIds.add(id);
}
const unexplainedSet = new Set([...labeledIds].filter(id => !explainedIds.has(id)));

const candidateIds = new Set();
console.log("V4.18 SHIPPING FOSSIL CLEANUP");
console.log(execute ? "MODE: APPLY" : "MODE: PREVIEW");
for (const [name, query] of fossilCandidateQueries) {
  const ids = await allIds(gmail, `(${query}) label:"${LABEL}" -in:trash -in:spam`);
  const safe = ids.filter(id => unexplainedSet.has(id));
  for (const id of safe) candidateIds.add(id);
  if (safe.length) console.log(`${String(safe.length).padStart(4)}  ${name}`);
}

console.log(`\nMessages carrying ${LABEL}: ${labeledIds.size}`);
console.log(`Explained by current shipping rules: ${[...labeledIds].filter(id => explainedIds.has(id)).length}`);
console.log(`Unexplained labeled messages: ${unexplainedSet.size}`);
console.log(`High-confidence label-removal candidates: ${candidateIds.size}`);

if (!execute) {
  console.log("\nPREVIEW ONLY — NO MESSAGES CHANGED.");
  console.log("Execution requires: npm run cleanup:shipping-fossils -- --apply --yes");
  process.exit(0);
}

// Revalidate immediately before mutation: still labeled AND still unexplained.
const currentLabeled = new Set(await allIds(gmail, `label:"${LABEL}" -in:trash -in:spam`));
const currentExplained = new Set();
for (const rule of shippingRules) {
  for (const id of await allIds(gmail, `(${rule.query}) -in:trash -in:spam`)) currentExplained.add(id);
}
const finalIds = [...candidateIds].filter(id => currentLabeled.has(id) && !currentExplained.has(id));
const skipped = candidateIds.size - finalIds.length;

console.log(`Revalidated immediately before mutation: ${finalIds.length}`);
console.log(`Skipped because state changed: ${skipped}`);

for (let i = 0; i < finalIds.length; i += 500) {
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: {
      ids: finalIds.slice(i, i + 500),
      removeLabelIds: [label.id],
    },
  });
}

console.log(`\nREMOVED ${LABEL} from ${finalIds.length} message(s).`);
console.log("No messages trashed. No Inbox state changed. No archive state changed.");
