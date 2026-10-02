/**
 * Declarative Gmail filtering policy.
 *
 * Keep WHAT Gmail should do here and HOW it is installed in
 * gmail-organizer.js. This makes future rule reviews much easier.
 *
 * Fields:
 *   name      Human-readable name shown by --plan.
 *   label     Gmail label applied to matching messages.
 *   query     Gmail search syntax used as filter criteria.
 *   archive   true removes INBOX; false leaves the message visible.
 *   important true also adds Gmail's IMPORTANT system label.
 *
 * Philosophy: Inbox is for attention. Routine records are labeled + archived;
 * exceptions and time-sensitive messages stay visible.
 *
 * Gmail filters are independent, so one message can match multiple rules.
 * Broad queries should therefore be treated carefully.
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
    query: 'subject:("bill needs attention" OR "payment due" OR "upcoming payment due" OR "past due" OR overdue OR "payment failed" OR "payment declined")',
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
  // Normal shipping updates are records; exceptions remain visible below.
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
  // Successful payments archive; failed/overdue payments are excluded so the
  // Bills requiring attention rule can keep them visible.
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
    query: 'subject:("daily agenda" OR "you have no events scheduled today")',
    archive: true,
  },
];
