/**
 * V4.20 shipping fossil cleanup — evidence-reviewed batch 2.
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

  // Batch 2: obvious non-transactional residuals from the V4.19 audit.
  ["1-800-Baskets marketing", 'from:baskets@e.1800baskets.com'],
  ["Enterprise Efficiency marketing", 'from:EnterpriseEfficiency@techwebonlineevents.com'],
  ["Amazon Pharmacy marketing", 'from:hello@email.pharmacy.amazon.com'],
  ["DFRobot project marketing", 'from:service@dfrobot.com'],
  ["Grace Gems devotional", 'from:pilgrim@gracegems.org'],
  ["Green Olive marketing", 'from:greg@greenolive.com.au'],
  ["KAYAK wine marketing", 'from:news@kayak.com'],
  ["Michaels marketing", 'from:michaels@emdeals.michaels.com'],
  ["Sezzle marketing", 'from:hello@email.sezzle.com'],
  ["Shopify Partner content", 'from:partners@email.shopify.com'],
  ["TrackR marketing", 'from:support@thetrackr.com'],
  ["Tropical Smoothie marketing", 'from:tropicalsmoothie@marketing.tropicalsmoothie.com'],
  ["Wayfair marketing", 'from:editor@members.wayfair.com'],
  ["Withings marketing", 'from:community@email.withings.com'],
  ["Chewy marketing residual", 'from:chewy@woof.chewy.com'],
  ["HP shopping marketing", 'from:HP@us.shopping.hp.com'],
  ["KRKC jewelry marketing", 'from:business@krkcom.com'],
  ["3D Printing USA marketing", 'from:contact@3dprintingusa.com'],
  ["A Place for Mom partner marketing", 'from:donotreply@aplaceformom.com'],
  ["Bonefish Grill marketing", 'from:emails@email.bonefishgrill.com'],
  ["Chick-fil-A marketing", 'from:one@email.chick-fil-a.com'],
  ["Elusiva marketing", 'from:noreply@elusiva.com'],
  ["Factor marketing", 'from:hello@g.factor75.com'],
  ["Federal Drone Registration marketing", 'from:no-reply@federaldroneregistration.com'],
  ["FilterEasy marketing", 'from:hello@news.filtereasy.com'],
  ["Hertz marketing", 'from:HertzGoldOffers@emails.hertz.com'],
  ["iPad Pilot newsletter", 'from:iPad@enews.sportys.com'],
  ["KILLSTAR marketing", 'from:us@killstar.com'],
  ["Krispy Kreme residual marketing", 'from:KrispyKreme@email.krispykreme.com'],
  ["Office Depot marketing", 'from:officedepot@e.officedepot.com'],
  ["OnePay credit marketing", 'from:mail@update.one.app'],
  ["PetSmart marketing", 'from:PetSmart@mail.petsmart.com'],
  ["Review Geek newsletter", 'from:reviewgeek@reviewgeek.com'],
  ["SiriusXM marketing", 'from:no-reply@e.siriusxm.com'],
  ["Boston Globe circulation marketing", 'from:circulationoffers@email.globe.com'],
  ["Uber Eats noreply marketing", 'from:noreply@uber.com'],
  ["Vivid Seats marketing", 'from:tickets@live.vividseats.com'],
  ["Brad's Deals marketing", 'from:shop@bradsdeals.com'],
  ["Dell Black Friday marketing", 'from:Dell@em.home.dell.com'],
  ["Grassfire marketing", 'from:alert@grassrootsaction.com'],
  ["InformationWeek marketing", 'from:InformationWeek@techwebwhitepapers.com'],
  ["Jarrolds newsletter", 'from:newsletter@jarrold.co.uk'],
  ["Media Research Center marketing", 'from:brent.bozell@mrc.org'],
  ["M&Co marketing", 'from:online@e.mandco.com'],
  ["Newegg promo residual", 'from:Promo@email.newegg.com'],
  ["Oliviers marketing", 'from:customercare@oliviersandco.com'],
  ["Travelocity marketing", 'from:travelocity@e.travelocity.com'],
  ["Affirm marketing", 'from:email@e.affirm.com'],
  ["Airmoto marketing", 'from:email@getairmoto.com'],
  ["Airmoto affiliate marketing", 'from:info@mail.snwbl.io'],
  ["Apple retail marketing", 'from:News@insideapple.apple.com'],
  ["Artnet newsletter", 'from:newsletter@artnet.com'],
  ["Audible newsletter", 'from:newsletters@audible.com'],
  ["AutoZone residual marketing", 'from:AutoZone@email.autozone.com'],
  ["Blooms Today marketing", 'from:bloomstoday@reply.bronto.com'],
  ["Carol Wright marketing", 'from:carolwright@value.carolwright.com'],
  ["Classic Subaru marketing", 'from:sturano@classicatlanta.com'],
  ["Cycle Gear marketing residual", 'from:email@email.cyclegear.com'],
  ["Deadline Hollywood newsletter", 'from:email@email.deadline.com'],
  ["DestinationLoans marketing", 'from:support@emailint.com'],
  ["Tenable marketing", 'from:marketing@tenable.com'],
  ["Dice newsletter", 'from:dice@e-mail.dice.com'],
  ["DreamFactory marketing", 'from:marketing@dreamfactory.com'],
  ["Everlywell marketing", 'from:contact@everlywell.com'],
  ["FastTech new-arrivals marketing", 'from:new-arrivals@e.fasttech.com'],
  ["Flipboard newsletter", 'from:editorialstaff@flipboard.com'],
  ["Frontier marketing residual", 'from:deals@emails.flyfrontier.com'],
  ["Georgia Lottery marketing", 'from:playerinformation@return.galottery.net'],
  ["GoDaddy marketing residual", 'from:donotreply@godaddy.com'],
  ["Golden Corral marketing", 'from:goodasgoldclub@goldencorral.fbmta.com'],
  ["Google Photos marketing", 'from:noreply-photos@google.com'],
  ["Grubhub marketing", 'from:email@e.grubhub.com'],
  ["IHG marketing", 'from:IHGOneRewards@mc.ihg.com'],
  ["iRobot marketing", 'from:marketing@irobot.com'],
  ["MAPerformance marketing", 'from:support@maperformance.com'],
  ["McAfee marketing", 'from:info@mobilemarketing.mcafee.com'],
  ["Medium digest", 'from:noreply@medium.com'],
  ["MyFitnessPal marketing", 'from:no-reply@myfitnesspal.com'],
  ["MyPanera marketing", 'from:panera@m1.panerabread.com'],
  ["Nokia Health marketing", 'from:community@email.health.nokia.com'],
  ["Oura marketing", 'from:no-reply@m.ouraring.com'],
  ["Planet Cruise marketing", 'from:no-reply@email.planetcruise.com'],
  ["Postmates marketing", 'from:noreply@postmates.com'],
  ["Pura marketing", 'from:pura@em.pura.com'],
  ["Pura lifecycle marketing", 'from:pura@lc.pura.com'],
  ["RetailMeNot marketing", 'from:mail@mail.retailmenot.com'],
  ["Robinhood Snacks newsletter", 'from:noreply@robinhood.com'],
  ["Sconnie newsletter", 'from:newsletter@sconnie.com'],
  ["Shopify partner affiliate marketing", 'from:welovepartners@shopify.com'],
  ["StackSocial residual marketing mail", 'from:hi@mail.stackcommerce.com'],
  ["StackSocial residual marketing", 'from:hi@stacksocial.com'],
  ["Staples marketing connected", 'from:staples@connected.staples.com'],
  ["Staples marketing easy", 'from:staples@easy.staples.com'],
  ["SubiSpeed marketing residual", 'from:sales@subispeed.com subject:("Today\'s Deal")'],
  ["Tapatalk digest", 'from:trending@tapatalk.com'],
  ["Terrain marketing", 'from:terrain@s.shopterrain.com'],
  ["Weather Channel content", 'from:updates@news.weather.com'],
  ["Uber product marketing", 'from:email@et.uber.com'],
  ["Uber product marketing noreply", 'from:noreply@uber.com subject:"Arriving now"'],
  ["Uber Eats marketing secondary", 'from:ubereats@uber.com'],
  ["Visionworks marketing", 'from:visionworks@e.visionworks.com'],
  ["Woodcraft marketing", 'from:donotreply@woodcraft.com'],
];

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
console.log("V4.20 SHIPPING FOSSIL CLEANUP");
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
