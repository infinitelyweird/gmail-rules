/**
 * Gmail filter installer / backup / restore utility.
 *
 * Commands:
 *   npm run plan    Read-only preview (default behavior).
 *   npm run backup  Save current labels + filters locally.
 *   npm run apply   Backup, create missing labels, then install rules.js.
 *   npm run restore Preview a restore; DOES NOT mutate Gmail.
 *
 * Destructive restore requires:
 *   node gmail-organizer.js --restore --yes
 *
 * SAFETY / LIMITATIONS:
 * - Apply always takes a backup first.
 * - Restore requires explicit --yes.
 * - Backup files are local/private and ignored by Git.
 * - V3.1 DOES NOT detect filters already installed by this project.
 *   Repeated --apply runs may therefore create duplicate Gmail filters.
 */
import fs from "node:fs/promises";
import {google} from "googleapis";
import {getAuth} from "./auth.js";
import {rules} from "./rules.js";

const MODES = ["--plan", "--backup", "--apply", "--restore"];
const mode = process.argv.find((arg) => MODES.includes(arg)) || "--plan";
const BACKUP = "gmail-filter-backup-v3.1.json";
const gmail = google.gmail({version: "v1", auth: await getAuth()});

/** Capture the Gmail configuration relevant to this project. */
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

/** Write a local recovery point before Gmail filter mutations. */
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
    "Would replace " +
      current.length +
      " current filters with " +
      backedUp.filters.length +
      " backed-up filters.",
  );

  // npm run restore is deliberately preview-only.
  if (!process.argv.includes("--yes")) {
    console.log("Preview only. Add --yes to perform the destructive restore.");
    process.exit();
  }

  /*
   * Gmail has no atomic "replace filter set" API. Restore deletes current
   * filters, then recreates the saved set. Server-assigned filter IDs are
   * stripped before recreation.
   *
   * Labels are present in the snapshot for reference, but V3.1 restore does
   * not destructively replace/delete Gmail labels.
   */
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

console.log(
  "V3.1 " +
    mode.slice(2).toUpperCase() +
    " — " +
    state.filters.length +
    " existing filters\n",
);

for (const rule of rules) {
  console.log(
    (rule.archive ? "ARCHIVE" : "INBOX  ") +
      " " +
      rule.name +
      " -> " +
      rule.label,
  );
}

if (mode === "--plan") {
  console.log("\nNo changes made.");
  process.exit();
}

// Every mutating installation starts with a recovery point.
await backup();

for (const rule of rules) {
  let labelId = labels.get(rule.label);

  // Reuse an existing label by name; otherwise create it lazily.
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

  const action = {
    addLabelIds: [
      labelId,
      ...(rule.important ? ["IMPORTANT"] : []),
    ],

    // In Gmail's API, archiving means removing the INBOX system label.
    ...(rule.archive ? {removeLabelIds: ["INBOX"]} : {}),
  };

  await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: {
      criteria: {query: rule.query},
      action,
    },
  });
}

console.log("Applied " + rules.length + " filters.");
