# Finance Logic Guard — Aayam Office System

> **Purpose:** This document is for Claude (and future developers) to self-check financial logic before building or changing anything in the finance module. Every rule here was learned from a real bug or a real business requirement. Do not skip this file before touching finance code.

---

## Indian Financial Year Rules

- **FY starts: 1 April** — this is non-negotiable in India.
- **FY ends: 31 March** of the following year.
- Opening balances for all vendors, clients, and accounts are set as of **31 March (prior FY end)** or **1 April (new FY start)** — both mean the same thing.
- Any date filter with "Reset to FY" must default to `YYYY-04-01` where YYYY is the current year if current month >= April, otherwise previous year.

---

## Opening Balance Rules

### How opening balances are stored (vendors)
- `vendors.opening_balance` — the numeric amount owed at FY start (payable to vendor)
- `vendors.opening_balance_date` — date (usually 1 Apr)
- A `purchase_bills` record is ALSO created with `product_type = 'Opening Balance'` and `bill_number = 'OB-...'` — this exists purely for payment-status tracking in the bills list.

### THE GOLDEN RULE — never double-count opening balance
The vendor statement ledger MUST skip any `purchase_bills` record where `product_type = 'Opening Balance'`. The opening balance is shown once via `vendor.opening_balance`. If you show the OB bill too, it counts twice.

**Code guard (vendor statement):**
```js
bills.forEach(bill => {
  if (bill.product_type === 'Opening Balance') return; // ← NEVER remove this line
  ...
})
```

**Bug fixed (May 2026):** Nem's Graphics showed ₹2,60,694 outstanding when actual was ₹1,30,347 — opening balance was counted as both a "brought forward" row and a purchase bill row.

---

## Bank Transaction → Vendor Linkage Rules

### How a bank payment reaches a vendor statement
A bank transaction appears in a vendor's statement ONLY IF:
1. `bank_transactions.vendor_id` = the vendor's UUID ← **must match exactly**
2. `bank_transactions.is_verified = true` ← set when categorized

### THE DUPLICATE VENDOR TRAP
If two vendors share the same display name (e.g., two vendors both named "Nem's"), selecting the wrong one during categorization will silently misroute the payment. The vendor statement will show PAID = ₹0 even though the money was paid.

**Check before categorizing:** Always display both `vendor.company` AND `vendor.name` in the vendor picker so "Nem's Label" and "Nem's Graphics" are visually distinct.

**Bug fixed (May 2026):** ₹1,30,347 payment on 18-Apr-2026 was linked to `Nem's Label` instead of `Nem's Graphics`. Fixed by updating `bank_transactions.vendor_id` to the correct UUID.

### How to manually fix a mislinked payment (DB)
```sql
UPDATE bank_transactions
SET vendor_id = '<correct_vendor_uuid>'
WHERE id = '<transaction_uuid>';
```

---

## Vendor Statement Balance Logic

```
Opening Balance (debit)   +₹X   → We owe vendor ₹X from before FY
+ New Purchase Bills (debit) +₹Y   → New work done
- Bank Payments (credit)  -₹Z   → We paid vendor
= Outstanding (balance)    ₹X+Y-Z  → Still owe this
```

- If balance > 0 → **Payable to vendor** (shown in red)
- If balance = 0 → **Fully settled** (shown in grey)
- If balance < 0 → **Advance paid** (we paid more than billed — show ADV badge in green)

---

## Double-Entry Journal Rules

Every categorized bank transaction creates journal entries. The rule:

| Transaction Type | Debit | Credit |
|---|---|---|
| Income (client payment) | Bank Account | Accounts Receivable / Income |
| Vendor Payment | Accounts Payable / Expense | Bank Account |
| Vendor Advance | Vendor Advance (asset) | Bank Account |

A "Vendor Advance" is not an expense — it is an asset (prepaid to vendor). It should be reclassified to expense when the bill arrives.

---

## Known Risk Areas — Watch These

### 1. Amount sign convention
Bank transactions store `amount` as **positive** for both debits and credits. The sign/direction is determined by the transaction type (income vs expense). Do NOT negate amounts when building ledger rows — the ledger uses `debit`/`credit` columns, not signed amounts.

### 2. Two "Nem's" vendors
There are two active vendors both named "Nem's":
- `Nem's Label` (UUID: `27538c0e-...`) — labels/stationery supplier
- `Nem's Graphics` (UUID: `c4749254-...`) — graphics/print supplier

Any time you see "Nem's" in a transaction, confirm WHICH Nem's by looking at the bank description (e.g., "NEMS GRAPHICS" vs "NEMS LABEL").

### 3. FY boundary payments
A payment made on Apr 1 of the new FY that clears a previous FY bill should still appear in the current FY statement if the statement date range includes Apr 1. Opening balance + payment in same FY = correct balance.

### 4. Uncategorized transactions
A bank transaction that is categorized with a vendor label (shows pink badge in banking UI) but has `is_verified = false` will NOT appear in vendor statements. This cannot happen in normal flow (categorization sets is_verified = true), but check if manually inserted records have this issue.

### 5. OB bill payment status
The `purchase_bills` record with `product_type = 'Opening Balance'` should be updated to `payment_status = 'paid'` / `amount_paid = X` when the opening balance is cleared by a bank payment. This keeps the bills list accurate even though the vendor statement uses bank_transactions directly.

---

## Pre-flight Checklist — Before Any Finance Feature Change

Before modifying vendor statement, client statement, banking categorization, or journal entries:

- [ ] Does this change affect the opening balance? If so, is it shown once and only once?
- [ ] Does this change affect vendor_id linkage on bank_transactions? If so, will it update the right vendor?
- [ ] Does this change affect `is_verified`? Nothing appears in statements if is_verified is false.
- [ ] Are amounts stored as positive values? Do NOT use negative amounts in the DB.
- [ ] Does this change create a new bill/payment record? Will it be double-counted anywhere?
- [ ] Is the FY date boundary (1 Apr) correctly handled?
- [ ] Are there vendors with duplicate display names that could cause wrong-vendor selection?

---

## Bugs Fixed (Chronological Log)

| Date | Bug | Root Cause | Fix |
|---|---|---|---|
| May 2026 | Vendor statement showed double opening balance (₹2,60,694 instead of ₹1,30,694) | OB purchase_bill + vendor.opening_balance both shown in ledger | Skip `product_type = 'Opening Balance'` bills in ledger loop |
| May 2026 | Vendor payment not appearing in statement (PAID = ₹0) | Bank transaction linked to wrong "Nem's" vendor | Updated `bank_transactions.vendor_id` to correct UUID |

---

*Last updated: 21 May 2026. Update this file every time a finance bug is found and fixed.*
