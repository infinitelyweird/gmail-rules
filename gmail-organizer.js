/**
 * Gmail Rules Installer V4
 *
 * V4 makes installation idempotent: running apply repeatedly will not create
 * exact duplicate filters. It compares the desired criteria/action against the
 * filters Gmail already has and skips exact matches.
 *
 * Commands:
 *   npm run plan    Read-only: CREATE vs EXISTS for every desired rule.
 *   npm run backup  Save current labels + filters locally.
 *   npm run apply   Backup, create missing labels, create only missing filters.
 *   npm run restore Preview restore.
 *
 * Destructive restore:
 *   node gmail-organizer.js --restore --yes
 *
 * Gmail has no atomic filter transaction, so backups remain important even
 * though normal apply is now safe to repeat.
 */
import fs from "node:fs/promises";
import {google} from "googleapis";
import {getAuth} from "./auth.js";
import {rules} from "./rules.js";

const MODES = ["--plan", "--backup", "--apply", "--restore"];
const mode = process.argv.find((arg) => MODES.includes(arg)) || "--plan";
const BACKUP = "gmail-filter-backup-v4.json";
const gmail = google.gmail({version: "v1", auth: await getAuth()});

/** Gmail may omit empty properties; normalize arrays/criteria before comparing. */
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

/** Capture Gmail configuration relevant to this project. */
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

  // Take a second recovery point immediately before destructive restore.
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

/**
 * Translate our readable rule object into Gmail's API representation.
 * For plan mode, a label that does not exist yet has no ID, so no exact-match
 * comparison is possible; that rule is correctly reported as CREATE.
 */
function desiredFilter(rule, labelId) {
  return {
    criteria: {query: rule.query},
    action: {
      addLabelIds: [
        ...(labelId ? [labelId] : []),
        ...(rule.important ? ["IMPORTANT"] : []),
      ],
      ...(rule.archive ? {removeLabelIds: ["INBOX"]} : {}),
    },
  };
}

console.log(
  "V4 " + mode.slice(2).toUpperCase() + " — " +
    state.filters.length + " existing filters\n",
);

let existingCount = 0;
let createCount = 0;

for (const rule of rules) {
  const labelId = labels.get(rule.label);
  const desired = desiredFilter(rule, labelId);
  const exists = Boolean(labelId) && state.filters.some((f) => sameFilter(f, desired));

  if (exists) existingCount++;
  else createCount++;

  console.log(
    (exists ? "EXISTS " : "CREATE ") +
      (rule.archive ? "ARCHIVE " : "INBOX   ") +
      rule.name + " -> " + rule.label,
  );
}

console.log(
  "\nSummary: " + existingCount + " exact existing, " +
    createCount + " to create.",
);

if (mode === "--plan") {
  console.log("No changes made.");
  process.exit();
}

await backup();

let created = 0;
let skipped = 0;

// Refresh this array as we create filters so duplicate rules in rules.js are
// also harmless during a single run.
const knownFilters = [...state.filters];

for (const rule of rules) {
  let labelId = labels.get(rule.label);

  if (!labelId) {
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
