/**
 * Gmail Rules Installer V4.1.1
 *
 * Adds:
 * - Idempotent exact-filter detection.
 * - TRASH rules for high-confidence promotional senders.
 * - Read-only legacy-filter audit warnings.
 * - A pre-restore safety backup.
 * - Automatic rotation of the previous canonical backup before overwrite.
 */
import fs from "node:fs/promises";
import {google} from "googleapis";
import {getAuth} from "./auth.js";
import {rules} from "./rules.js";

const MODES = ["--plan", "--backup", "--apply", "--restore", "--cleanup-legacy"];
const mode = process.argv.find((arg) => MODES.includes(arg)) || "--plan";
const BACKUP = "gmail-filter-backup-v4.json";

// Exact legacy filter IDs reviewed from the V4.1 audit. Cleanup is deliberately
// allow-listed: nothing merely "similar" is removed.
const LEGACY_CLEANUP_IDS = new Set([
  "ANe1Bmh5UYxTcM4Rc2w9F5Htt3IhUn8Wvq8Kkw", // Travelocity: mark read + trash
  "ANe1BmgJqYzGUkYp8V7zswTlhhGfoNQyTCSDcA", // American Airlines: trash
  "ANe1BmhuHAvXibUPORyefMz_mtRIMobJ9q4yWQ", // Travelocity: trash
  "ANe1BmjqZzdgG6NvLT2vmhpsNmRPRtAMXu13dA", // Code42: mark read
  "ANe1BmgGneJy5kTcSDL6GOoivWZTjFg622pW2spdsPgNCSBTlcYLyFaiZOu55EW9aATkIi9o4Q", // Nectar: star
  "ANe1Bmi6OPP9kcTfrgzMhPgUexuND5o_s64ZHWU52G5wPt8XRH_QtMW3CZWoGxrPBethGSDLEw", // Temu/USPS: star
  "ANe1BmguVBfqe-LXbwKa0Z0kJAJi-Z-a8AbCP2j6kzs1pG2btdQZhVHio9_oS8PETPYjc60jKw", // GitHub: mark read
  "ANe1BmgdIqwoJTKNpDuPNpCkzqVn4E8pxdbsc0hEXgoaVs1KL2D5_ncNOFhT03QY1Nx1Pc1TcQ", // January: mark read
  "ANe1BmhE1PlR-u-zILWIvD95w7tCs2Fq0dxZroIHC2X3nfHkJbQu6L4mxsLhzsZfVHKDXEBmgg", // FSA Store: mark read
  "ANe1BmhdTUeQD4PcKqUMTq-Lx8y5f7y1hPz-RuJQBHFvqADoAMZfATKNR0b13vIMa-xA-owyig", // Netflix: mark read
  "ANe1BmiqPo3rVnTL9kV7N_tqj-m4_zw7vmc58afq1AAbUnLLCw99FNVJYcMDyNrBdfl7Ju_XQA", // BestBuy: star
  "ANe1BmgfFwNB3eql8UIGO81LxzMsEeb-7wimpNcXL0fE-SeelSC-sFvbHZ97ySTP4GYC6uyqtA", // BestBuy: mark read
  "ANe1BmjLDyXsc0M_D43eeN8NrlWmUPlYiAS8PXEX-uNZ1tng14NuJk4PEiMPKSZAgMsOvjtcVQ", // Klarna: mark read
  "ANe1BmilpQFZXGC2p4Z_ewNke4NkNiI9vdeW7EDzXETRYa9ncdRLObpZ1czA6yDhe2udJtHMcQ", // Best Egg: mark read + star
  "ANe1BmivT7g3Jtp7_dpjI6h4YQUrob_su5gm_kZkdzlXG2MDw5KgXzipj1UyBgZoxtX5I6qc0w", // Guest Reservations: mark read
  "ANe1BmgeBwz9RpyXWBt1GCHysFvOFtXQ5c5xNANtFGb6lUOESPNrJoRTyFq1bezIfh0QzbxZiw", // Jackbox: mark read + star
]);
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

  // Preserve the previous recovery point before replacing the canonical
  // "latest" backup. This matters during multi-step migrations: cleanup may
  // create a 62-filter backup, then apply may create a 46-filter backup.
  // Without rotation, the more valuable pre-migration snapshot would be lost.
  try {
    await fs.access(BACKUP);
    const rotated = "gmail-filter-backup-v4-" +
      new Date().toISOString().replaceAll(":", "-") + ".json";
    await fs.copyFile(BACKUP, rotated);
    console.log("Preserved previous backup as: " + rotated);
  } catch {
    // No previous backup yet; nothing to rotate.
  }

  await fs.writeFile(BACKUP, JSON.stringify(state, null, 2));
  console.log("Backup: " + BACKUP + " (" + state.filters.length + " filters)");
  return state;
}

if (mode === "--backup") {
  await backup();
  process.exit();
}

if (mode === "--cleanup-legacy") {
  const state = await snapshot();
  const matches = state.filters.filter((filter) => LEGACY_CLEANUP_IDS.has(filter.id));
  console.log("Legacy cleanup: " + matches.length + " reviewed filters found.");
  if (!process.argv.includes("--yes")) {
    for (const filter of matches) console.log("WOULD DELETE " + filter.id);
    console.log("Preview only. Add --yes to delete exactly these allow-listed legacy filters.");
    process.exit();
  }
  await backup();
  for (const filter of matches) {
    await gmail.users.settings.filters.delete({userId: "me", id: filter.id});
    console.log("DELETED " + filter.id);
  }
  console.log("Legacy cleanup complete: " + matches.length + " filters deleted.");
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
  "V4.2 " + mode.slice(2).toUpperCase() + " — " +
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
