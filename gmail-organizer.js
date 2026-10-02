/**
 * Gmail Rules Installer V4.1
 *
 * Adds:
 * - Idempotent exact-filter detection.
 * - TRASH rules for high-confidence promotional senders.
 * - Read-only legacy-filter audit warnings.
 * - A pre-restore safety backup.
 */
import fs from "node:fs/promises";
import {google} from "googleapis";
import {getAuth} from "./auth.js";
import {rules} from "./rules.js";

const MODES = ["--plan", "--backup", "--apply", "--restore"];
const mode = process.argv.find((arg) => MODES.includes(arg)) || "--plan";
const BACKUP = "gmail-filter-backup-v4.json";
const gmail = google.gmail({version: "v1", auth: await getAuth()});

function normalizeFilter(filter) {
  const criteria = filter.criteria || {};
  const action = filter.action || {};
  const normalizedCriteria = {};
  for (const key of ["from", "to", "subject", "query", "negatedQuery"]) {
    if (criteria[key]) normalizedCriteria[key] = criteria[key];
  }
  if (criteria.hasAttachment === true) normalizedCriteria.hasAttachment = true;
  if (criteria.excludeChats === true) normalizedCriteria.excludeChats = true;
  if (criteria.size) normalizedCriteria.size = criteria.size;
  if (criteria.sizeComparison) normalizedCriteria.sizeComparison = criteria.sizeComparison;
  return {
    criteria: normalizedCriteria,
    action: {
      addLabelIds: [...(action.addLabelIds || [])].sort(),
      removeLabelIds: [...(action.removeLabelIds || [])].sort(),
      ...(action.forward ? {forward: action.forward} : {}),
    },
  };
}

function sameFilter(a, b) {
  return JSON.stringify(normalizeFilter(a)) === JSON.stringify(normalizeFilter(b));
}

async function snapshot() {
  const [labels, filters] = await Promise.all([
    gmail.users.labels.list({userId: "me"}),
    gmail.users.settings.filters.list({userId: "me"}),
  ]);
  return {
    createdAt: new Date().toISOString(),
    labels: labels.data.labels || [],
    filters: filters.data.filter || [],
  };
}

async function backup() {
  const state = await snapshot();
  await fs.writeFile(BACKUP, JSON.stringify(state, null, 2));
  console.log("Backup: " + BACKUP + " (" + state.filters.length + " filters)");
  return state;
}

if (mode === "--backup") {
  await backup();
  process.exit();
}

if (mode === "--restore") {
  const backedUp = JSON.parse(await fs.readFile(BACKUP, "utf8"));
  const current =
    (await gmail.users.settings.filters.list({userId: "me"})).data.filter || [];
  console.log(
    "Would replace " + current.length + " current filters with " +
      backedUp.filters.length + " backed-up filters.",
  );
  if (!process.argv.includes("--yes")) {
    console.log("Preview only. Add --yes to perform the destructive restore.");
    process.exit();
  }
  const preRestore = await snapshot();
  const preRestoreFile = "gmail-filter-backup-pre-restore-" +
    new Date().toISOString().replaceAll(":", "-") + ".json";
  await fs.writeFile(preRestoreFile, JSON.stringify(preRestore, null, 2));
  console.log("Pre-restore safety backup: " + preRestoreFile);
  for (const filter of current) {
    await gmail.users.settings.filters.delete({userId: "me", id: filter.id});
  }
  for (const filter of backedUp.filters) {
    const {id, ...requestBody} = filter;
    await gmail.users.settings.filters.create({userId: "me", requestBody});
  }
  console.log("Restore complete.");
  process.exit();
}

const state = await snapshot();
const labels = new Map(state.labels.map((label) => [label.name, label.id]));

function desiredFilter(rule, labelId) {
  const addLabelIds = [
    ...(labelId ? [labelId] : []),
    ...(rule.important ? ["IMPORTANT"] : []),
    ...(rule.trash ? ["TRASH"] : []),
  ];
  return {
    criteria: {query: rule.query},
    action: {
      ...(addLabelIds.length ? {addLabelIds} : {}),
      ...(rule.archive ? {removeLabelIds: ["INBOX"]} : {}),
    },
  };
}

/**
 * Flag legacy behaviors worth human review. This is intentionally conservative:
 * it does NOT claim semantic equivalence and never deletes anything.
 */
function auditLegacyFilters(filters) {
  const warnings = [];
  for (const filter of filters) {
    const c = filter.criteria || {};
    const a = filter.action || {};
    const adds = a.addLabelIds || [];
    const removes = a.removeLabelIds || [];
    const criteriaText = [c.from, c.to, c.subject, c.query, c.negatedQuery]
      .filter(Boolean).join(" ");

    if (removes.includes("UNREAD")) {
      warnings.push({id: filter.id, reason: "marks matching mail as read", criteriaText});
    }
    if (adds.includes("STARRED")) {
      warnings.push({id: filter.id, reason: "automatically stars matching mail", criteriaText});
    }
    if (adds.includes("TRASH") &&
        /american|airlines|travelocity|reservation|hotel|flight/i.test(criteriaText)) {
      warnings.push({id: filter.id, reason: "travel-related rule sends mail to Trash", criteriaText});
    }
  }
  return warnings;
}

console.log(
  "V4.1 " + mode.slice(2).toUpperCase() + " — " +
    state.filters.length + " existing filters\n",
);

let existingCount = 0;
let createCount = 0;

for (const rule of rules) {
  const labelId = rule.label ? labels.get(rule.label) : undefined;
  const desired = desiredFilter(rule, labelId);
  // A label-bearing rule cannot be exact if its desired label does not exist.
  const canCompare = !rule.label || Boolean(labelId);
  const exists = canCompare && state.filters.some((f) => sameFilter(f, desired));
  if (exists) existingCount++;
  else createCount++;

  const disposition = rule.trash ? "TRASH   " : rule.archive ? "ARCHIVE " : "INBOX   ";
  console.log(
    (exists ? "EXISTS " : "CREATE ") + disposition +
      rule.name + (rule.label ? " -> " + rule.label : ""),
  );
}

console.log(
  "\nSummary: " + existingCount + " exact existing, " +
    createCount + " to create.",
);

const legacyWarnings = auditLegacyFilters(state.filters);
if (legacyWarnings.length) {
  console.log("\nLEGACY FILTER AUDIT — review only; nothing will be deleted:");
  for (const warning of legacyWarnings) {
    console.log(
      "WARN " + warning.reason + " | " +
      (warning.criteriaText || "(criteria not rendered)") +
      " | id=" + warning.id,
    );
  }
  console.log("Warnings: " + legacyWarnings.length);
}

if (mode === "--plan") {
  console.log("\nNo changes made.");
  process.exit();
}

await backup();
let created = 0;
let skipped = 0;
const knownFilters = [...state.filters];

for (const rule of rules) {
  let labelId = rule.label ? labels.get(rule.label) : undefined;
  if (rule.label && !labelId) {
    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: rule.label,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    labelId = response.data.id;
    labels.set(rule.label, labelId);
  }

  const desired = desiredFilter(rule, labelId);
  if (knownFilters.some((f) => sameFilter(f, desired))) {
    console.log("SKIP   " + rule.name + " (exact filter already exists)");
    skipped++;
    continue;
  }

  const response = await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: desired,
  });
  knownFilters.push(response.data);
  console.log("CREATE " + rule.name);
  created++;
}

console.log(
  "\nApply complete: " + created + " created, " + skipped +
    " already existed.",
);
