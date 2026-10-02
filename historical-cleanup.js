/**
 * Historical mailbox policy engine — V4.3
 *
 * Safe by default: `npm run history:plan` counts matches and changes nothing.
 * Execution requires BOTH --apply and --yes.
 *
 * Historical actions mirror rules.js. Trash means move to Gmail Trash, never
 * permanent deletion. Searches always exclude messages already in Trash/Spam.
 */
import {google} from "googleapis";
import {getAuth} from "./auth.js";
import {rules} from "./rules.js";

const gmail = google.gmail({version: "v1", auth: await getAuth()});
const execute = process.argv.includes("--apply") && process.argv.includes("--yes");
const BATCH_SIZE = 500;

async function ensureLabels() {
  const response = await gmail.users.labels.list({userId: "me"});
  const labels = new Map((response.data.labels || []).map((l) => [l.name, l.id]));
  if (!execute) return labels;
  for (const rule of rules) {
    if (!rule.label || labels.has(rule.label)) continue;
    const created = await gmail.users.labels.create({
      userId: "me",
      requestBody: {name: rule.label, labelListVisibility: "labelShow", messageListVisibility: "show"},
    });
    labels.set(rule.label, created.data.id);
  }
  return labels;
}

async function listIds(query) {
  const ids = [];
  let pageToken;
  do {
    const response = await gmail.users.messages.list({
      userId: "me", q: query, maxResults: 500, pageToken,
    });
    ids.push(...(response.data.messages || []).map((m) => m.id));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return ids;
}

function actionName(rule) {
  if (rule.trash) return "TRASH";
  if (rule.archive) return "ARCHIVE";
  return "LABEL";
}

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function applyRule(rule, ids, labels) {
  const addLabelIds = [];
  const removeLabelIds = [];
  if (rule.label) {
    const labelId = labels.get(rule.label);
    if (!labelId) throw new Error("Missing label: " + rule.label);
    addLabelIds.push(labelId);
  }
  if (rule.important) addLabelIds.push("IMPORTANT");
  if (rule.trash) addLabelIds.push("TRASH");
  if (rule.archive) removeLabelIds.push("INBOX");

  for (const batch of chunks(ids, BATCH_SIZE)) {
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {ids: batch, addLabelIds, removeLabelIds},
    });
  }
}

const labels = await ensureLabels();
const plans = [];
const uniqueTrash = new Set();
const uniqueArchive = new Set();
const uniqueLabel = new Set();

console.log("V4.3 HISTORICAL CLEANUP " + (execute ? "APPLY" : "PLAN"));
console.log("Scope: all matching mail except existing Trash/Spam.\n");

for (const rule of rules) {
  const query = "(" + rule.query + ") -in:trash -in:spam";
  const ids = await listIds(query);
  const action = actionName(rule);
  plans.push({rule, ids, action});
  const target = rule.trash ? uniqueTrash : rule.archive ? uniqueArchive : uniqueLabel;
  for (const id of ids) target.add(id);
  console.log(action.padEnd(7) + " " + String(ids.length).padStart(6) + "  " +
    rule.name + (rule.label ? " -> " + rule.label : ""));
}

console.log("\nUnique-message summary (rules may overlap):");
console.log("Would trash:   " + uniqueTrash.size);
console.log("Would archive: " + uniqueArchive.size);
console.log("Would label:   " + uniqueLabel.size);

if (!execute) {
  console.log("\nNO MESSAGES CHANGED.");
  console.log("Review this output before execution.");
  console.log("To execute exactly this policy: npm run history:apply -- --yes");
  process.exit();
}

console.log("\nApplying historical policy...");
let operations = 0;
for (const {rule, ids} of plans) {
  if (!ids.length) continue;
  await applyRule(rule, ids, labels);
  console.log("APPLIED " + actionName(rule).padEnd(7) + " " +
    String(ids.length).padStart(6) + "  " + rule.name);
  operations += ids.length;
}
console.log("\nHistorical cleanup complete.");
console.log("Rule/message operations applied: " + operations);
console.log("Trash actions only moved messages to Gmail Trash; nothing was permanently deleted.");
