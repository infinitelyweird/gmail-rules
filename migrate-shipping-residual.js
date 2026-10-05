/**
 * V4.25 final shipping residual migration.
 *
 * Preview-only by default. Execution requires BOTH --apply and --yes.
 * Reclassifies known historical messages that still carry Purchases/Shipping
 * even though their permanent V4.24 rules now classify them elsewhere.
 *
 * Safety:
 * - Never trashes or deletes mail.
 * - Only operates on messages that STILL carry Purchases/Shipping.
 * - Adds the approved destination label, removes Purchases/Shipping.
 * - Action records are kept in Inbox and marked IMPORTANT.
 * - Finance/Payments records are archived.
 */
import { google } from "googleapis";
import { getAuth } from "./auth.js";

const SHIPPING = "Purchases/Shipping";
const execute = process.argv.includes("--apply") && process.argv.includes("--yes");

const migrations = [
  {
    name: "Air Filters payment verification",
    query: 'from:support@airfiltersdelivered.com subject:"Verify your payment information"',
    label: "Action/Bills Due",
    archive: false,
    important: true,
  },
  {
    name: "Air Filters subscription reconfirmation",
    query: 'from:support@airfiltersdelivered.com subject:"Reconfirm Your Filter Subscription Details"',
    label: "Action/Account Problems",
    archive: false,
    important: true,
  },
  {
    name: "Air Filters recurring charges",
    query: 'from:support@airfiltersdelivered.com subject:("recurring order charge confirmation" OR "recurring order purchase confirmation")',
    label: "Finance/Payments",
    archive: true,
    important: false,
  },
  {
    name: "Vetsource shipment problems",
    query: 'from:homedelivery@vetsource.com subject:("Auto-Shipment" AND (Canceled OR Failure))',
    label: "Action/Delivery Problems",
    archive: false,
    important: true,
  },
  {
    name: "Mysterious Package shipment disruption",
    query: 'from:concierge@mysteriouspackage.com subject:"Shipment Disruption"',
    label: "Action/Delivery Problems",
    archive: false,
    important: true,
  },
  {
    name: "FastTech cancelled shipments",
    query: 'from:support@fasttech.com subject:(shipment AND cancelled)',
    label: "Action/Delivery Problems",
    archive: false,
    important: true,
  },
  {
    name: "Amazon unconfirmed shipment notice",
    query: 'from:payments-messages@amazon.com subject:("Shipment of your order" AND "not been confirmed")',
    label: "Action/Delivery Problems",
    archive: false,
    important: true,
  },
  {
    name: "Comcast e-bill delivery failures",
    query: 'from:tsfcubillpay@southernonline.org subject:"e-bill not delivered"',
    label: "Action/Bills Due",
    archive: false,
    important: true,
  },
];

async function allIds(gmail, query) {
  const ids = [];
  let pageToken;
  do {
    const r = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 500,
      pageToken,
    });
    ids.push(...(r.data.messages || []).map(m => m.id));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return ids;
}

const auth = await getAuth();
const gmail = google.gmail({ version: "v1", auth });
const labelsResponse = await gmail.users.labels.list({ userId: "me" });
const labels = labelsResponse.data.labels || [];
const labelId = name => labels.find(l => l.name === name)?.id;

const shippingId = labelId(SHIPPING);
if (!shippingId) throw new Error(`Gmail label not found: ${SHIPPING}`);

for (const migration of migrations) {
  if (!labelId(migration.label)) {
    throw new Error(`Gmail label not found: ${migration.label}`);
  }
}

console.log("V4.25 FINAL SHIPPING RESIDUAL MIGRATION");
console.log(execute ? "MODE: APPLY" : "MODE: PREVIEW");

const planned = [];
const seen = new Set();

for (const migration of migrations) {
  const ids = await allIds(
    gmail,
    `(${migration.query}) label:"${SHIPPING}" -in:trash -in:spam`
  );

  const uniqueIds = ids.filter(id => !seen.has(id));
  for (const id of uniqueIds) seen.add(id);

  planned.push({ ...migration, ids: uniqueIds });
  if (uniqueIds.length) {
    console.log(
      `${String(uniqueIds.length).padStart(4)}  ${migration.name} -> ${migration.label}` +
      (migration.archive ? " [ARCHIVE]" : " [INBOX + IMPORTANT]")
    );
  }
}

const total = planned.reduce((sum, x) => sum + x.ids.length, 0);
console.log(`\nMessages to reclassify: ${total}`);

if (!execute) {
  console.log("\nPREVIEW ONLY — NO MESSAGES CHANGED.");
  console.log("Execution requires: npm run migrate:shipping-residual -- --apply --yes");
  process.exit(0);
}

// Re-query each classification immediately before mutation so messages that no
// longer carry Purchases/Shipping are automatically skipped.
let changed = 0;
for (const migration of planned) {
  if (!migration.ids.length) continue;

  const current = new Set(await allIds(
    gmail,
    `(${migration.query}) label:"${SHIPPING}" -in:trash -in:spam`
  ));
  const ids = migration.ids.filter(id => current.has(id));
  if (!ids.length) continue;

  const addLabelIds = [labelId(migration.label)];
  if (migration.important) addLabelIds.push("IMPORTANT");
  if (!migration.archive) addLabelIds.push("INBOX");

  const removeLabelIds = [shippingId];
  if (migration.archive) removeLabelIds.push("INBOX");

  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: { ids, addLabelIds, removeLabelIds },
  });

  changed += ids.length;
}

console.log(`\nRECLASSIFIED ${changed} message(s).`);
console.log("No messages trashed or deleted.");
