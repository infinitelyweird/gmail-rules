/**
 * Declarative Gmail filtering policy.
 *
 * V4.1 is evidence-driven from the 10,000-message / 24-month inventory.
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
    query: 'subject:(dispute OR "legal notice" OR settlement OR claim) -subject:(newsletter OR offer OR sale)',
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
    query: 'subject:("backup status report" OR "backup completed" OR "successful backup")',
    archive: true,
  },
  {
    name: "Calendar agendas",
    label: "Low Priority/Automated Reports",
    query: 'from:calendar-notification@google.com subject:("daily agenda" OR "you have no events scheduled today")',
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
];
