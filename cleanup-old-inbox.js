/**
 * V4.30 old Inbox cleanup — preview first.
 * Applies only to pre-2026 Inbox messages matched by explicit evidence-reviewed
 * queries. --apply --yes required. Nothing is permanently deleted.
 */
import { google } from "googleapis";
import { getAuth } from "./auth.js";

const APPLY = process.argv.includes("--apply");
const YES = process.argv.includes("--yes");
const auth = await getAuth();
const gmail = google.gmail({ version: "v1", auth });
const OLD = "in:inbox before:2026/01/01 -in:trash -in:spam";

const actions = [
  // Unmistakable stale social/marketing noise.
  { name:"stayclkd PM/social notifications", q:"from:stayclkd.com", trash:true },
  { name:"myclkd story notifications", q:"from:myclkd.email", trash:true },
  { name:"Pinterest recommendations", q:"from:recommendations@discover.pinterest.com", trash:true },
  { name:"PlushCare marketing", q:'from:hello@info.plushcare.com subject:"Keeping your family healthy"', trash:true },
  { name:"unsolicited recruiter", q:'from:anshuman4@votoconsulting.com subject:"Urgent Hiring"', trash:true },

  // Routine automated history: preserve, label, archive.
  { name:"Monarch routine alerts", q:"from:email@email.monarchmoney.com", label:"Low Priority/Automated Reports", archive:true },
  { name:"Deep South route schedules", q:"from:netcomm@trashbilling.com", label:"Low Priority/Automated Reports", archive:true },
  { name:"IDrive verification codes", q:"from:support@send.idrive.com", label:"Action/Security", archive:true },
  { name:"Starlink verification codes", q:"from:no-reply@starlink.com", label:"Action/Security", archive:true },
  { name:"UPS identity verification", q:"from:accountconfirm@ups.com", label:"Action/Security", archive:true },
  { name:"Bambu verification codes", q:"from:noreply@bambulab.com", label:"Action/Security", archive:true },
  { name:"Broadcom password/verification", q:"{from:selfregistration.no-reply@broadcom.com from:customersupport@broadcom.com}", label:"Action/Security", archive:true },
  { name:"WordPress password resets", q:"from:donotreply@wordpress.com", label:"Action/Security", archive:true },
  { name:"AliExpress verification codes", q:"from:account@notice.aliexpress.com", label:"Action/Security", archive:true },
  { name:"medical/account OTPs", q:"{from:patientportal@colquittregional.com from:no-reply@khealth.com from:no-reply@goodrx.com}", label:"Action/Security", archive:true },

  // Consequential records: preserve under durable labels and archive stale history.
  { name:"Apple account security history", q:"from:appleid@id.apple.com", label:"Action/Security", archive:true },
  { name:"Bank of America alerts", q:"from:onlinebanking@ealerts.bankofamerica.com", label:"Finance/Statements", archive:true },
  { name:"Progressive policy/payment records", q:"from:customerservice@e.progressive.com", label:"Finance/Statements", archive:true },
  { name:"Experian credit alerts", q:"from:support@s.usa.experian.com", label:"Finance/Credit Alerts", archive:true },
  { name:"Dave financial records", q:"{from:dave@mail.dave.com from:no-reply@dave.com}", label:"Finance/Payments", archive:true },
  { name:"Five Lakes correspondence", q:"from:clientsuccess@fivelakeslawgroup.com", label:"Action/Legal & Disputes", archive:true },
  { name:"self-sent Five Lakes threads", q:'from:dustin.flegel@gmail.com {subject:"Avant Debt" subject:"Auto Pay"}', label:"Action/Legal & Disputes", archive:true },
  { name:"Verizon billing/account records", q:"from:vzwmail@ecrmemail.verizonwireless.com", label:"Finance/Payments", archive:true },
  { name:"PNC statements", q:"from:pncbankcardstatements@pnc.com", label:"Finance/Statements", archive:true },
  { name:"Apple Card records", q:"{from:no_reply@post.applecard.apple from:no_reply@post-account.applecard.apple}", label:"Finance/Statements", archive:true },
  { name:"credit-union statements", q:"{from:edocuments@acuonline.org from:estatements@southernonline.org}", label:"Finance/Statements", archive:true },
  { name:"Windstream bill", q:"from:windstream.e-billing@windstream.com", label:"Action/Bills Due", archive:true },
  { name:"Avant failed payment", q:"from:support@avant.com", label:"Action/Bills Due", archive:true },
  { name:"GoodLeap payment instruction", q:"from:goodleap_no_reply@billerpayments.com", label:"Finance/Payments", archive:true },
  { name:"Fidelity account alerts", q:"from:fidelity.alerts@fidelity.com", label:"Action/Security", archive:true },
  { name:"Login.gov security", q:"from:no-reply@login.gov", label:"Action/Security", archive:true },
  { name:"CEX failed login", q:"from:noreply@cex.io", label:"Action/Security", archive:true },
  { name:"medical correspondence/records", q:"{from:drdavis@pbhonline.com from:team@pockethealth.com}", label:"Action/Medical", archive:true },

  // Previously classified delivery exceptions that are simply stale in Inbox.
  { name:"Air Filters account problems", q:"from:support@airfiltersdelivered.com", label:"Action/Account Problems", archive:true },
  { name:"Vetsource delivery problems", q:"from:homedelivery@vetsource.com", label:"Action/Delivery Problems", archive:true },
  { name:"Comcast e-bill failures", q:"from:tsfcubillpay@southernonline.org", label:"Action/Bills Due", archive:true },
  { name:"FastTech cancelled shipment", q:"from:support@fasttech.com", label:"Action/Delivery Problems", archive:true },
  { name:"Tophatter shipment action", q:"from:noreply@tophatter.com", label:"Action/Delivery Problems", archive:true },
  { name:"Mysterious Package disruption", q:"from:concierge@mysteriouspackage.com", label:"Action/Delivery Problems", archive:true },
  { name:"Amazon unconfirmed shipment", q:"from:payments-messages@amazon.com", label:"Action/Delivery Problems", archive:true },
];

async function ids(q) {
  const out=[]; let pageToken;
  do {
    const r=await gmail.users.messages.list({userId:"me",q:`${OLD} ${q}`,maxResults:500,pageToken});
    out.push(...(r.data.messages||[]).map(m=>m.id)); pageToken=r.data.nextPageToken;
  } while(pageToken);
  return out;
}
async function labelId(name) {
  const r=await gmail.users.labels.list({userId:"me"});
  const found=(r.data.labels||[]).find(l=>l.name===name);
  if(!found) throw new Error(`Missing Gmail label: ${name}`);
  return found.id;
}
const plans=[];
for(const a of actions) plans.push({...a, ids:await ids(a.q)});
console.log("V4.30 OLD INBOX CLEANUP");
console.log(`MODE: ${APPLY&&YES?"APPLY":"PREVIEW"}`);
let total=0;
for(const p of plans){ total+=p.ids.length; console.log(String(p.ids.length).padStart(4), p.trash?"TRASH":"ARCHIVE", p.name); }
console.log(`\nMatched old-Inbox messages: ${total}`);
if(!(APPLY&&YES)){console.log("NO MESSAGES CHANGED. Add --apply --yes to execute.");process.exit(0);}
for(const p of plans){
  const current=await ids(p.q); if(!current.length) continue;
  if(p.trash){
    for(const id of current) await gmail.users.messages.trash({userId:"me",id});
  } else {
    const addLabelIds=p.label?[await labelId(p.label)]:[];
    const removeLabelIds=p.archive?["INBOX"]:[];
    await gmail.users.messages.batchModify({userId:"me",requestBody:{ids:current,addLabelIds,removeLabelIds}});
  }
}
console.log("V4.30 execution complete. No messages permanently deleted.");
