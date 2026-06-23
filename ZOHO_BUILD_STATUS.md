# Zoho-Style Finance Build — Architecture & Status

_Updated 23 June 2026. Companion to `ZOHO_BOOKS_STUDY_AND_PLAN.md`._

## Decisions locked in
- Payments: **both-linked** — record from the invoice/bill AND from banking, with matching so the same money is never counted twice.
- Accounting: **full accrual** like Zoho — raising an invoice books income + Accounts Receivable; payment clears AR. Bills book cost + Accounts Payable; payment clears AP.
- GST: **reports only**, no filing (a CA firm files). Invoices admin-only.

## The accounting backbone (BUILT, LIVE in the database, verified)

New control accounts added to the chart of accounts:
- `1200` Accounts Receivable, `1250` Input GST Credit (assets)
- `2100` Accounts Payable, `2200` Output GST Payable (liabilities)
- `5200` Cost of Materials & Outsourcing (expense, for vendor bills)
- All three active bank accounts are now mapped to the ledger (two were previously unmapped).

Posting engine (Postgres functions + triggers, so postings happen no matter which screen writes the data):
- `fn_post_invoice_accrual` — on a new invoice: **Dr Accounts Receivable** (total), **Cr Sales** (subtotal − discount), **Cr Output GST** (tax). Fires automatically via trigger `invoice_accrual_aiu`.
- `fn_record_invoice_payment` — inserts the payment, updates the invoice (paid / balance / status), posts **Dr Bank or Cash, Cr Accounts Receivable**, and updates the bank/cash balance.
- `fn_post_bill_accrual` — on a new vendor bill: **Dr Cost of Materials, Dr Input GST, Cr Accounts Payable**. Fires via trigger `bill_accrual_ai` (insert-only, so your 6 existing bills are never retroactively touched).
- `fn_record_bill_payment` — inserts the vendor payment, updates the bill, posts **Dr Accounts Payable, Cr Bank/Cash**, updates the balance.

Every function deletes-and-reposts its own journal entry, so it is idempotent and safe to re-run. All four were tested end-to-end with throwaway invoices/bills: journal entries balanced to the rupee, statuses and balances updated correctly, and the test data was fully removed afterward.

Reconciliation columns added for the linked model: `payments_received` and `vendor_payments` now have `bank_transaction_id`, `is_reconciled`, `journal_entry_id`, and `source`.

## Phase 1 — Invoicing (BUILT, DEPLOYED, testable now)
- List with Zoho-style status chips ("Overdue by N days", "Due in N days", "Partially Paid") + Balance Due column.
- Right-side detail drawer: action toolbar, Bill To with GSTIN, line items, CGST/SGST-or-IGST breakdown, Balance Due headline, Payments Received section.
- **Record Payment** modal that calls the engine — choose amount, date, mode, and bank/cash account; it posts to the ledger and updates everything.
- Creating an invoice now auto-posts the accrual entry (income + AR) with no extra step.

## Phase 3 — Purchases / Bills payment (BUILT, DEPLOYED)
- The vendor bill detail now has a **Record Payment** modal that calls `fn_record_bill_payment`: it records the vendor payment, updates the bill (paid/balance/status), posts **Dr Accounts Payable, Cr Bank/Cash**, and reduces the bank/cash balance.
- New vendor bills auto-post their accrual (cost + input GST + AP).

## Phase 4 — Reports (BUILT, DEPLOYED)
- New page Finance → **Accounting Reports** (`/admin/finance/reports/accounting`), reachable from a card on the Finance home.
- **Accrual P&L** straight from the ledger (income vs expense over a date range, net profit).
- **AR Aging** (unpaid invoices) and **AP Aging** (unpaid bills) bucketed Current / 1–30 / 31–60 / 60+ days.

## What's PENDING (the one remaining integration)
**Bank-matching de-duplication (rest of Phase 2).** Invoice-first and bill-first payments post correctly to the ledger. The remaining piece is the banking screen: when a bank statement line is the *same money* as a payment you already recorded on an invoice/bill, it must **match/link** to it (set `is_reconciled`, `bank_transaction_id`) instead of creating a second payment — and the existing bank "client income / vendor expense" categorisation must post against AR/AP (not income/expense) once accrual is in use, so income isn't counted twice.

⚠️ **Until this is built:** for any given payment, use *either* the invoice/bill Record Payment *or* the bank-statement categorisation — not both on the same money. This is the one piece I recommend doing with you able to test, since it changes the existing bank-reconciliation flow on live data.

## How to test what's live
1. Open Finance → Invoices → New Invoice; create one for a client.
2. Open it → the drawer shows the totals and Balance Due; the accrual entry is already in the journal (Finance → Journal).
3. Click **Record Payment**, enter an amount and a bank/cash account, save.
4. Check: invoice shows Paid/Partial with the right balance; the bank balance increased; the Journal has a balanced "Payment for invoice" entry (Dr Bank, Cr Accounts Receivable).

## Rollback points (if anything looks wrong)
- Code: git tag `restore-20260623-pre-invoicing`, plus each change is a separate commit on `main`.
- Database: schema snapshot `backup_20260623` (87 tables). The new accounting objects are additive; removing them would not affect existing data.
