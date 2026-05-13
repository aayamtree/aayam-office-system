# 🏗️ Aayam Office — Job-Centric Architecture

## Your Vision
> "Any single Job that comes into the system is the **centerline** — the whole system evolves around it. Once any lead converts to a job, it should go through the system with a **single identification number** connecting everywhere — client, project type, quantity, payment, printing — so it's fully trackable, including financials."

---

## Current State: How Connected Is the Job Today?

### ✅ Already Connected to Job (10 entities)

| Entity | Link | What It Tracks |
|---|---|---|
| **Client** | `job.client_id` | Who ordered it |
| **Vendor** | `job.vendor_id` | Who supplies material |
| **Designer** | `job.designer_id` | Who designs it |
| **Design Task** | `task.job_id` | Design work on this job |
| **Invoice** | `invoice.job_id` | Money charged to client |
| **Payment Received** | `payment.job_id` | Money received from client |
| **Purchase Bill** | `bill.job_id` | Cost of materials/services |
| **Dispatch** | `dispatch.job_id` | Shipping details |
| **Print Run Job** | `print_run_job.job_id` | Which print batch includes this |
| **Commission** | `commission.job_id` | Marketing person's commission |

### 🟡 Pre-Sales (Intentionally NOT Connected to Job)

> Leads only convert to Jobs **after client confirmation + 50% advance payment**.
> So Lead and Follow-up are pre-sales activities — they belong to the **marketing pipeline**, not the job lifecycle.

| Entity | Connection | Correct Behavior |
|---|---|---|
| **Lead** | → `client_id` (after conversion) | Lead converts to Client first, then Client gets a Job |
| **Follow-Up** | → `lead_id` / `client_id` | Pre-sales activity, doesn't need `job_id` |
| **Quotation** | → `converted_to_job_id` | Bridge between pre-sales and job lifecycle |

### 🔴 Needs Fixing

| Entity | Problem | Fix |
|---|---|---|
| **Quotation** | `converted_to_job_id` exists but rarely populated | Auto-set when Job is created from Quote |
| **Sales Order** | Weak link to Job | Ensure `job.sales_order_id` is always set |
| **Expense** | No `job_id` field | Add optional `job_id` (some expenses are job-specific, most are general) |
| **Bank Transaction** | Generic `reference_id` | Keep as-is, use reports to aggregate per job |

---

## The Ideal Flow: Two Worlds Connected by Quotation

```
=== PRE-SALES (Marketing World) ===        === JOB LIFECYCLE (Operations World) ===

Lead → Follow-ups → Quotation  ─────────→  🎯 JOB (AAY-26-1234)
  ↓                    ↓                         ↓
Client             50% Advance              Design Tasks
                   Confirmed?               Print Planner (internal batch)
                      ↓                     QC Check
                   YES → Create Job         Dispatch
                   NO  → More follow-ups    Invoice → Payment
                                            Purchase Bills
                                            Commission
```

### Print Planner Structure (Internal Only):
```
Print Run #PR-001 (Internal batch — client never sees this)
  ├── Job AAY-26-1234 (Client A - 5000 labels)
  ├── Job AAY-26-1235 (Client B - 2000 stickers)  
  └── Job AAY-26-1240 (Client C - 3000 boxes)
  
  Machine: XYZ | Sheet: 20x30 | Material: Art Card 300gsm
```
> Print Run ID = internal planning only
> Each Job inside connects to its own Client, Invoice, Dispatch etc.

**One Job Number (AAY-26-1234) should appear on:**
- Quotation → "For Job #AAY-26-1234"
- Design Task → "Task for #AAY-26-1234"  
- Print Run → "Includes #AAY-26-1234"
- Invoice → "Invoice for #AAY-26-1234"
- Dispatch → "Shipping #AAY-26-1234"
- Purchase Bill → "Material for #AAY-26-1234"
- Payment → "Payment against #AAY-26-1234"

---

## What Needs to Change

### Fix 1: Expenses — Add Optional `job_id`

```diff
Expense {
  expense_number: string
  category: string        // "office_supplies", "staff", "food", "job_material"
+ job_id?: string         // OPTIONAL — only set for job-specific expenses
  amount: number
}
```
> Most expenses (staff salary, rent, food) are general → `job_id = null`
> Some expenses (special material for a job) are job-specific → `job_id = AAY-26-1234`

### Fix 2: Better Lead → Job Bridge

Leads don't connect to Jobs directly, but we can trace the path:

```
Lead #L-001 → Quotation #Q-001 → Job #AAY-26-1234
     ↓              ↓
  client_id    converted_to_job_id
```

When creating a Job from a Quotation:
- Auto-set `quotation.converted_to_job_id = job.id`
- Auto-set `job.client_id` from quotation
- The Lead is traceable via: Lead → Quotation → Job

### Fix 3: Job Financial Summary (Computed View)

For any job, compute:
```
Revenue    = SUM(invoices.total_amount)       WHERE job_id = X
Received   = SUM(payments.amount)             WHERE job_id = X  
Costs      = SUM(purchase_bills.total_amount) WHERE job_id = X
              + SUM(expenses.amount)          WHERE job_id = X
              + (design_hours × hourly_rate)
Profit     = Revenue - Costs
Balance    = Revenue - Received
Commission = SUM(commissions.commission_amount) WHERE job_id = X
```

---

## Tables You Actually Need (Minimum)

### Pre-Sales Tables (Marketing World)

| # | Table | Purpose | Connects To |
|---|---|---|---|
| 1 | **leads** | Incoming inquiries | → `client_id` (after conversion) |
| 2 | **follow_ups** | Sales follow-up activity | → `lead_id` / `client_id` |
| 3 | **quotations** + items | Price proposals | → `converted_to_job_id` (bridge to Job) |

### Job-Centric Tables (Operations World)

| # | Table | Purpose | Job Link |
|---|---|---|---|
| 4 | **jobs** | 🎯 **THE CENTER** | Self |
| 5 | **design_tasks** + remarks | Design work | `job_id` |
| 6 | **print_runs** + print_run_jobs | Print batching (INTERNAL) | Jobs inside via `print_run_jobs.job_id` |
| 7 | **dispatches** | Shipping to client | `job_id` |
| 8 | **invoices** + items | Billing | `job_id` |
| 9 | **payments_received** | Money from client | `job_id` |
| 10 | **purchase_bills** | Material/vendor costs | `job_id` |
| 11 | **commissions** | Marketing payouts | `job_id` |

### People & Config Tables

| # | Table | Purpose |
|---|---|---|
| 12 | **profiles** | Users/staff |
| 13 | **clients** | Customer database |
| 14 | **vendors** | Supplier database |
| 15 | **bank_accounts** | Banking |
| 16 | **product_categories** | Box/Label/Pouch/Sheet |
| 17 | **machines** | Print machine config |
| 18 | **expenses** | General biz expenses (optional `job_id`) |
| 19 | **activity_logs** | Audit trail |

### Utility Tables (Keep as-is)

| Table | Purpose |
|---|---|
| **notes** | Sticky notes |
| **reminders** | Personal reminders |
| **pos_sales/products** | Retail POS (separate module) |
| **paper_stock** | Paper inventory |
| **calendar_events** | Personal calendar |
| **eod_reports** | Daily reports |

> **Total: 18 core + 9 optional = 27 tables**  
> This is already lean. Most ERP systems have 100+ tables.

---

## Recommended Actions (Priority Order)

### Phase 1: Fix the Connections (No New Pages)
1. Ensure every Invoice, Payment, Purchase Bill, Design Task **always** has a `job_id`
2. When converting Quote → Job, auto-set `converted_to_job_id`
3. Add `job_id` to Expenses table

### Phase 2: Job Detail Page (Single View)
Create a **Job 360° View** page showing everything for one job:
- Client info, project type, quantity
- Design tasks (status, files)
- Print run assignment
- QC status
- Dispatch status 
- Financial summary (invoiced, received, costs, profit)
- Timeline of all activity

### Phase 3: Simplify (Remove Redundancy)
- Consider merging Sales Order into Job (one less step)
- Consider making Design Project = Job (avoid two tracking systems)

> **IMPORTANT:** The current database is **already 80% job-centric**. The main fixes are just ensuring the `job_id` foreign key is consistently populated across all related records.
