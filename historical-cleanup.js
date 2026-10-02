/**
 * Historical mailbox policy engine — V4.8.0
 *
 * Safe by default: `npm run history:plan` counts matches and changes nothing.
 * Execution requires BOTH --apply and --yes.
 *
 * Historical actions mirror rules.js. Action/LABEL matches are protected from
 * historical Trash and Archive actions. Trash is never permanent deletion.
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

async function listMessages(query) {
  const messages = [];
  let pageToken;
  do {
    const response = await gmail.users.messages.list({
      userId: "me", q: query, maxResults: 500, pageToken,
    });
    messages.push(...(response.data.messages || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return messages;
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

function stateQueries(rule) {
  // IMPORTANT: Gmail's search parser does not reliably scope a complex base
  // query when OR-ing several "missing state" clauses together. Keep every
  // state test as a separate query, then union the resulting IDs in code.
  const base = "(" + rule.query + ") -in:trash -in:spam";
  const queries = [];
  if (rule.trash) queries.push(base); // base already excludes existing Trash.
  if (rule.archive) queries.push(base + " in:inbox");
  if (rule.label) queries.push(base + ' -label:"' + rule.label + '"');
  if (rule.important) queries.push(base + " -is:important");
  return queries;
}

async function idsNeedingRule(rule) {
  const needs = new Set();
  for (const query of stateQueries(rule)) {
    for (const id of await listIds(query)) needs.add(id);
  }
  return [...needs];
}

function actionName(rule) {
  if (rule.trash) return "TRASH";
  if (rule.archive) return "ARCHIVE";
  return "LABEL";
}

function intersection(a, b) {
  return new Set([...a].filter((id) => b.has(id)));
}

function difference(a, b) {
  return new Set([...a].filter((id) => !b.has(id)));
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
const uniqueAction = new Set();

console.log("V4.8.0 HISTORICAL CLEANUP " + (execute ? "APPLY" : "PLAN"));
console.log("Scope: all matching mail except existing Trash/Spam.\n");

for (const rule of rules) {
  const query = "(" + rule.query + ") -in:trash -in:spam";
  const ids = await listIds(query);
  const action = actionName(rule);
  const needs = await idsNeedingRule(rule);
  plans.push({rule, ids, needs, action});
  const target = rule.trash ? uniqueTrash : rule.archive ? uniqueArchive : uniqueAction;
  for (const id of ids) target.add(id);
  // Defensive invariant: a state query must never escape the rule's match set.
  const matched = new Set(ids);
  const escaped = needs.filter((id) => !matched.has(id));
  if (escaped.length) {
    throw new Error(
      "State query escaped rule scope for " + rule.name +
      ": " + escaped.length + " NEEDS id(s) were not in MATCHED."
    );
  }
  console.log(
    action.padEnd(7) +
    " MATCHED " + String(ids.length).padStart(6) +
    "  NEEDS " + String(needs.length).padStart(6) +
    "  DONE " + String(ids.length - needs.length).padStart(6) +
    "  " + rule.name + (rule.label ? " -> " + rule.label : "")
  );
}

const trashAction = intersection(uniqueTrash, uniqueAction);
const trashArchive = intersection(uniqueTrash, uniqueArchive);
const actionArchive = intersection(uniqueAction, uniqueArchive);
const safeTrash = difference(uniqueTrash, uniqueAction);
const safeArchive = difference(uniqueArchive, uniqueAction);

console.log("\nSAFETY / COLLISION ANALYSIS");
console.log("TRASH vs ACTION:   " + trashAction.size);
console.log("TRASH vs ARCHIVE:  " + trashArchive.size);
console.log("ACTION vs ARCHIVE: " + actionArchive.size);
console.log("Protected by Action rules: " + uniqueAction.size);
console.log("Safe-to-trash unique:       " + safeTrash.size);
console.log("Safe-to-archive unique:     " + safeArchive.size);
if (trashAction.size) {
  console.log("HIGH-RISK: " + trashAction.size +
    " message(s) match Trash and Action; execution protects them from Trash.");
}

async function getHeaders(id) {
  const response = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["From", "Subject"],
  });
  const headers = new Map(
    (response.data.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]),
  );
  return {
    from: headers.get("from") || "(unknown)",
    subject: headers.get("subject") || "(no subject)",
  };
}

function matchingRuleNames(id, predicate) {
  return plans
    .filter((plan) => predicate(plan.rule) && plan.ids.includes(id))
    .map((plan) => plan.rule.name);
}

if (trashAction.size) {
  console.log("\nTRASH vs ACTION COLLISION DETAILS");
  console.log("Metadata only: From + Subject + matching rule names.\n");
  let n = 0;
  for (const id of trashAction) {
    n++;
    const meta = await getHeaders(id);
    const trashRules = matchingRuleNames(id, (rule) => Boolean(rule.trash));
    const actionRules = matchingRuleNames(id, (rule) => !rule.trash && !rule.archive);
    console.log("#" + n);
    console.log("From: " + meta.from);
    console.log("Subject: " + meta.subject);
    console.log("Trash rule(s): " + trashRules.join("; "));
    console.log("Action rule(s): " + actionRules.join("; "));
    console.log("");
  }
}

if (!execute) {
  const pendingOperations = plans.reduce((sum, plan) => sum + plan.needs.length, 0);
  const effectivePendingOperations = plans.reduce((sum, plan) => {
    let ids = plan.needs;
    if (plan.rule.trash) ids = ids.filter((id) => safeTrash.has(id));
    else if (plan.rule.archive) ids = ids.filter((id) => safeArchive.has(id));
    return sum + ids.length;
  }, 0);
  console.log("\nPending rule/message operations before precedence: " + pendingOperations);
  console.log("Effective pending operations after precedence: " + effectivePendingOperations);
  console.log("NO MESSAGES CHANGED.");
  console.log("Execution enforces Action precedence over Trash/Archive.");
  console.log("Review this output before execution.");
  console.log("To execute exactly this policy: npm run history:apply -- --yes");
  process.exit();
}

console.log("\nApplying historical policy...");
let operations = 0;
for (const {rule, needs: pendingIds} of plans) {
  let ids = pendingIds;
  if (rule.trash) ids = ids.filter((id) => safeTrash.has(id));
  else if (rule.archive) ids = ids.filter((id) => safeArchive.has(id));
  if (!ids.length) continue;
  await applyRule(rule, ids, labels);
  console.log("APPLIED " + actionName(rule).padEnd(7) + " " +
    String(ids.length).padStart(6) + "  " + rule.name);
  operations += ids.length;
}
console.log("\nHistorical cleanup complete.");
console.log("Rule/message operations applied: " + operations);
console.log("Action-matched messages were protected from Trash and Archive.");
console.log("Trash actions only moved messages to Gmail Trash; nothing was permanently deleted.");
