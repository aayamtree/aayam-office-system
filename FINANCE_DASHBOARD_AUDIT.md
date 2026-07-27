# Admin App Audit — Broken Links & Wrong-Data Cards
_Date: 26 June 2026 · Project: aayam-office-2 · Supabase: wrvbodgsykesbaphpbzs_

## What this audit checked
Two classes of problem across the **whole admin app**:
1. **Broken links** — buttons/cards pointing to pages that don't exist (404s).
2. **Wrong-data cards** — a card or chart wired to a table that is empty, so it shows ₹0 even though the real data lives in another table.

---

## 1. Broken links — CLEAN ✅
- 58 internal `/admin/...` links checked against 121 real page routes.
- **0 broken links found.** (The only flagged item, `/admin/jobs/${id}`, resolves to the real `/admin/jobs/[id]` page.)

Nothing to fix here.

---

## 2. The root cause behind the wrong-data cards
Your app was originally built around an **Invoices / Payments** model, but the business now records money through the **Banking + Ledger** model. The result:

| Table the card reads | Rows | Status |
|---|---|---|
| `invoices` | **0** | empty — unused |
| `payments_received` | **0** | empty — unused |
| `expenses` | **0** | empty — unused |
| `journal_entries` (ledger) | 29 | ✅ real data |
| `bank_transactions` | 79 (₹41.7L) | ✅ real data |
| `vendor_payments` | 17 (₹1.46L) | ✅ real data |
| `cash_transactions` | 17 (₹1.46L) | ✅ real data |
| `purchase_bills` | 6 (₹10.16L) | ✅ real data |

**Ledger truth (FY 2026‑27):** Income ₹5,59,187 · Expenses ₹7,84,732.

Any card still reading the three empty tables shows ₹0. That is exactly the Expenses bug — and it was not the only one.

---

## 3. Card-by-card findings

| # | Card / Chart | Was reading | Showed | Verdict | Action |
|---|---|---|---|---|---|
| 1 | **Expenses** (Overview) | `expenses` (empty) + June-only scope | ₹0 | ✗ Wrong | **Fixed** → ledger FY total ₹7.85L |
| 2 | **Revenue vs Received** chart | `invoices` (empty) | all ₹0 | ✗ Wrong | **Fixed** → bank income (Apr ₹3.31L, May ₹2.28L) |
| 3 | **Revenue (This Month)** KPI | `invoices` (empty) | ₹0 | ✗ Wrong source | **Fixed** → ledger income (June genuinely ₹0 so far) |
| 4 | **Received** KPI | `invoices.amount_paid` | ₹0 | ✗ Wrong source | **Fixed** → bank income |
| 5 | **Invoice Status** (Paid/Pending/Partial/Overdue) | `invoices` (empty) | all 0 | ⚠ Needs your decision | See below |
| 6 | **Outstanding** | `invoices` (empty) | ₹0 | ⚠ Needs your decision | See below |
| 7 | **Purchases** (bills pending) | `purchase_bills` | 5 bills · ₹8.85L due | ✅ Correct | none |
| 8 | **Payments — received this month** | ledger/bank | ₹0 (June) | ✅ Correct (no June income yet) | none |

---

## 4. Fixes applied in this pass
All changes are in two files and pass type-checking (0 errors):

- `app/admin/finance/FinanceClient.tsx` — Expenses card now shows FY-to-date total.
- `lib/finance-overview-data.ts` — Revenue chart + Revenue/Received KPIs now read verified bank income (the ledger source of truth) instead of the empty `invoices` table.

> Not yet deployed — these go live only after a push to GitHub (Vercel rebuild).

---

## 5. Needs your decision — Invoice Status & Outstanding
These two cards depend on the **Invoices module**, which currently has **0 records**. Two possibilities:

- **(a) You don't use Invoices** — income is recorded via bank deposits. Then these cards are simply irrelevant and should be hidden, or repointed to the ledger.
- **(b) You do intend to use Invoices** — then the real bug is that invoices aren't being saved, which is a separate fix.

Tell me which, and I'll either hide/repoint them or investigate the save path.

---

## 6. Data hygiene (not a code bug)
**44 bank transactions totalling ₹25.6L are uncategorised / unverified**, so they're excluded from your P&L:
- 23 inflows = ₹14,11,138
- 21 outflows = ₹11,49,758

Categorising them in the **Banking** module will make the dashboard totals fuller. This is data entry, not a code problem.

---

## 7. Stale-data loops — when a figure or status "doesn't push"
This is the bigger pattern: a save succeeds but the number/status on screen stays frozen. Every instance is one of three causes:

| Cause | What happens | How to tell | Fix |
|---|---|---|---|
| **1. Cached / not-refreshed screen** | Save worked in DB, page shows old copy | Hard refresh (Cmd+Shift+R) fixes it | `revalidate = 0` / `router.refresh()` after save |
| **2. Sync step skipped** | Saved to one table, derived field in another not updated | Hard refresh doesn't help; DB itself stale | Enforce with a **DB trigger** |
| **3. Silent write failure** | Save never happened (anon/RLS) | Hard refresh doesn't help; nothing in DB | Route writes through service-role API |

**Two tests to classify any loop:** (a) hard refresh — if it fixes, it's #1; (b) check the value in the DB — if DB is right but screen wrong, it's #1; if DB is wrong, it's #2 or #3.

### What the audit found
- Finance page was cached 60s (`revalidate = 60`); Dashboard 30s. → both set to `0` (always live).
- `router.refresh()` was used in only **one** file app-wide → added to expense logging.
- Stage sync (`print_runs` → `jobs.current_stage`) was app-code only, so any skipped path froze the status. → replaced with a **database trigger** (forward-only, can't drag a job backward).
- **Stale-stage detector run today: 0 jobs stuck behind their print run.** Current data is consistent; the trigger prevents future freezing.

### Fixes applied
- `app/admin/finance/page.tsx`, `app/admin/dashboard/page.tsx` — `revalidate = 0` (live).
- `app/admin/finance/expenses/quick/page.tsx` — `router.refresh()` after a successful save.
- DB migration `print_run_stage_sync_trigger` — triggers `trg_sync_print_run_to_jobs` (on `print_runs`) and `trg_sync_job_added_to_run` (on `print_run_jobs`) keep `jobs.current_stage` correct automatically.

---

## Appendix — how to re-run this audit
**Broken links:** list every `page.tsx` route, list every `href`/`router.push('/admin/...')`, and diff them.

**Empty-table check (SQL):**
```sql
select 'invoices' t, count(*) from invoices
union all select 'payments_received', count(*) from payments_received
union all select 'expenses', count(*) from expenses
union all select 'journal_entries', count(*) from journal_entries
union all select 'bank_transactions', count(*) from bank_transactions;
```
Any table that's `0` but is read by a dashboard card is a wrong-data card.

**Stale-stage detector (jobs frozen behind their print run):**
```sql
with rank(stage,ord) as (values
  ('new',0),('designing',1),('approval',2),('pre_print_qc',3),('print_file_ready',4),('file_sent_client',5),
  ('file_received',6),('file_check',7),('ready_to_print',8),('printing',9),('material_received',10),
  ('quality_check',11),('ready',12),('dispatched',13),('delivered',14),('cancelled',15))
select j.job_number, j.current_stage, pr.status run_status,
  fn_print_run_implied_stage(pr.status, pr.delivery_mode) implied
from print_run_jobs prj
join print_runs pr on pr.id = prj.print_run_id
join jobs j on j.id = prj.job_id
join rank rc on rc.stage = j.current_stage
join rank ri on ri.stage = fn_print_run_implied_stage(pr.status, pr.delivery_mode)
where rc.ord < ri.ord;   -- job is BEHIND its run = stale
```
Empty result = no frozen jobs.
