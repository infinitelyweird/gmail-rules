/**
 * V4.21 shipping fossil cleanup — evidence-reviewed batch 3.
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

  // Batch 3: semantic shipping-word collisions from the 285-message residual.
  // Every query is sender/subject constrained; real transactional records are
  // now explained by V4.21 rules.js and are therefore automatically excluded.
  ["CareZone refill-delivery reminders", 'from:no-reply@carezone.com subject:"Get your refill"'],
  ["Air Filters Delivered subscription reconfirmation", 'from:support@airfiltersdelivered.com subject:"Reconfirm Your Filter Subscription Details"'],
  ["Air Filters Delivered recurring charge", 'from:support@airfiltersdelivered.com subject:"recurring order charge confirmation"'],
  ["Air Filters Delivered payment verification", 'from:support@airfiltersdelivered.com subject:"Verify your payment information"'],
  ["Pestie post-delivery reminders", 'from:hello@pestie.com subject:("still sitting around" OR "used your recent pestie shipment")'],
  ["eBay Fast N Free marketing", 'from:ebay@ebay.com subject:"can be delivered Fast N Free"'],
  ["Tophatter personalized marketing", 'from:noreply@tophatter.com subject:("Personalized deals delivered" OR "Personalized picks have been delivered")'],
  ["TurboTax non-shipping tracking content", 'from:TurboTax@e.turbotax.intuit.com'],
  ["Oliviers shipping-language marketing", 'from:customerservice@oliviersandco.com'],
  ["1-800 Contacts delivery marketing", 'from:email@email-1800contacts.com subject:"Stay in. Stay warm."'],
  ["Fisher Wallace tracking-language marketing", 'from:info@fisherwallace.com'],
  ["Ground News tracking-language newsletters", 'from:blindspot@ground-news.com'],
  ["Health Exec tracking-language newsletters", 'from:news@mail.healthexec.com'],
  ["Hemper delivered-language marketing", 'from:contact@hemper.co'],
  ["MatterHackers delivered-language content", 'from:support@matterhackers.com'],
  ["Comcast e-bill delivery failures", 'from:tsfcubillpay@southernonline.org'],
  ["AM.CO.ZA product-arrival marketing", 'from:updates@am.co.za'],
  ["Telerik software shipped announcement", 'from:sells.chris@telerik.com'],
  ["FragranceNet slogan marketing", 'from:info@email.fragrancenet.com subject:"Shopped. Shipped. Delivered."'],
  ["H&R Block refund tracking survey", 'from:onlinetaxes@hrblock.com'],
  ["Mann Lake pre-order marketing", 'from:noreply@mannlakeltd.com'],
  ["Morgan and Morgan delivered-language marketing", 'from:reply@reply.forthepeople.com'],
  ["Pokemon GO retail-arrival marketing", 'from:pokemongo@email.nianticlabs.com'],
  ["Nextdoor package conversation", 'from:reply@ss.email.nextdoor.com'],
  ["ripple delivered-language marketing", 'from:info@therippleco.com'],
  ["Steak n Shake delivery marketing", 'from:steaknshakerewards@rewards.steaknshake.com'],
  ["TLDR tracking-language newsletter", 'from:dan@tldrnewsletter.com'],
  ["Bank of America delivered-language marketing", 'from:bankofamerica@emcom.bankofamerica.com'],
  ["Best Egg credit-tracking marketing", 'from:financialhealth@email.bestegg.com'],
  ["Brew Tea arriving-soon marketing", 'from:hello@brewteacompany.co.uk'],
  ["Cardo Ride tracking feature marketing", 'from:newsletter@news.riserapp.com'],
  ["Carvana delivery marketing", 'from:customeradvocate@carvana.com'],
  ["Catholic Social Services arriving-soon appeal", 'from:hello@cssisus.org'],
  ["Circuit Specialists inventory arrival", 'from:newsletters@circuitspecialists.com'],
  ["CurlsCurls collection arrival marketing", 'from:service@curlscurls.com'],
  ["CVS ExtraCare delivery marketing", 'from:extracare@pharmacy.cvs.com'],
  ["CVS Pharmacy delivery marketing", 'from:pharmacy@pharmacy.cvs.com'],
  ["Dekanta product-arrival marketing", 'from:cs@dekanta.com'],
  ["DoorDash restaurant-name collision", 'from:no-reply@doordash.com subject:"Delivered Fresh Daily"'],
  ["Factor delivery marketing residual", 'from:No-reply@factor75.com'],
  ["Fox Theatre ticket delivery", 'from:foxguestrelations@foxtheatre.org'],
  ["Geekvape inventory shipping message", 'from:store@geekvape.com subject:"Inventory is low"'],
  ["Gofreecredit delivered-language marketing", 'from:gfc@2015onine-now.com'],
  ["Grassfire shipment-language campaign", 'from:alert@grassfire.net'],
  ["Vyond delivered-language product announcement", 'from:community@vyond.com'],
  ["Honeywell air-filter marketing", 'from:HoneywellHome@e.honeywellhome.com'],
  ["Hours time-tracking welcome", 'from:support@hourstimetracking.com'],
  ["Infinite Peripherals delivered-language marketing", 'from:marketingteam@ipcmobile.com'],
  ["Natures Garden company-name collision", 'from:info@ga.naturesgardendelivered.com'],
  ["Inkbox faster-shipping marketing", 'from:hi@e.inkbox.com'],
  ["iPad Pilot tracking-app newsletter", 'from:iPad@e.sportys.com'],
  ["Liberty Counsel delivered-language campaign", 'from:alert@lcaction.org'],
  ["Maneuvering the Middle tracking content", 'from:contact@maneuveringthemiddle.com'],
  ["Marcos Pizza delivered-language deal", 'from:noreply@marcos.com'],
  ["Sustain cycle-tracking content", 'from:meikah@sustainnatural.com'],
  ["Mellow Mushroom delivery marketing", 'from:MellowMushroom@mellowmushroom.fbmta.com'],
  ["Meta Horizon arriving-language notification", 'from:do_not_reply@email.meta.com'],
  ["Microsoft Store delivery marketing", 'from:Microsoftstore@microsoftstore.microsoft.com'],
  ["Naturisimo arriving-soon marketing", 'from:news@naturisimo.com'],
  ["Naymz visitor tracking alert", 'from:app@naymz.com'],
  ["Nurx treatment-delivery marketing", 'from:engagements@marketing.nurx.com'],
  ["Oliver Thomas instant-delivery gift marketing", 'from:ollie@theoliverthomas.com'],
  ["PODS vehicle-shipping marketing", 'from:PODS@e.pods.com'],
  ["PolarX delivered-language marketing", 'from:info@polarxornaments.com'],
  ["QuickBooks mileage tracking feature", 'from:intuithealth@e.intuithealth.com'],
  ["realbuzz delivered-language newsletter", 'from:info@realbuzz.com'],
  ["Retool tracking-language developer content", 'from:info@retool.com'],
  ["Route holiday tracking marketing", 'from:noreply@hello.route.com'],
  ["ScoreMore rewards arriving marketing", 'from:noreply@scoremorerewards.com'],
  ["Simple Living review request", 'from:6yl17vcwjw7dpk7@marketplace.amazon.com subject:"Tell us how we did"'],
  ["Special Promotions shipment bait", 'from:contact@pr.morristownagreement.com'],
  ["Stadia delivered-language game announcement", 'from:stadia-noreply@google.com'],
  ["Strikeman progress tracking content", 'from:support@strikeman.io'],
  ["Super Chewer free-gift marketing", 'from:scout@woof.barkbox.com'],
  ["DreamFactory tracking-data content", 'from:susanna.bouse@dreamfactory.com'],
  ["Temu local-warehouse marketing", 'from:email@market.temuemail.com'],
  ["Dua Brand delivered-language marketing", 'from:support@theduabrand.com'],
  ["Futurist delivery-language newsletter", 'from:email@email.getthefuturist.com'],
  ["SoFi Daily delivered-language newsletter", 'from:SoFi@daily.sofi.com'],
  ["Telerik release shipped announcement", 'from:progresssoftware@businessmaking.progress.net'],
  ["Week Ahead tracking-language newsletter", 'from:theweekahead@tryshift.com'],
  ["ThinkGeek tracking-language marketing", 'from:overlords@email.thinkgeek.com'],
  ["Ubuy delivered-language marketing", 'from:no-reply@ubuycnt.com'],
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
console.log("V4.21 SHIPPING FOSSIL CLEANUP");
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