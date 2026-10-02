/**
 * Declarative Gmail filtering policy.
 *
 * V4.5 is evidence-driven from the 10,000-message / 24-month inventory.
 *
 * Fields:
 *   name       Human-readable name shown by --plan.
 *   label      Gmail label applied to matching messages. Optional for trash.
 *   query      Gmail search/filter query.
 *   archive    Remove INBOX.
 *   important  Add IMPORTANT.
 *   trash      Move matching future messages to Trash.
 *
 * SAFETY:
 * - Blanket sender trash rules are used only for addresses whose inventory
 *   samples were consistently promotional/newsletter traffic.
 * - Transactional addresses from the same brands are intentionally separate.
 * - Mixed financial, medical, security, legal and travel senders are not
 *   blanket-trashed.
 */
export const rules = [
  {
    name: "Security alerts",
    label: "Action/Security",
    query: 'subject:("security alert" OR "new login" OR "new sign-in" OR "suspicious activity" OR "unusual activity" OR "password reset" OR "verification code" OR "account recovered")',
    archive: false,
    important: true,
  },
  {
    name: "Bills requiring attention",
    label: "Action/Bills Due",
    query: 'subject:("bill needs attention" OR "payment due" OR "upcoming payment due" OR "past due" OR overdue OR "payment failed" OR "payment declined" OR "payment was not successful")',
    archive: false,
    important: true,
  },
  {
    name: "Disputes/legal action",
    label: "Action/Legal & Disputes",
    query: 'subject:(dispute OR "legal notice" OR settlement OR "legal claim" OR "insurance claim" OR "claim number" OR "claim status" OR "claim filed") -subject:(newsletter OR offer OR sale)',
    archive: false,
    important: true,
  },
  {
    name: "Shipping routine",
    label: "Purchases/Shipping",
    query: 'subject:(shipped OR shipment OR delivered OR "out for delivery" OR tracking OR arriving) -subject:(exception OR delayed OR problem OR failed OR missing)',
    archive: true,
  },
  {
    name: "Shipping exceptions",
    label: "Action/Delivery Problems",
    query: 'subject:("delivery exception" OR delayed OR "delivery problem" OR "package missing" OR "could not deliver")',
    archive: false,
    important: true,
  },
  {
    name: "Payment confirmations",
    label: "Finance/Payments",
    query: 'subject:("payment confirmation" OR "payment received" OR "payment has been posted" OR "receipt for payment" OR "payment successful") -subject:(failed OR declined OR overdue OR "past due")',
    archive: true,
  },
  {
    name: "Statements",
    label: "Finance/Statements",
    query: 'subject:("statement is here" OR "statement is now available" OR "statement available" OR "statement ready" OR "monthly statement")',
    archive: true,
  },
  {
    name: "Backup reports",
    label: "Services/Backup Reports",
    query: 'subject:("backup status report" OR "backup completed" OR "successful backup") -subject:(failed OR failure OR error OR unsuccessful OR incomplete)',
    archive: true,
  },
  {
    name: "Calendar agendas",
    label: "Low Priority/Automated Reports",
    query: 'from:calendar-notification@google.com subject:("daily agenda" OR "you have no events scheduled today")',
    archive: true,
  },

  // Phase 2: mixed senders. These rules are deliberately sender + subject
  // specific so routine traffic cannot suppress an exception from the same
  // company. Gmail filters are independent, so routine rules explicitly
  // exclude the exception vocabulary where needed.
  {
    name: "IDrive backup failures",
    label: "Action/Backup Problems",
    query: 'from:no-reply@backupstatus.idrive.com subject:(failed OR failure OR error OR unsuccessful OR incomplete)',
    archive: false,
    important: true,
  },
  {
    name: "IDrive routine backup reports",
    label: "Services/Backup Reports",
    query: 'from:no-reply@backupstatus.idrive.com -subject:(failed OR failure OR error OR unsuccessful OR incomplete)',
    archive: true,
  },
  {
    name: "Progressive action required",
    label: "Action/Bills Due",
    query: 'from:customerservice@e.progressive.com subject:("payment due" OR "bill available" OR renewal OR "policy document" OR "payment failed" OR "payment declined")',
    archive: false,
    important: true,
  },
  {
    name: "Progressive payment confirmations",
    label: "Finance/Payments",
    query: 'from:customerservice@e.progressive.com subject:("payment confirmation" OR "payment received" OR "payment posted")',
    archive: true,
  },
  {
    name: "Chase security and payment problems",
    label: "Action/Security",
    query: 'from:no.reply.alerts@chase.com subject:("new device" OR verification OR "payment failed" OR "payment declined" OR "was not successful")',
    archive: false,
    important: true,
  },
  {
    name: "Chase routine statements and scheduled payments",
    label: "Finance/Statements",
    query: 'from:no.reply.alerts@chase.com subject:(statement OR "scheduled payment") -subject:(failed OR declined OR unsuccessful)',
    archive: true,
  },
  {
    name: "BrightWay action required",
    label: "Action/Bills Due",
    query: 'from:onemain_brightway@mail36.onemaincreditcards.com subject:(unsuccessful OR failed OR declined OR verification OR "action required")',
    archive: false,
    important: true,
  },
  {
    name: "BrightWay routine statements and payments",
    label: "Finance/Statements",
    query: 'from:onemain_brightway@mail36.onemaincreditcards.com subject:(statement OR "payment posted" OR "payment received") -subject:(unsuccessful OR failed OR declined)',
    archive: true,
  },
  {
    name: "Experian security and credit alerts",
    label: "Finance/Credit Alerts",
    query: 'from:support@s.usa.experian.com subject:(alert OR freeze OR "new device" OR "sign-in" OR verification OR suspicious)',
    archive: false,
    important: true,
  },
  {
    name: "TransUnion credit alerts",
    label: "Finance/Credit Alerts",
    query: 'from:hello@alerts.transunion.com subject:(alert OR change OR "new account" OR inquiry OR suspicious)',
    archive: false,
    important: true,
  },
  {
    name: "WageWorks account action",
    label: "Action/Account Problems",
    query: 'from:servicenotice@wageworks.com',
    archive: false,
    important: true,
  },
  {
    name: "InDebted account action",
    label: "Action/Bills Due",
    query: 'from:customersupport-us@indebted.co',
    archive: false,
    important: true,
  },
  {
    name: "Five Lakes legal and debt action",
    label: "Action/Legal & Disputes",
    query: 'from:clientsuccess@fivelakeslawgroup.com',
    archive: false,
    important: true,
  },
  {
    name: "Google One storage warnings",
    label: "Action/Account Problems",
    query: 'from:googleone-noreply@google.com subject:(storage OR full OR limit OR capacity)',
    archive: false,
    important: true,
  },
  {
    name: "Amazon order updates",
    label: "Purchases/Shipping",
    query: 'from:order-update@amazon.com -subject:(problem OR failed OR cancelled OR canceled OR delayed OR missing)',
    archive: true,
  },
  {
    name: "Walmart order and delivery updates",
    label: "Purchases/Shipping",
    query: 'from:help@walmart.com subject:(order OR shipped OR delivered OR delivery OR pickup) -subject:(problem OR failed OR cancelled OR canceled OR delayed OR missing)',
    archive: true,
  },

  // High-confidence promotional/newsletter addresses from the 10K inventory.
  // These rules affect FUTURE mail only. Historical cleanup is a separate pass.
  {
    name: "Promo — Lowe's marketing",
    query: "from:lowes@e.lowes.com",
    trash: true,
  },
  {
    name: "Promo — Best Buy marketing",
    query: "from:bestbuy@email.bestbuy.com",
    trash: true,
  },
  {
    name: "Promo — Etsy marketing",
    query: "from:email@email.etsy.com",
    trash: true,
  },
  {
    name: "Promo — Bed Bath & Beyond marketing",
    query: "from:email@promotion.bedbathandbeyond.com",
    trash: true,
  },
  {
    name: "Promo — RevZilla marketing",
    query: "from:revzilla@email.revzilla.com",
    trash: true,
  },
  {
    name: "Promo — Good Chop marketing",
    query: "from:hello@g.goodchop.com",
    trash: true,
  },
  {
    name: "Promo — Academy marketing",
    query: "from:email@e.academy.com",
    trash: true,
  },
  {
    name: "Promo — NewsBreak newsletter",
    query: "from:newsletter@newsbreakpost.com",
    trash: true,
  },
  {
    name: "Promo — 1-800-Flowers marketing",
    query: "from:flowers@em.1800flowers.com",
    trash: true,
  },
  {
    name: "Promo — Home Depot marketing",
    query: "from:homedepotcustomercare@mg.homedepot.com",
    trash: true,
  },
  {
    name: "Promo — Fandango at Home marketing",
    query: "from:fandangoathome@movies.fandango.com",
    trash: true,
  },
  {
    name: "Promo — Sleep Number marketing",
    query: "from:sleepnumber@mailreply.sleepnumber.com",
    trash: true,
  },
  {
    name: "Promo — Food Lion marketing",
    query: "from:customerservice@reply.foodlionemail.com",
    trash: true,
  },
  {
    name: "Promo — Advance Auto marketing",
    query: "from:advanceauto@email-advanceautoparts.com",
    trash: true,
  },
  {
    name: "Promo — eBay marketing",
    query: "from:ebay@reply.ebay.com",
    trash: true,
  },
  {
    name: "Promo — AutoZone marketing",
    query: "from:autozone@em.autozone.com",
    trash: true,
  },
  {
    name: "Promo — Govee newsletter",
    query: "from:newsletter@govee.com",
    trash: true,
  },
  {
    name: "Promo — Quest Diagnostics promotions",
    query: "from:promo@e.questdiagnostics.com",
    trash: true,
  },
  {
    name: "Promo — Reolink newsletter",
    query: "from:newsletter@mail.reolinksupport.com",
    trash: true,
  },
  {
    name: "Promo — Micro Center marketing",
    query: "from:microcenter@email.microcenter.com",
    trash: true,
  },

  // Phase 3: additional high-confidence bulk/newsletter senders from the same
  // 10K inventory. Mixed financial/travel senders remain intentionally excluded.
  {
    name: "Promo — UKLASH marketing",
    query: "from:mail@uklash.com",
    trash: true,
  },
  {
    name: "Promo — Extreme Restraints newsletter",
    query: "from:newsletter@extremerestraints.com",
    trash: true,
  },
  {
    name: "Promo — USA Today Daily Briefing",
    query: "from:dailybriefing@reply.usatoday.com",
    trash: true,
  },
  {
    name: "Promo — Oh My Cream marketing",
    query: "from:contact@ohmycream.com",
    trash: true,
  },
  {
    name: "Promo — History Facts newsletter",
    query: "from:hello@historyfacts.com",
    trash: true,
  },
  {
    name: "Promo — InboxDollars paid email",
    query: "from:paidemail@inboxdollars.com",
    trash: true,
  },
  {
    name: "Promo — Smoke Cartel marketing",
    query: "from:hello@smokecartel.com",
    trash: true,
  },
  {
    name: "Promo — AcuRite marketing",
    query: "from:marketing@sky.acurite.com",
    trash: true,
  },
  {
    name: "Promo — XEOX newsletter",
    query: "from:newsletter@xeox.com",
    trash: true,
  },
  {
    name: "Promo — HBO Max marketing",
    query: "from:hbomax@mail.hbomax.com",
    trash: true,
  },
  {
    name: "Promo — Redline360 marketing",
    query: "from:support@redline360.com",
    trash: true,
  },
];
