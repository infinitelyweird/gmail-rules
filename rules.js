/**
 * Declarative Gmail filtering policy.
 *
 * V4.14.0 is evidence-driven from the 10,000-message / 24-month inventory.
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
    query: 'subject:("has shipped" OR "have shipped" OR "was shipped" OR "shipping confirmation" OR "shipment update" OR "out for delivery" OR "has been delivered" OR "was delivered" OR "package delivered" OR "order delivered" OR "tracking number") -subject:(exception OR delayed OR problem OR failed OR missing)',
    archive: true,
  },
  {
    name: "Shipping exceptions",
    label: "Action/Delivery Problems",
    query: 'subject:("delivery exception" OR "delivery delayed" OR "shipment delayed" OR "package delayed" OR "delivery problem" OR "package missing" OR "could not deliver")',
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
    query: 'from:autozone@em.autozone.com -subject:"verification code"',
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
  // Phase 4: another evidence-reviewed batch from sender-inventory.json.
  // These addresses were consistently bulk/newsletter traffic in the samples.
  {
    name: "Promo — Threadloom forum digest",
    query: "from:digest@vesta.threadloom.news",
    trash: true,
  },
  {
    name: "Promo — Lorraine Lea marketing",
    query: "from:noreply@lorrainelea.com",
    trash: true,
  },
  {
    name: "Promo — DENALI Electronics marketing",
    query: "from:info@denalielectronics.com",
    trash: true,
  },
  {
    name: "Promo — CORSAIR marketing",
    query: "from:corsair@updates.corsair.com",
    trash: true,
  },
  {
    name: "Promo — STLFLIX newsletter",
    query: "from:info@stlflix.com",
    trash: true,
  },
  {
    name: "Promo — Motorcycle.com newsletter",
    query: "from:newsletter@em.motorcycle.com",
    trash: true,
  },
  {
    name: "Promo — ResetSmile marketing",
    query: "from:support@resetsmile.com",
    trash: true,
  },
  {
    name: "Promo — Cove Smart offers",
    query: "from:offers@covesmart.com",
    trash: true,
  },
  {
    name: "Promo — Nood marketing",
    query: "from:hello@trynood.com",
    trash: true,
  },
  {
    name: "Promo — Calm newsletter",
    query: "from:hello@breathe.calm.com",
    trash: true,
  },
  {
    name: "Promo — Shari's Berries marketing",
    query: "from:berries@em.berries.com",
    trash: true,
  },
  {
    name: "Promo — Ollama updates",
    query: "from:hello@ollama.com",
    trash: true,
  },
  {
    name: "Promo — Netflix recommendations",
    query: "from:info@members.netflix.com",
    trash: true,
  },
  {
    name: "Promo — Facer newsletter",
    query: "from:hello@facer.io",
    trash: true,
  },
  {
    name: "Promo — Ticketmaster Center Stage",
    query: "from:centerstage@engage.ticketmaster.com",
    trash: true,
  },
  {
    name: "Promo — FRAME marketing",
    query: "from:marketing@e.frame-store.com",
    trash: true,
  },
  {
    name: "Promo — Living Simply newsletter",
    query: "from:hello@livingsimply.com",
    trash: true,
  },
  {
    name: "Promo — Instagram notifications",
    query: "from:no-reply@mail.instagram.com",
    trash: true,
  },
  {
    name: "Promo — Macorner marketing",
    query: "from:no-reply@macorner.co",
    trash: true,
  },

  // Phase 5: conservative sender-wide bulk rules. Transactional/security
  // addresses for these brands remain separate where observed.
  {
    name: "Promo — Peacock programming",
    query: "from:hello@email.peacocktv.com",
    trash: true,
  },
  {
    name: "Promo — Instacart marketing",
    query: "from:no-reply@customers.instacartemail.com",
    trash: true,
  },
  {
    name: "Promo — Wilt Clothing marketing",
    query: "from:info@wiltclothing.com",
    trash: true,
  },
  {
    name: "Promo — Weather Channel Weekly Brief",
    query: "from:weeklybrief@news.weather.com",
    trash: true,
  },
  {
    name: "Promo — Afterpay marketing",
    query: "from:afterpay@nanews.e.afterpay.com",
    trash: true,
  },
  {
    name: "Promo — Survival First Aid Kits marketing",
    query: "from:hello@email.survivalfirstaidkits.net.au",
    trash: true,
  },
  {
    name: "Promo — Euhomy TikTok Shop marketing",
    query: "from:euhomy@tiktokshop.com",
    trash: true,
  },

  // Phase 6: evidence-reviewed retail/content bulk senders from the 10K inventory.
  // Financial, account, medical, shipping and mixed loyalty senders remain excluded.
  {
    name: "Promo — Ruggable marketing",
    query: "from:info@ruggable.com",
    trash: true,
  },
  {
    name: "Promo — Wiggins Hair marketing",
    query: "from:tg@wigginshair.com",
    trash: true,
  },
  {
    name: "Promo — Insta360 news",
    query: "from:hey@insta360-news.com",
    trash: true,
  },
  {
    name: "Promo — MotoLoot marketing",
    query: "from:chris@motoloot.com",
    trash: true,
  },
  {
    name: "Promo — Circle K Inner Circle marketing",
    query: "from:innercircle@em.circlek.com",
    trash: true,
  },
  {
    name: "Promo — Cracker Barrel marketing",
    query: "from:crackerbarrelnews@email.crackerbarrel.com",
    trash: true,
  },
  {
    name: "Promo — GoodRx marketing",
    query: "from:no-reply@contact.goodrx.com",
    trash: true,
  },
  {
    name: "Promo — Cub Cadet marketing",
    query: "from:cubcadet@info.cubcadet.com",
    trash: true,
  },
  {
    name: "Promo — Artlist newsletter",
    query: "from:team@newsletter.artlist.io",
    trash: true,
  },
  {
    name: "Promo — CollX newsletter",
    query: "from:newsletter@collx.app",
    trash: true,
  },
  {
    name: "Promo — OpenTable recommendations",
    query: "from:opentable@mgs.opentable.com",
    trash: true,
  },
  {
    name: "Promo — Lumosity newsletter",
    query: "from:newsletter@notifications.lumosity.com",
    trash: true,
  },
  {
    name: "Promo — Agriline marketing",
    query: "from:sales@agrilineproducts.com",
    trash: true,
  },
  {
    name: "Promo — HP Academy marketing",
    query: "from:andre.simon@hpacademy.com",
    trash: true,
  },
  {
    name: "Promo — VEVOR marketing",
    query: "from:marketing@ora.vevor.com",
    trash: true,
  },
  {
    name: "Promo — Suitsupply newsletter",
    query: "from:newsletter@message.suitsupply.com",
    trash: true,
  },
  {
    name: "Promo — Blaze Pizza marketing",
    query: "from:no_reply@blazepizza.com",
    trash: true,
  },
  {
    name: "Promo — Ruggable newsletter",
    query: 'from:newsletters@ruggable.com -subject:("has shipped" OR "have shipped" OR "was shipped" OR "shipping confirmation" OR "shipment update" OR "out for delivery" OR "has been delivered" OR "was delivered" OR "package delivered" OR "order delivered" OR "tracking number")',
    trash: true,
  },
  {
    name: "Promo — Kickresume marketing",
    query: "from:tomas@kickresume.com",
    trash: true,
  },
  {
    name: "Promo — Cardo marketing",
    query: "from:cardomarketing@cardosystems.com",
    trash: true,
  },
  {
    name: "Promo — Monster Fairings marketing",
    query: "from:info@monsterfairings.com",
    trash: true,
  },

  // Phase 7: lower-volume evidence-reviewed promotional/content senders.
  {
    name: "Promo — HP Academy Ben",
    query: "from:ben@hpacademy.com",
    trash: true,
  },
  {
    name: "Promo — Inslogic 3D marketing",
    query: "from:info@inslogic3d.com",
    trash: true,
  },
  {
    name: "Promo — iHeart newsletter",
    query: 'from:newsletters@e.iheart.com -subject:(dispute OR "legal notice" OR settlement OR "legal claim" OR "insurance claim" OR "claim number" OR "claim status" OR "claim filed")',
    trash: true,
  },
  {
    name: "Promo — Hard Rock Biloxi offers",
    query: "from:offers@e.hardrock-biloxi.com",
    trash: true,
  },
  {
    name: "Promo — SociableKIT marketing",
    query: 'from:support@sociablekit.com -subject:(security OR "security alert" OR "new sign-in" OR "new login" OR "login attempt" OR "verification code" OR "one-time code" OR password OR "account locked" OR "suspicious activity")',
    trash: true,
  },
  {
    name: "Promo — OfferUp newsletter",
    query: "from:news@discover.offerup.com",
    trash: true,
  },
  {
    name: "Promo — Apartment List recommendations",
    query: "from:info@emp.apartmentlist.com",
    trash: true,
  },
  {
    name: "Promo — StayCloaked newsletter",
    query: "from:newsletter.again.game.loud@staycloaked.com",
    trash: true,
  },
  {
    name: "Promo — Hills Food Stores weekly ads",
    query: "from:hills1@hillsfoodstores.com",
    trash: true,
  },
  {
    name: "Promo — Shopify 3D printing store marketing",
    query: "from:store+15265071190@g.shopifyemail.com",
    trash: true,
  },
  {
    name: "Promo — Hero Forge news",
    query: "from:news@heroforge.com",
    trash: true,
  },
  {
    name: "Promo — NVIDIA gaming newsletter",
    query: "from:gaming@nvgaming.nvidia.com",
    trash: true,
  },
  {
    name: "Promo — Subaru Outback forum mail",
    query: "from:noreply@mail.subaruoutback.org",
    trash: true,
  },
  {
    name: "Promo — Sophos news",
    query: "from:news@sophos.com",
    trash: true,
  },
  {
    name: "Promo — Scribd recommendations",
    query: "from:hello@hello.scribd.com",
    trash: true,
  },
  {
    name: "Promo — Canna Style marketing",
    query: "from:info@shopcannastyle.com",
    trash: true,
  },
  {
    name: "Promo — Radium Auto news",
    query: "from:press-radiumauto.com@shared1.ccsend.com",
    trash: true,
  },
  {
    name: "Promo — O'Reilly rewards marketing",
    query: "from:orewards@email.oreillyauto.com",
    trash: true,
  },
  {
    name: "Promo — Coinbase marketing",
    query: "from:info@mail.coinbase.com",
    trash: true,
  },
  {
    name: "Promo — Nintendo news",
    query: "from:nintendo-noreply@nintendo.net",
    trash: true,
  },
  {
    name: "Promo — GNC PRO marketing",
    query: "from:gnc@gnc.gnc.com",
    trash: true,
  },
  {
    name: "Promo — Audials news",
    query: "from:news@audials.com",
    trash: true,
  },
  {
    name: "Promo — Paramount Plus marketing",
    query: "from:contact@email.paramountplus.com",
    trash: true,
  },
  {
    name: "Promo — Thangs user updates",
    query: "from:thangs-user-updates@thangs.com",
    trash: true,
  },
  {
    name: "Promo — Delta marketing",
    query: "from:deltaairlines@o.delta.com",
    trash: true,
  },
  {
    name: "Promo — EZContacts marketing",
    query: "from:info@ezcontacts.com",
    trash: true,
  },

  // Phase 8: low-volume, high-confidence promotional/newsletter senders.
  { name: "Promo — US News offers", query: "from:updates@send-m.usnews.com", trash: true },
  { name: "Promo — FrontRunners newsletter", query: "from:hello@frontrunners.ca", trash: true },
  { name: "Promo — Sorcerics Kickstarter updates", query: "from:business@sorcerics.com", trash: true },
  { name: "Promo — PIA marketing", query: "from:info@news.privateinternetaccess.com", trash: true },
  { name: "Promo — No Compromise Gaming marketing", query: "from:hello@nocompromisegaming.com", trash: true },
  { name: "Promo — Evasive Motorsports marketing", query: "from:sales@evasivemotorsports.com", trash: true },
  { name: "Promo — Chewy marketing", query: "from:chewy@paws.chewy.com", trash: true },
  { name: "Promo — Ultimate Guitar offers", query: "from:info@mail.ultimate-guitar.com", trash: true },
  { name: "Promo — Yuka newsletter", query: "from:hello@yuka.io", trash: true },
  { name: "Promo — Hone Health newsletter", query: "from:newsletter@honehealth.com", trash: true },
  { name: "Promo — Trust & Will marketing", query: "from:support@em.trustandwill.com", trash: true },
  { name: "Promo — Temple St. Clair newsletter", query: "from:no-reply@templestclair.com", trash: true },
  { name: "Promo — MotoLoot reviews", query: "from:crew@motoloot.com", trash: true },
  { name: "Promo — Progress product marketing", query: "from:progress@products.progress.com", trash: true },
  { name: "Promo — Valley Hive events", query: "from:info@thevalleyhive.com", trash: true },
  { name: "Promo — VEVOR secondary marketing", query: "from:marketing@ses.vevor.com", trash: true },
  { name: "Promo — RevZilla Sailthru marketing", query: "from:revzilla@mail.sailthru.com", trash: true },
  { name: "Promo — EMCRA newsletter", query: "from:info@emcra.eu", trash: true },
  { name: "Promo — LiveScribe marketing", query: "from:marketing@email.livescribe.com", trash: true },
  { name: "Promo — Frontier deals", query: "from:deals@mkt.flyfrontier.com", trash: true },
  { name: "Promo — Holgates marketing", query: "from:marketing@holgates.co.uk", trash: true },
  { name: "Promo — Georgia Renaissance Festival", query: "from:info@garenfest.com", trash: true },
  { name: "Promo — Throttle Tiger marketing", query: 'from:support@throttletiger.com -subject:("has shipped" OR "have shipped" OR "was shipped" OR "shipping confirmation" OR "shipment update" OR "out for delivery" OR "has been delivered" OR "was delivered" OR "package delivered" OR "order delivered" OR "tracking number")', trash: true },
  { name: "Promo — MAGFAST marketing", query: "from:hello@magfast.com", trash: true },
  { name: "Promo — Steve Madden Mexico marketing", query: "from:info@send.stevemadden.com.mx", trash: true },
  { name: "Promo — Winn-Dixie offers", query: "from:reply@mail.winndixie.com", trash: true },
  { name: "Promo — LittleForBig releases", query: "from:service@littleforbig.com", trash: true },

  // Phase 9: deep-tail, high-confidence promotional/newsletter senders.
  { name: "Promo — Submagic product marketing", query: "from:support@submagic.co", trash: true },
  { name: "Promo — 1-800-Flowers birthday reminders", query: "from:1800flowers@em.1800flowers.com", trash: true },
  { name: "Promo — Runway Room marketing", query: "from:info@rr.runwayroom.com", trash: true },
  { name: "Promo — PYH Shopify marketing (m)", query: "from:store+60968271962@m.shopifyemail.com", trash: true },
  { name: "Promo — Cycle Gear Sailthru", query: "from:cyclegear@mail.sailthru.com", trash: true },
  { name: "Promo — Honda Powersports marketing", query: "from:powersports@em.honda.com", trash: true },
  { name: "Promo — PYH Shopify marketing (g)", query: "from:store+60968271962@g.shopifyemail.com", trash: true },
  { name: "Promo — Star Wars newsletter", query: "from:starwars@e.lucasfilm.com", trash: true },
  { name: "Promo — VEVOR typo marketing sender", query: "from:makerting@em.vevor.com", trash: true },
  { name: "Promo — Marvel newsletter", query: "from:marvel@mail.marvel.com", trash: true },
  { name: "Promo — ROVE Dash Cam marketing", query: "from:help@rovedashcam.com", trash: true },
  { name: "Promo — Blizzard marketing", query: "from:noreply@e.blizzard.com", trash: true },
  { name: "Promo — Lenovo B2B marketing", query: "from:b2b@marketing.lenovo.com", trash: true },
  { name: "Promo — Zight marketing", query: "from:marketing@zight.com", trash: true },
  { name: "Promo — Blair Anders real estate newsletter", query: "from:blair@blairandershomes.com", trash: true },
  { name: "Promo — GTC Movies marketing", query: "from:no-reply@gtcmovies.com", trash: true },
  { name: "Promo — IFTTT marketing", query: "from:mail@ifttt.com", trash: true },
  { name: "Promo — Shop saved-cart reminders", query: "from:noreply@email.shop.app", trash: true },
  { name: "Promo — Verve pre-approved offers", query: "from:ambassador@yourvervecard.com", trash: true },
  { name: "Promo — Beans Moto Booth marketing", query: "from:csteam@beansmotobooth.com", trash: true },
  { name: "Promo — Walt Disney Records", query: "from:waltdisneyrecords@em.waltdisneyrecords.com", trash: true },
  { name: "Promo — HeyGen events", query: "from:no_reply@learn.heygen.com", trash: true },
  { name: "Promo — Subimods marketing", query: "from:support@subimods.com", trash: true },
  { name: "Promo — Postman offers", query: "from:notifications@mail.postman.com", trash: true },

];
