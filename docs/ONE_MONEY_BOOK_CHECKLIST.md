# Aayam Office — One Money Book Update Checklist

22 Nov 2026 · Satish Vegad
Live copy of this list: https://claude.ai/artifact/2d4edRqM4oBcUBsE6uUrrC
File copies: `aayam-office-test/docs/ONE_MONEY_BOOK_CHECKLIST.md` (master) and `aayam-office-2/docs/ONE_MONEY_BOOK_CHECKLIST.md`

## How we use this checklist

We work one check at a time, top to bottom. After I build a check in the test copy, I tell you its number (for example "3.4 is ready"). You check it the way the item says. When you say it is OK, I tick it and move to the next. Nothing goes to live until Phase 11. At the end, we compare the finished system with this list.

Each item has two parts: **what is built**, then **how you check** (in *italics*).

### Rules you decided (22 Nov 2026) — these never change without your OK

1. **One money book.** Every rupee in or out is written once, in one place. All finance data and reports come from it.
2. **Blue and Red stay, everywhere.** Blue = invoiced (with GST). Red = not invoiced. Every money entry, due, advance, ledger and report shows Blue and Red separately. Red is seen by Admin (and Finance) only.
3. **Lump-sum payments square off the oldest invoices first.** Whatever is left over is kept as the client's advance, in the same colour. Admin can still point a payment at a named invoice when the client asks.
4. **Extra money is welcome as advance.** When a friendly client pays more than due (for example ₹6–7 lakh against ₹5 lakh due), the extra is held as advance and used on his next invoices automatically.
5. **Client categories:** New (Instagram, Facebook, website), New with reference (from existing clients or our known circle), Old circle (design clients and old list since 2004), Genuine / recurring (3–4 years of repeat business).
6. **New clients:** no credit. 50% advance before the project starts, 50% before dispatch (after we share photos of the printed material).
7. **Recurring clients:** credit of 30 or 45 days from the invoice date, and a credit limit Admin can extend.
8. **Every dispatch needs Admin's final OK.** The system shows Admin the payment picture; Admin decides.
9. **HSN stays as it is now.** It becomes a setting per product type, so it can be changed later if the government gives clear direction.
10. **The design guide applies to every screen** (CLAUDE.md, DESIGN_SYSTEM.md, DASHBOARD_GUIDE.md). No item that changes a screen is ticked until the design check passes (Phase D).

## Phase 0 — Safety fixes

- [x] **0.1** Every money action in the database checks the role first: only Admin or Finance can post money in, money out, transfers, bank balance changes, stock release and bulk dispatch. *Check: I log in as Test Dispatch and try to post ₹1 — you see the refusal message in my report.*
- [x] **0.2** The same 9 checks are added in the app's own server code, not only hidden on screen. *Check: same test from the app with the Dispatch login — refused.*
- [x] **0.3** The test database stops calling the live app address on stage changes. *Check: I move a test job; the live app log shows nothing from it.*
- [x] **0.4** Functions that do not need to be reachable without login are closed. *Check: the Supabase security report shows these warnings gone.*
- [x] **0.5** Leaked-password protection turned on, and public sign-up switched off (added 22 Nov). *Check: Supabase report shows it on; an outsider cannot create a login.*
- [x] **0.6** A full backup of the live database is taken and saved before any live change in this update. *Check: I show you the backup file name and date.*
- [ ] **0.7** Phase 0.1, 0.2, 0.4 and 0.5 applied to live (safety only, no money logic change; 0.3 is test-only). Public sign-up on live was already switched off on 22 Nov (approved early, because live also had email confirmation off); until 1.10 is built, Claude creates new staff logins. *Check: Dispatch login on live is refused when posting money; office work goes on as normal.*

## Phase D — Design gate (applies to every phase)

On 22 Nov I measured all 338 screen files against your design guide: **16,814 problems in 289 files**. Even the 71 files changed since 17 Nov carry 2,971, because changed files were not fully cleaned. From now on the guide is checked by a tool, not by memory.

- [ ] **D.1** **One guide, no conflicts.** DESIGN_SYSTEM.md still shows hand-made buttons and shadows, which CLAUDE.md forbids. Fix it so all three files say the same thing; CLAUDE.md wins. *Check: you read the updated DESIGN_SYSTEM.md.*
- [ ] **D.2** **Design check tool** `npm run audit:ui` checks 12 rules: token colours only, no hex, amber only for "due soon", type sizes, no shadows, no hover lift, card/button corners, shared components only, no browser pop-ups, no emoji, no text under 12px, no inline styles. *Check: I show you its report.*
- [ ] **D.3** **Every update report ends with one line:** "Design check: PASS — N screens" plus a screenshot of each changed screen. No line = not done. *Check: you see the line on every update.*
- [ ] **D.4** **Touched = cleaned.** Any screen file I change must pass the check in full, not just the lines I added. *Check: the PASS line lists the files.*
- [ ] **D.5** **Shared building blocks** so every screen looks the same: page header, section heading, money figure (₹, Indian commas, — when unknown), Blue/Red chip, status badge, empty and loading states, checkbox, table. *Check: you see them all on one sample page and approve the look.*
- [ ] **D.6** **Blue/Red look** decided once: one chip style and one column style, used on every screen. *Check: you approve it on the sample page.*
- [ ] **D.7** **Clean the screens we keep**, worst first, after the Phase 9 keep/retire list (screens being retired are not cleaned). First in line: CreatePrintRunForm and UnifiedJobForm (logic-only safety fixes in 0.2, agreed 22 Nov). *Check: the whole-app count goes down each week; I report it.*
- [ ] **D.8** **Lock (optional):** a check that runs when code is committed and stops the commit if a changed screen fails. *Check: you say yes or no.*

## Phase 1 — Settings: client categories, credit, accounts

- [ ] **1.1** Client form gets a **Category** field with 4 choices: New, New with reference, Old circle, Genuine / recurring. *Check: open a client, pick each choice, save.*
- [ ] **1.2** For "New with reference", a **Referred by** field (pick an existing client or type a name). *Check: save one referred client and see the name on the client page.*
- [ ] **1.3** Client form gets **Credit days** (0, 30, 45 or typed) and **Credit limit (₹)**. New clients default to 0 days and ₹0 limit. *Check: a new client shows 0 / ₹0 without typing.*
- [ ] **1.4** Only Admin can change category, credit days and credit limit; each change is logged with who, when and old → new value. *Check: Marketing login cannot edit; Admin edit shows in the log.*
- [ ] **1.5** **Advance rule per category** in Finance Settings: New = 50% before start + 50% before dispatch; others = as Admin sets per client. *Check: open Finance Settings and see the rule.*
- [ ] **1.6** Client **state** comes from a dropdown of Indian states, not typing. GSTIN, when entered, fills the state from its first 2 digits (24 = Gujarat) and warns if they disagree. *Check: type GSTIN starting 24 → Gujarat appears.*
- [ ] **1.7** Existing clients listed for you on one page with blank or odd states and blank categories, so you can fill them once. *Check: the list opens; you fill a few and they save.*
- [ ] **1.8** **Money accounts** list, one place: HDFC Current, UPI account(s), Cash box(es), savings accounts kept in the app. Each has a type (Bank / UPI / Cash), opening balance and opening date. Cash is no longer kept in two different tables. *Check: the Accounts page shows every account once, with its type.*
- [ ] **1.9** **Product types** setting: label, box, carton, pouch, sticker, letterhead, pamphlet, design work… each with HSN (today's code kept as default) and GST rate. *Check: open the setting; change one HSN in test and see it on the next test invoice.*
- [ ] **1.10** **Add staff (Admin only)** (added 22 Nov). Public sign-up is off, so a new staff login is created by Admin through the server: name, username, role, first password (checked against leaked passwords). The old "Add user" box in Settings → General, which used public sign-up, is replaced. *Check: Admin adds a test staff login and it can sign in; a Marketing login cannot add staff.*

## Phase 2 — Build the one money book (with Blue and Red)

Built beside the current setup. Nothing old is removed in this phase.

- [ ] **2.1** Before building: I show you the **shape** of the money book (what each row holds, which screens read it) on one page. *Check: you say OK to the shape.*
- [ ] **2.2** The money book table: one row per rupee movement, with date, account, in or out, amount, **colour (Blue or Red)**, party (client or vendor or payee), type, reference (UPI ref / cheque no.), note, proof file, who entered, when. *Check: I show you 3 sample rows on screen.*
- [ ] **2.3** Types allowed: Client advance, Client payment, Client refund, Vendor (printer) payment, Expense, Transfer between accounts, Opening balance, Bank charge, Adjustment (Admin only, reason compulsory). *Check: the type list on the entry form.*
- [ ] **2.4** Every row carries a running number (for example MB-26-0001) that never repeats. *Check: two entries get two numbers in order.*
- [ ] **2.5** A row can never be edited or deleted. A mistake is fixed by **Void** (Admin only, reason compulsory), which shows struck through and stops counting everywhere. *Check: try to edit → refused; void one → it disappears from all totals.*
- [ ] **2.6** **Double-entry warning:** same client + same amount + same account within 3 days → warning with the earlier entry's number before saving. Admin can still save with a note. *Check: enter ₹8,850 cash twice for the same client → warning appears the second time.*
- [ ] **2.7** **Account balances** are always worked out from the book (opening + in − out), never stored and added to by hand. *Check: account balance = total of its rows, shown on the account page.*
- [ ] **2.8** **Closing date:** entries before the closing date (Finance Settings) cannot be added or voided. *Check: try a back-dated entry before the closing date → refused.*
- [ ] **2.9** Every entry and void is written to the Finance Log with who and when. *Check: the Finance Log shows the test entries and the void.*
- [ ] **2.10** Red rows and Red totals are visible to Admin and Finance only. Marketing, Designer and Dispatch never see them, on screen or through the back door. *Check: Marketing and Dispatch logins show no Red anywhere.*

## Phase 3 — Money in: advance, lump sum, square-off

- [ ] **3.1** One **Receive money** form for Admin: client, amount, account (bank / UPI / cash), date, reference, proof (optional), and the split **Blue ₹ / Red ₹**. *Check: enter one Blue and one Red receipt; both show in the book with the right colour.*
- [ ] **3.2** The form shows the client's position before saving: Blue due, Red due, advance held (Blue and Red), oldest invoice date. *Check: pick a test client; the numbers appear before you save.*
- [ ] **3.3** **Square-off rule:** money is applied to the client's oldest unpaid invoice first, then the next, in the same colour. *Check: client has 3 Blue invoices; pay a lump sum that covers 2 and part of the 3rd → invoices 1 and 2 paid, 3 partly paid.*
- [ ] **3.4** **Left-over becomes advance** in the same colour, held for the client. *Check: pay more than all invoices → the extra shows as "Advance held (Blue)".*
- [ ] **3.5** **Pay a named invoice:** Admin can tick "client says this is for…" and choose the invoice(s); the rest still follows 3.3. *Check: pay for the newest invoice only → only that one shows paid.*
- [ ] **3.6** **Advance before invoice** (new client 50%, or advance for a running order) is saved as advance, never as payment, and can be tied to an order. *Check: take a 50% advance on a test order → dues do not drop; "Advance held" goes up.*
- [ ] **3.7** When an invoice is made, held advance is used on it automatically: first the advance tied to that order, then other held advance of the same colour. *Check: make an invoice for the order in 3.6 → the invoice shows "Advance used ₹…, balance ₹…".*
- [ ] **3.8** Blue money is used only for Blue invoices; Red money only for Red dues. Moving money between colours is an Admin **Adjustment** with a reason. *Check: Red advance held does not reduce a Blue invoice.*
- [ ] **3.9** The Marketing ↔ Admin payment message flow stays: Marketing sends the client's claim, Admin confirms (posts it through 3.1) or says "not received". *Check: claim from Test Marketing → Admin confirms → Marketing gets the "received" note.*
- [ ] **3.10** **Paid by someone else:** optional "Paid by" name (son, dealer, relative) and the UPI/bank name, so Admin can match the bank line. *Check: the name shows on the receipt and in the khata.*
- [ ] **3.11** **Receipt slip** (PDF) for every receipt: number, date, amount, Blue/Red only as Admin chooses to show, how it was applied, balance after. *Check: open and download one receipt slip.*
- [ ] **3.12** **Refund** of advance to a client (rare) is an entry of type Client refund, which reduces his held advance. *Check: refund ₹1,000 → advance held drops by ₹1,000; account drops by ₹1,000.*
- [ ] **3.13** **Settlement discount / kasar:** Admin can write off a small balance with a reason, so the invoice closes. *Check: write off ₹50 on an invoice → it shows Paid, with the write-off listed.*

## Phase 4 — Invoice at dispatch

- [ ] **4.1** The order stays an **estimate** (quantity × rate, Blue and Red). Money is owed only when the invoice is made. *Check: a new order with no invoice shows ₹0 due, only "Order value (estimate)".*
- [ ] **4.2** The invoice uses the **delivered quantity** for each line, as today (9,600 of 10,000 → billed on 9,600). *Check: repeat the Gondal test → ₹11,520 + GST.*
- [ ] **4.3** At the same moment, the **Red part** of the delivered quantity becomes Red due (no GST, Admin-only). *Check: an order with Blue + Red → after dispatch, Blue due and Red due both appear, each for the delivered quantity.*
- [ ] **4.4** **CGST + SGST or IGST** is decided from the delivery state (place of supply) taken from the state dropdown, not from spelling. *Check: Gondal client → CGST + SGST; Punjab client → IGST.*
- [ ] **4.5** **HSN and GST rate** come from the product type setting (1.9). Today's HSN is kept as the default. *Check: the invoice line shows the HSN from the setting.*
- [ ] **4.6** **Round-off** line; total to the nearest rupee. *Check: the Gondal test total shows ₹13,594 with round-off ₹0.40.*
- [ ] **4.7** **Due date** on every invoice = invoice date + client's credit days (new client: due on the invoice date). *Check: Patel (45 days) invoice dated 22 Nov shows due 6 Jan.*
- [ ] **4.8** **Invoice number series** continues this financial year's numbers, starting from the number you give me (last Zoho invoice + 1). No gaps, no repeats. *Check: you give the number; the first test invoice uses the next one.*
- [ ] **4.9** **E-way bill number** box on the invoice (made on the government portal, only stored here), as today. *Check: save an e-way number and see it on the PDF.*
- [ ] **4.10** **Void invoice** (Admin, reason compulsory) undoes everything it did: advance used goes back to held, order quantities go back, the number stays used and shows "Cancelled". *Check: void a test invoice → advance held returns to what it was before.*
- [ ] **4.11** **Credit note** for returns, rate changes or short supply after the invoice. It reduces the client's Blue due. *Check: credit note of ₹500 → due drops by ₹500 and the khata shows it.*
- [ ] **4.12** One invoice can club several orders of the **same client and same destination** (one katta consignment), as today. *Check: the Patel test → one invoice with label and half the pouches.*
- [ ] **4.13** Part dispatch keeps the rest of the order open: "1,500 of 3,000 sent, 1,500 still to invoice". *Check: pouch order shows this after the Patel test.*
- [ ] **4.14** **Invoice PDF** in your own invoice format, when you give it to me (placeholder until then). *Check: you approve the PDF look.*

## Phase 5 — Dispatch with Admin's final OK, new client flow

- [ ] **5.1** **New client, before work starts:** the order waits at "Awaiting advance" until Admin confirms the 50% advance (or waives it, with a reason). The designer cannot start before that. *Check: a new-client test order cannot move to Design until Admin confirms.*
- [ ] **5.2** **New client, before dispatch:** when the printed material reaches QC, a "Send photos to client" step: the job's product photos are ready to share, with the balance amount. *Check: the step appears on a new-client job at QC, with photos and the balance.*
- [ ] **5.3** The balance request shows the real balance from the money book (order value on the delivered quantity − advance held), Blue and Red. *Check: the amount matches what the khata says.*
- [ ] **5.4** **Every dispatch needs Admin's final OK.** Dispatch can prepare the consignment (katta count, transporter), but "Send" stays locked until Admin presses **Approve dispatch**. *Check: Test Dispatch cannot send; after Test Admin approves, Dispatch can.*
- [ ] **5.5** Admin's approve screen shows the payment picture for that client, all from the money book: Blue due, Red due, advance held, overdue invoices and days, credit limit used, category. *Check: Patel test → the numbers match the khata exactly.*
- [ ] **5.6** Warning flags on that screen (warnings only, Admin decides): new client balance unpaid, invoice past due date, credit limit crossed. *Check: each flag appears in its test case.*
- [ ] **5.7** Admin's approval is logged with time and an optional note ("client promised payment Monday"). *Check: the note shows on the job and in the activity log.*
- [ ] **5.8** The old automatic dispatch block (which used the old order numbers) is removed, since Admin approves every dispatch. *Check: the Patel test is no longer blocked by the wrong "overdue" message.*
- [ ] **5.9** After dispatch, the job shows Dispatched → Delivered as today, and stays in Delivered until fully paid (your earlier rule), now read from the money book. *Check: a fully paid test job moves to archive by itself; an unpaid one stays.*
- [ ] **5.10** Dispatch staff never see any prices or rates (your earlier rule), including on the new screens. *Check: Dispatch login screens show no ₹ amounts.*

## Phase 6 — Money out: printers, expenses, transfers, cheques

- [ ] **6.1** **Vendor (printer) bill** form: vendor chosen from the vendor list (not typed), bill no., date, amount, GST, due date, **colour (Blue or Red)**, bill photo, and the job(s) it is for. *Check: enter a printer bill for a test job; it shows on the vendor and on the job.*
- [ ] **6.2** **Pay printer:** payment goes into the money book and squares off that printer's oldest bills first (same rule as clients), or a named bill. Extra becomes advance to the printer. *Check: pay a lump sum to a printer with 2 bills → oldest paid first.*
- [ ] **6.3** **Printer dues** page: per printer, Blue and Red owed, oldest bill age, advance given. *Check: totals match the bills minus payments.*
- [ ] **6.4** **Expense** entry (electricity, transport, Amazon, salary, rent…): category, account, amount, colour, bill photo, optional job (for transport on a dispatch). *Check: enter a transport expense tied to the Patel consignment.*
- [ ] **6.5** **Bills to pay** (not yet paid, like the PGVCL bill) with due dates, shown on the Admin dashboard when due within 7 days. *Check: a bill due in 3 days appears on the dashboard.*
- [ ] **6.6** **Transfer** between accounts (bank → cash, UPI → bank) is one entry that moves money out of one and into the other. It is not income or expense. *Check: transfer ₹10,000 bank → cash → both balances change; profit does not.*
- [ ] **6.7** **Cheque received:** saved as "cheque in hand" with cheque no., bank and date (post-dated allowed). It counts in the account only when marked **Cleared**. *Check: a post-dated test cheque does not reduce dues until cleared.*
- [ ] **6.8** **Cheque bounced:** the due comes back on the client, a bank charge entry is added, and the client page shows a "cheque bounced" note. *Check: bounce a test cheque → due returns + charge listed.*
- [ ] **6.9** **Bank statement upload** (HDFC file) to tick each bank line against money-book entries (reconcile), using your bank rules. *Check: upload a sample statement; matched lines tick, unmatched lines are listed.*

## Phase 7 — Move old data and match totals

Old data is copied, not deleted (your archive-first rule). The old tables stay readable until Phase 9.

- [ ] **7.1** **Opening balances** on the cut-over date (31 Oct 2026) for every account: HDFC, UPI, cash, savings. You give or confirm each figure. *Check: you confirm each account's opening figure.*
- [ ] **7.2** **Client opening dues** on 31 Oct, Blue and Red separately, with the invoices behind them where known. *Check: you confirm the list of client dues on 31 Oct.*
- [ ] **7.3** **Printer opening dues** on 31 Oct, Blue and Red. *Check: you confirm the list.*
- [ ] **7.4** All entries since 31 Oct copied into the money book from the old tables, each with a link back to where it came from. *Check: I show the count of rows copied per old table.*
- [ ] **7.5** **Duplicate report:** before copying, a list of entries that look doubled (same client, same amount, close dates), like the maharaja ₹8,850. You decide each one. *Check: you go through the list.*
- [ ] **7.6** **Advance or payment?** A list of old receipts taken before delivery but saved as payments. Each is changed to advance (or kept), as you decide. *Check: you go through the list.*
- [ ] **7.7** **Orphan money:** a list of entries in dues with no bank or cash entry (like manjit's ₹2,360), and bank entries with no client. *Check: list is empty or every line is explained.*
- [ ] **7.8** **Totals match:** each account's balance in the money book = the balance on its bank statement / cash count on the same date. *Check: one line per account, difference ₹0.*
- [ ] **7.9** **Client totals match:** for 10 clients you choose, the new khata matches what you know from your own records. *Check: you check the 10.*

## Phase 8 — Every screen reads the money book

One number, one source. Each screen below is switched over and then compared with the khata for the same client.

- [ ] **8.1** **Client khata** (statement): date-wise invoices, receipts, credit notes, advances, running balance, Blue and Red in separate columns (Red Admin-only). PDF to download or send on WhatsApp, with a Blue-only version for the client. *Check: Patel khata shows paid ₹68,880, invoiced ₹60,770, credit ₹8,110.*
- [ ] **8.2** **Order card** shows order value (estimate), invoiced so far, paid on its invoices, and balance, from the money book. The old "amount received" number is no longer used. *Check: hanif bhai's order shows the same on the card and on Orders & Dues.*
- [ ] **8.3** **Orders & Dues** page: per client and per invoice, Blue due, Red due, advance held, age from the **invoice date**, due date, overdue days. *Check: Patel label invoice made today shows age 0, not 48.*
- [ ] **8.4** **Admin dashboard** money cards: cash and bank today, money in this week, money out this week, total owed to us (Blue / Red), overdue, owed to printers. No Zoho numbers anywhere. *Check: each card opens the list behind it, and its total matches that list.*
- [ ] **8.5** **Daily brief and Telegram digest** read the money book, not Zoho. *Check: today's test brief shows the same "money owed" as the dashboard.*
- [ ] **8.6** **Marketing views** show only what Marketing should see (their orders, payment claim status), no Red, as decided on 20 Nov. *Check: Test Marketing login.*
- [ ] **8.7** **Reports**, all from the money book and invoices: monthly, quarterly, yearly; account-wise; client-wise; vendor-wise; Blue and Red separately; money in vs out; GST collected on Blue invoices. *Check: November report totals = sum of November money-book rows.*
- [ ] **8.8** **Ageing report:** 0–30, 31–45, 46–60, 60+ days from invoice date, per client. *Check: Patel's Sep box invoice falls in the right bucket.*
- [ ] **8.9** **Commission** for marketing (the % Admin types per job) is worked out from the money book, on the base you choose (invoice value, or money actually received). *Check: you tell me the base; a test job shows the right commission.*
- [ ] **8.10** **The same number everywhere:** I run one check that compares each client's due on every screen. *Check: the comparison report shows 0 differences.*

## Phase 9 — Clean-up of old screens

Only after Phases 2–8 are confirmed. Old data stays viewable in an archive; only the old screens and old write paths go.

- [ ] **9.1** A list of every finance screen with "keep / merge / retire", for your OK before anything is removed. Target: about 12 finance screens. *Check: you approve the list.*
- [ ] **9.2** Zoho screens and Zoho numbers retired (Zoho Books, Invoice Matching, Zoho reports). *Check: no menu item or number says Zoho.*
- [ ] **9.3** The "(new)" doubles merged into one: Banking, Invoices, Payments, Reports, Accounts, Sales, Purchases. *Check: each appears once in the menu.*
- [ ] **9.4** Old ways of saving money switched off (old payment, advance, expense and vendor-payment paths), so nothing can be written outside the money book. *Check: I show that every money button now writes only to the money book.*
- [ ] **9.5** Old money columns on orders and clients (amount received, outstanding balance, advance collected…) frozen as archive, read by no screen. *Check: the comparison in 8.10 still shows 0 differences.*
- [ ] **9.6** Sidebar and command search updated: one name per page, same word everywhere. *Check: you walk the menu once with the Admin login.*
- [ ] **9.7** Old notes and fix files in the project folder moved into an "archive" folder; one short handbook of how the money book works. *Check: the folder is tidy; you read the handbook.*

## Phase 10 — New features

One at a time, in this order. For each one, I show you the shape first.

- [ ] **10.1** **Job profit:** per job, order value (Blue + Red) minus printer bill, transport, other costs tied to it = margin and margin %. Also per client and per month. Admin only. *Check: a test job with a printer bill and transport shows the right margin.*
- [ ] **10.2** **Credit watch for recurring clients:** credit limit used (₹ and %), oldest invoice age, and a quiet reminder to Admin when a client nears the limit or a due date. *Check: a test client at 90% of his limit shows on the Admin dashboard.*
- [ ] **10.3** **Ask-for-advance list:** friendly recurring clients with good payment history, for the times you need cash for printers. Shows their usual payment size and last payment. Admin only. *Check: the list opens and each row opens the client's khata.*
- [ ] **10.4** **Daily close (6 pm):** count the cash box and enter it; system shows the difference; UPI and HDFC lines of the day ticked; today's entries listed for Admin to confirm. *Check: run one daily close in test, with a ₹100 cash difference shown.*
- [ ] **10.5** **Owner's morning screen:** yesterday's money in and out, cash and bank now, top 5 clients to call (real overdue), printers to pay this week, jobs stuck over X days. *Check: every number opens its list.*
- [ ] **10.6** **WhatsApp payment reminder:** polite message (English or Gujarati) with the Blue khata PDF, drafted 3 days before and on the due date; Admin approves each before it goes. *Check: one test reminder drafted and shown to Admin; nothing is sent without approval.*
- [ ] **10.7** **Lead source on client:** Instagram, Facebook, website, reference (name), old circle — to see later which source brings good clients. *Check: report of clients by source.*

## Phase 11 — Final test and go live

- [ ] **11.1** **Full test, new client:** Instagram lead → quotation → accept → 50% advance (UPI, two parts) → design → print → short delivery → photos to client → balance received → Admin approves dispatch → invoice → delivered → archive. *Check: every screen agrees at every step; you watch it on Team View.*
- [ ] **11.2** **Full test, recurring client:** 3 orders over 3 months → one invoice per dispatch → lump-sum payment covering 2.5 invoices → extra lump-sum advance → next invoice uses the advance → credit days from invoice date. *Check: khata, Orders & Dues, dashboard and report all show the same.*
- [ ] **11.3** **Error tests:** double entry warning, void a receipt, void an invoice, cheque bounce, wrong-colour attempt, back-dated entry before closing date, Dispatch trying to send without Admin OK. *Check: each one behaves as written in its phase.*
- [ ] **11.4** **Role test:** Admin, Marketing, Designer, Dispatch logins each see only what they should; no prices for Dispatch, no Red outside Admin and Finance. *Check: one pass with each login.*
- [ ] **11.5** **Design guide check** on every new or changed screen (colours, type, cards, numbers open their list). *Check: my report lists each screen checked.*
- [ ] **11.6** Live backup taken again just before going live. *Check: backup file name and time shown.*
- [ ] **11.7** **Go live** on a quiet day you choose (for example a Sunday). Old data moved as in Phase 7, on live. *Check: you pick the day.*
- [ ] **11.8** **First week on live:** daily close every day; I check that all totals agree each morning and report to you. *Check: 7 daily reports with 0 differences, or each difference explained.*
- [ ] **11.9** **Final comparison:** this checklist against the finished system, item by item. *Check: every item ticked, or moved to a later list with your OK.*
- [ ] **11.10** Test database and test logins deleted after you confirm (as planned on 18 Nov). *Check: you confirm, then I delete.*
- [ ] **11.11** **Whole-app design check** on every screen we keep: 0 problems. *Check: the `npm run audit:ui` report shows 0.*
