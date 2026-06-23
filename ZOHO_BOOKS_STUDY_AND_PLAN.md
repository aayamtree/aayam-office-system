# Zoho Books → Aayam Office System: Study & Build Plan

_Prepared 23 June 2026. Based on a live study of the aayam communication Zoho Books account and a review of the current Aayam app database._

## Short answer

Yes, this is very doable — and you are much closer than you might think. Your app already has the database tables for almost everything Zoho Books does on the Sales and Purchases side (invoices, invoice items, payments received, expenses, purchase bills, a chart of accounts, and a double-entry journal). What is mostly missing is the **Zoho-style screens** on top of that data. So this is largely a UI/UX project, not a "build accounting from zero" project.

The goal of this document is to map what Zoho Books does onto what you already have, identify the gaps, and lay out a phased plan to build a Zoho-like experience inside your own app.

---

## 1. How Zoho Books is structured (what I saw in your account)

Zoho organises everything under a small set of left-sidebar modules. The ones relevant to you:

**Sales** — Customers, Quotes, Retainer Invoices, Sales Orders, Invoices, Recurring Invoices, Delivery Challans, Payments Received, Credit Notes, e-Way Bills.

**Purchases** — Vendors, Expenses, Recurring Expenses, Purchase Orders, Bills, Recurring Bills, Payments Made, Vendor Credits.

**Banking** — bank/cash accounts and reconciliation against imported statements.

**Reports** — 91 ready reports grouped into Business Overview (P&L, Balance Sheet, Cash Flow), Receivables (AR Aging, Customer Balances), Payables (AP Aging, Vendor Balances), Sales, Purchases & Expenses, Taxes (GSTR-3B, Tax Summary, TDS/TCS), and Accountant (Ledger, Trial Balance, Day Book).

### The patterns worth copying

Three design patterns make Zoho feel "complete," and they repeat across every module:

The **list view** is consistent everywhere: a title with a saved-filter dropdown (e.g. "All Invoices ▾"), a prominent red **+ New** button top-right, sortable columns, a status column with colour-coded chips (green Paid, orange Overdue, blue Due in X days), and an amount/balance column on the right. The invoice list also shows an AI ("Zia") insights strip summarising overdue totals and chronic late-payers.

The **document form** (invoice, quote, bill) is also consistent: customer/vendor selector at the top, an auto-generated document number you can edit, dates and terms, then a line-item table with columns for Item, Quantity, Rate, Discount, Tax, Amount. Below the table sits a totals box (Sub Total → Shipping → TDS/TCS → Discount → Total) plus a customer-notes field, and a footer with Save as Draft / Save and Send / Make Recurring.

The **status lifecycle** drives everything: a quote moves Draft → Sent → Accepted → Invoiced; an invoice moves Draft → Sent → Partially Paid → Paid → Overdue. The colour chips and the dashboard totals are all just reflections of that one status field.

---

## 2. What your app already has (gap analysis)

Your Supabase database already contains the tables to support most of this. Here is the honest status of each:

| Zoho module | Your table(s) | Status | What's needed |
|---|---|---|---|
| Customers | `clients` (53 rows) | Full — has GSTIN, credit_limit, outstanding_balance, opening_balance, billing + delivery address | Add a Zoho-style customer detail page (transactions, balance, statement) |
| Quotes/Estimates | `quotations` (3), `quotation_items` (9) | In use — has quote_number, valid_until, GST, status, convert-to-job | Polish to parity: convert-to-invoice, PDF, expiry tracking |
| Invoices | `invoices` (0), `invoice_items` (0) | **Schema ready, no UI, no data** | **Build the whole invoicing screen** — biggest opportunity |
| Payments Received | `payments_received` (0) | Schema ready, no UI | Build "record payment" flow + receipts |
| Sales Orders | `sales_orders` (0) | Schema exists, unused | Optional later |
| Vendors | `vendors` (14) | In use — GSTIN, payment_terms, outstanding_balance | Add vendor detail page |
| Bills | `purchase_bills` (6) | In use — full GST fields, items jsonb, reverse_charge | Polish to Zoho bill layout |
| Expenses | `expenses` (0) | Minimal schema (no GST, no vendor link) | Extend + build screen |
| Payments Made | `vendor_payments` (17) | In use | Polish |
| Banking | `bank_accounts` (3), `bank_transactions` (79), `cash_accounts`, `cash_transactions` | In use — reconciliation data present | Build reconciliation UI |
| Reports & Ledger | `chart_of_accounts` (38), `journal_entries` (29), `journal_entry_lines` (58), `income_categories`, `expense_categories` | **Double-entry foundation already exists** | Build report screens on top |

The headline: **invoicing and payments-received are the two modules where the database is ready but the screens don't exist yet.** That is where building delivers the most visible "now it's like Zoho" effect. Quotes, bills, and vendor payments already work and just need polishing. The reporting foundation (chart of accounts + journals) is already in place, which is the hard part — the reports themselves are then mostly queries and layout.

### Important field-mapping notes

Your `invoices` table already splits tax into `cgst_amount` / `sgst_amount` / `igst_amount` and tracks `payment_status`, `amount_paid`, and `balance_due` — exactly the fields Zoho's status chips and dashboard need. So an invoice list with Paid/Overdue/Due chips can be built directly from existing columns.

Your `expenses` table is the one real schema gap: Zoho's expense has an expense **account**, a **vendor**, a "paid through" account, GST, and a billable-to-customer flag. Yours currently has only category, amount, payment_mode, and bank account. If you want Zoho-style expenses, this table needs a few new columns (vendor_id, gst fields, is_billable, customer/job link).

---

## 3. Recommended build plan (phased)

The safest path is to build module by module, each one shippable on its own, reusing the list-view and document-form patterns so the app feels consistent.

### Phase 1 — Invoicing (the core)
Build the invoice **list view** (status chips, filters, + New) and the invoice **creation form** modelled on Zoho's layout, writing to the existing `invoices` / `invoice_items` tables. Add PDF generation and a "convert quote → invoice" action from the existing quotations. Because the schema and GST fields already exist, this is mostly front-end work. This phase alone makes the app feel like Zoho.

### Phase 2 — Payments Received
Add the "Record Payment" flow against an invoice (full or partial), writing to `payments_received`, auto-updating the invoice's `amount_paid` / `balance_due` / `payment_status`, and posting to the bank/cash account. Add a Payments Received list and a customer statement view.

### Phase 3 — Purchases polish (Bills & Expenses)
Bring `purchase_bills` and `vendor_payments` up to the Zoho bill/payment layout (already in use, so lower risk). Extend the `expenses` table and build a Zoho-style Expenses screen with vendor, GST, and billable-to-job support.

### Phase 4 — Reports & GST
Build the report screens on top of the existing chart of accounts and journals: start with the four that matter most for you — **P&L, AR Aging (who owes you), AP Aging (who you owe), and Sales by Customer** — then add the GST summary (GSTR-3B style) and Day Book / Ledger. The dashboard "Total Receivables / Total Payables / Cash Flow" cards can be built early since the data is already there.

### Phase 5 — Dashboard & niceties
Recreate the Zoho home dashboard (Receivables, Payables, Cash Flow, top expenses) and optional extras like recurring invoices, credit notes, and reminders for overdue invoices.

---

## 4. Design principles to carry over from Zoho

To make it genuinely feel like Zoho, hold to these throughout:

Keep one consistent **list-view component** (filter dropdown + New button + colour-coded status chips + right-aligned amounts) and reuse it for invoices, quotes, bills, expenses, and payments. Keep one consistent **document-form component** (party selector → number/dates → line-item table → totals box → notes → save bar) and reuse it for invoices, quotes, and bills. Let a single **status field per document** drive the colour chips, the dashboard totals, and the available actions. Auto-generate document numbers (you already have a `counters` table for this). And make every list and report filterable by date range and exportable to PDF/Excel, the way Zoho does.

---

## 5. Recommended next step

I'd suggest we **start with Phase 1 (Invoicing)** as a single focused build, since the tables are ready and it's the most visible win. Within that, the first concrete deliverable would be the invoice list view, then the create/edit form, then PDF.

Before I build anything, it would help to confirm a few things: whether invoicing should pull line items directly from an accepted quotation (so you quote once and invoice from it), whether you want invoice PDFs to match your current Zoho invoice template, and whether marketing users should see only their own invoices (consistent with the role-based visibility already in the app) or all of them.
