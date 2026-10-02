/**
 * Read-only audit for messages carrying Purchases/Shipping that are not
 * explained by any of the current shipping/archive rules.
 *
 * This script NEVER modifies Gmail.
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

const auth = await getAuth();
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


/*
 * V4.18 fossil analysis
 *
 * A "fossil" is a message that still carries Purchases/Shipping but is not
 * explained by any current shipping rule.  This section is deliberately
 * READ ONLY.  It does not remove labels, archive, trash, or restore Inbox.
 *
 * The first cleanup candidates are intentionally conservative: sender/query
 * combinations whose audit subjects are clearly promotional/newsletter
 * language rather than records of an actual shipment.
 */
const fossilCandidateQueries = [
  ["Nutrisystem marketing", 'from:Nutrisystem@news.nutrisystem.com'],
  ["SodaStream marketing", 'from:SodaStream@shop.sodastream.com'],
  ["Edible Arrangements marketing", 'from:sweetdeals@p.ediblearrangements.com'],
  ["Pizza Hut marketing", 'from:Promotions@my.pizzahut.com'],
  ["Clothing Arts marketing", 'from:info@clothingarts.com'],
  ["ISEE Hair marketing", 'from:jessie@iseehair.com'],
  ["Uber Eats marketing", 'from:uber@uber.com'],
  ["Touch of Modern marketing", 'from:hello@email.touchofmodern.com'],
  ["Touch of Modern marketing secondary", 'from:hello@p.touchofmodern.com'],
  ["Angies List Big Deal marketing", 'from:thebigdeal@thebigdeal.angieslist.com'],
  ["PrettyLitter marketing", 'from:prettylitter@mail.prettylitter.com'],
  ["PrettyLitter marketing secondary", 'from:prettylitter@e.prettylittercats.com'],
  ["SHEIN marketing", 'from:shein@news.edmmarket.shein.com'],
  ["StackSocial deals", 'from:deals@mail.stackcommerce.com'],
  ["Krispy Kreme marketing", 'from:krispykreme@e.krispykreme.com'],
  ["Little Caesars marketing", 'from:littlecaesars@littlecaesars.fbmta.com'],
  ["Nalley Honda marketing", 'from:NalleyHonda@s1.eautodealerhub.com'],
  ["SodaStream US marketing typo-domain", 'from:SodaStreamUSA@sodasteam.com'],
  ["SodaStream US marketing", 'from:SodaStreamUSA@sodastream.com'],
  ["Boston Globe newsletter", 'from:newsletters@email.bostonglobe.com'],
];

if (unexplained.length) {
  const unexplainedSet = new Set(unexplained);
  const candidates = new Map();

  for (const [name, query] of fossilCandidateQueries) {
    const ids = await allIds(gmail, `(${query}) label:"${LABEL}" -in:trash -in:spam`);
    const fossilIds = ids.filter(id => unexplainedSet.has(id));
    if (fossilIds.length) {
      candidates.set(name, fossilIds);
      console.log(`FOSSIL CANDIDATE ${String(fossilIds.length).padStart(4)}  ${name}`);
    }
  }

  const uniqueCandidates = new Set([...candidates.values()].flat());
  console.log("\nFOSSIL CLEANUP PREVIEW — READ ONLY");
  console.log(`Unexplained labeled messages: ${unexplained.length}`);
  console.log(`High-confidence label-removal candidates: ${uniqueCandidates.size}`);
  console.log(`Unexplained messages left untouched: ${unexplained.length - uniqueCandidates.size}`);
  console.log("PROPOSED ACTION: remove Purchases/Shipping label only.");
  console.log("NO MESSAGES CHANGED.");
}
