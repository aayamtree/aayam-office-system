# Aayam Office System — System Logic Master Reference

> **Who this is for:** Satish (owner) + Claude (AI collaborator)
> **Rule:** Update this document immediately whenever any module logic is changed, a bug is fixed, or a new feature is added.
> **Source of truth:** This file + `FINANCE_LOGIC_GUARD.md` (finance-specific deep rules)

---

## Table of Contents

1. [Project & Infrastructure](#1-project--infrastructure)
2. [Users & Roles](#2-users--roles)
3. [Finance Module](#3-finance-module)
4. [CRM — Clients](#4-crm--clients)
5. [Vendors](#5-vendors)
6. [Jobs (Production)](#6-jobs-production)
7. [Sales Module](#7-sales-module)
8. [Marketing Module](#8-marketing-module)
9. [Design / Designer Module](#9-design--designer-module)
10. [Dispatch Module](#10-dispatch-module)
11. [Label Studio](#11-label-studio)
12. [CMYK Print Tools](#12-cmyk-print-tools)
13. [Banking & Bank Transactions](#13-banking--bank-transactions)
14. [Reports](#14-reports)
15. [Settings & Configuration](#15-settings--configuration)
16. [Activity Log & Notifications](#16-activity-log--notifications)
17. [Known Issues & Watch List](#17-known-issues--watch-list)
18. [Change Log](#18-change-log)

---

## 1. Project & Infrastructure

| Item | Value |
|---|---|
| App | Aayam Office System — internal ERP for Aayam Creative (printing/packaging) |
| Framework | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Postgres + Auth + Storage) |
| Supabase Project | `wrvbodgsykesbaphpbzs` — region `ap-south-1` (name: `aayam-fresh`) |
| Hosting | Vercel — auto-deploy on push to GitHub `main` |
| GitHub Repo | `aayamtree/aayam-office-system` |
| Local folder | `/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2` |

### Deploy Workflow
Push to `main` → GitHub webhook → Vercel builds → live in ~60 seconds.
Never touch Vercel manually. Always commit + push code changes via git.

### Git Housekeeping
Stale `.git/*.lock` files can block commits if the machine crashed or a git operation was killed.
Fix: delete `index.lock`, `HEAD.lock`, `ORIG_HEAD.lock`, `objects/maintenance.lock` from `.git/`.
Use `mcp__cowork__allow_cowork_file_delete` first if the file tool won't delete them.

---

## 2. Users & Roles

Stored in `public.profiles` (19 users). Auth via Supabase Auth (`auth.users`).

| Role | Who | Access |
|---|---|---|
| `admin` | Satish | Full access to all modules |
| `sales` / `marketing` | Pooja (marketing executive) | Marketing dashboard, quotations, leads, follow-ups, orders, dispatch view |
| `designer` | Design team | Designer module only (tasks, projects, attendance) |
| `dispatch` | Dispatch team | Dispatch module |
| `accounts` | Finance person | Finance module |

### Key Rule — Role-Based Page Rendering
Marketing login shows a different sidebar than admin. The `marketing/quotations` page is a thin re-export of `sales/quotations/page.tsx` — any fix to quotations must be done in `sales/quotations/page.tsx` only.

```
app/admin/marketing/quotations/page.tsx  →  re-exports  →  app/admin/sales/quotations/page.tsx
```

---

## 3. Finance Module

> **Read `FINANCE_LOGIC_GUARD.md` before touching any finance code.**

### 3.1 Indian Financial Year
- FY starts: **1 April** — never change this
- FY ends: **31 March** of the following year
- Any "reset to FY" date filter: `YYYY-04-01`

### 3.2 Opening Balances

**Vendors** — two representations exist:
- `vendors.opening_balance` (numeric) — the actual amount for the ledger
- `vendors.opening_balance_date` — date (usually Apr 1)
- A `purchase_bills` record with `product_type = 'Opening Balance'` and `bill_number = 'OB-...'` — for payment-status tracking only

**GOLDEN RULE:** Vendor statement ledger must SKIP `purchase_bills` where `product_type = 'Opening Balance'`. Opening balance is shown once via `vendor.opening_balance`. Showing both = double-count bug.

**Clients** — single representation only (deliberately different from vendors):
- `clients.opening_balance` (numeric)
- `clients.opening_balance_date`
- `clients.opening_balance_type` — `'debit'` (client owes us) or `'credit'` (we owe client)
- **NO purchase_bill is created** — this was a deliberate design choice to avoid the same double-count bug that hit vendors

### 3.3 Vendor Statement Balance Formula
```
Opening Balance   +₹X   (we owe vendor from before FY)
+ Purchase Bills  +₹Y   (new work billed)
- Bank Payments   -₹Z   (we paid)
= Outstanding     ₹X+Y-Z
```
- Balance > 0 → Payable (red)
- Balance = 0 → Settled (grey)
- Balance < 0 → Advance paid (green ADV badge)

### 3.4 Client Statement Balance Formula
```
Opening Balance   +₹X   (client owes us, debit) OR -₹X (we owe client, credit)
+ Job Invoices    +₹Y   (new jobs billed)
- Payments In     -₹Z   (client paid us)
= Outstanding     ₹X+Y-Z
```

### 3.5 Bank Transactions → Vendor Linkage
A payment appears in a vendor's statement ONLY IF:
1. `bank_transactions.vendor_id` = vendor UUID (exact match)
2. `bank_transactions.is_verified = true`

If `is_verified = false`, the transaction will NOT appear even if vendor_id is correct.

### 3.6 Amount Sign Convention
All amounts in DB are stored as **positive numbers**. Direction is determined by transaction type (income vs expense), not by sign. Never store negative amounts.

### 3.7 Chart of Accounts & Journal Entries
- `chart_of_accounts` — 38 accounts (assets, liabilities, income, expense)
- `journal_entries` / `journal_entry_lines` — double-entry ledger
- Every categorized bank transaction creates journal entries automatically
- Vendor Advance is an asset (prepaid), not an expense — reclassify when bill arrives

### 3.8 Cash Accounts
- `cash_accounts` — 2 cash registers (e.g., main petty cash, secondary)
- `cash_transactions` — all cash in/out movements
- Separate from bank transactions

### 3.9 Key Finance Tables
| Table | Purpose |
|---|---|
| `vendors` | Vendor master (name, company, opening_balance, opening_balance_date) |
| `clients` | Client master (opening_balance, opening_balance_date, opening_balance_type) |
| `purchase_bills` | Vendor bills — includes OB bill (product_type='Opening Balance') |
| `bank_transactions` | Imported bank statements (vendor_id, is_verified, amount, type) |
| `bank_accounts` | Bank account master (1 account currently) |
| `expenses` | Direct expenses not via purchase bill |
| `payments_received` | Client payments received |
| `vendor_payments` | Payments made to vendors |
| `journal_entries` / `journal_entry_lines` | Double-entry accounting |
| `chart_of_accounts` | Account master (38 accounts) |
| `cash_accounts` / `cash_transactions` | Petty cash management |
| `account_transfers` | Transfers between accounts |

---

## 4. CRM — Clients

**File:** `app/admin/crm/clients/page.tsx`

### Display Rule
Always show **company name** as primary: `client.company || client.name`.
Never show contact person as the primary identifier.

### Client Fields (key)
- `name` — contact person name
- `company` — company name (SHOW THIS as primary)
- `phone`, `email`, `address`
- `opening_balance` — numeric, amount from last FY
- `opening_balance_date` — date
- `opening_balance_type` — `'debit'` or `'credit'`

### Opening Balance in Edit Modal
The edit modal has three fields for opening balance:
- Amount (number input)
- Date (date picker)
- Type toggle (Debit = client owes us / Credit = we owe client)
Shows a live summary below: "Client owes you ₹X from last year" or "You owe client ₹X".

### Creating vs Editing
- `handleAddNew()` resets opening_balance to `''`, date to `''`, type to `'debit'`
- `handleEdit(client)` populates from existing client data
- `handleSubmit()` on update: converts `opening_balance` to number (empty string → 0)

---

## 5. Vendors

**File:** `app/admin/finance/vendors/` (list), `app/admin/reports/vendor/[vendorId]/page.tsx` (statement)

### Vendor Fields (key)
- `name` — contact person
- `company` — company name
- `opening_balance` — numeric
- `opening_balance_date` — date
- `vendor_categories` — linked category
- `gstin`, `pan`, `bank_details`

### Known Vendor Name Collision
Two active vendors are both called "Nem's":
- **Nem's Label** (`27538c0e-...`) — labels/stationery
- **Nem's Graphics** (`c4749254-...`) — graphics/print

Any time "Nem's" appears in a bank transaction description, identify which one by the description text (e.g., "NEMS GRAPHICS" vs "NEMS LABEL"). Always show `vendor.company` + `vendor.name` in pickers to distinguish them.

### Vendor Categories
Stored in `vendor_categories` (13 categories). Admin-configurable via Settings.

---

## 6. Jobs (Production)

**Files:** `app/admin/jobs/` and `app/admin/jobs/[id]/page.tsx`

### Job Lifecycle
```
New → Design → Pre-Press → Plate Making → Printing → Finishing → QC → Dispatch → Delivered
```
(Exact stages in `job_stages` table — 11 stages)

### Key Job Fields
- `job_number` — unique identifier (auto-incremented via `counters` table)
- `client_id` — linked client
- `product_type` — category of print work
- `quantity`, `size`, `description`
- `due_date` — deadline
- `current_stage` — current production stage
- `priority` — from `priorities` table (4 levels)
- `assigned_designer` — profile UUID
- `job_type` — from `job_types` table (5 types)

### Job Checklists
`job_checklists` — stage-specific checklists linked via `product_categories.checklist_items`
Each product category can have a production checklist that appears when a job enters that stage.

### Job Stage History
`job_stage_history` (200 records) — full audit trail of every stage transition with timestamps.

### Job Notes
`job_notes` — internal notes attached to jobs, visible to admin and relevant team.

### Subtasks
`job_subtasks` — optional sub-items within a job (e.g., design variant, plate colour).

---

## 7. Sales Module

**Files:** `app/admin/sales/`

### Quotations
**File:** `app/admin/sales/quotations/page.tsx` ← **single source of truth**
`app/admin/marketing/quotations/page.tsx` re-exports this exact file.

**Table:** `quotations` (20 records), `quotation_items` (25 records)

**Quotation Statuses:**
- `draft` — being prepared
- `sent` — sent to client
- `accepted` — client approved
- `rejected` — client declined
- `converted` — converted to a sales order/job

**Accepted Quotations — "→ Order" Button:**
Accepted quotations show a dark button with an arrow icon: `<ArrowRight size={13} /> Order`.
Styled: `bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 flex items-center gap-1.5`

**Bug Fixed (May 2026):** The button was showing garbled mojibake bytes (`Ã¢ÂÂ Order`) caused by wrong UTF-8 encoding of an arrow character. Fixed by replacing with `lucide-react` `ArrowRight` icon.

### Leads
**Table:** `leads` (19 records)
**File:** `app/admin/sales/leads/page.tsx`

### Orders
**Table:** `sales_orders`
**File:** `app/admin/sales/orders/page.tsx`

---

## 8. Marketing Module

**Files:** `app/admin/marketing/`

### What Marketing Sees
Marketing role (Pooja's login) has a separate sidebar but most pages re-export from Sales or share the same logic:
- `marketing/quotations` → re-exports `sales/quotations/page.tsx`
- `marketing/leads` — own page
- `marketing/orders` — own page
- `marketing/follow-ups` — own page
- `marketing/commissions` — commissions tracking

### Follow-Ups
**Table:** `follow_ups` (4 records)
Tracks follow-up activities on leads/clients with due dates and status.

### Commissions
**Table:** `commissions`
Tracks sales commissions for marketing executives.

### Product Requirements
**Table:** `product_requirements`
Stores product specs collected by marketing for Design + Print orders (links marketing → production).

---

## 9. Design / Designer Module

**Files:** `app/admin/designer-module/` (designer's own view), `app/admin/designers/` (admin view)

### Design Tasks
**Table:** `design_tasks` (4 records)
Short-form tasks assigned to designers. Different from full Jobs.

### Design Projects
**Table:** `design_projects`
Larger design projects with multiple deliverables.

### Designer Attendance
**Table:** `designer_attendance` (258 records)
Check-in / check-out times for each designer.
- Admin view: `app/admin/designers/attendance/`
- Designer view: `app/admin/designer-module/attendance/`

### Dossier
**Table:** `dossier_entries` (22 records)
Knowledge base entries — design references, brand guides, technique notes.
Both admin and designer can search the dossier.

### Designer Hours
**Table:** `designer_hours`
Tracks time spent on tasks/projects per designer.

### Task Status History & Time Sessions
- `task_status_history` (14 records) — audit trail of task status changes
- `task_time_sessions` (10 records) — time-tracked work sessions on tasks
- `task_transfers` (4 records) — tasks transferred between designers

---

## 10. Dispatch Module

**Files:** `app/admin/dispatch/`

### Dispatch Flow
Jobs that pass QC move to Dispatch. Dispatch team:
1. Confirms the dispatch
2. Records transporter details
3. Updates job to "Dispatched" / "Delivered"

### Key Tables
- `dispatches` — dispatch records
- Transporters managed via `app/admin/dispatch/transporters/`

### QC Check
`app/admin/dispatch/qc-check/` — quality check gate before dispatch is logged.

---

## 11. Label Studio

**Files:** `app/admin/label-studio/`

### Purpose
Tool for managing label artwork for packaging clients. Covers:
- **Brands** — `label_brands` (2 brands)
- **Products** — `label_products` (1 product)
- **Checks** — `label_checks` — label compliance checks
- **Discoveries** — `label_discoveries` — label audit discoveries
- Extract: extract text/data from label images
- History: version history of label artwork

### Brands
`public.brands` (45 records) — broader brand master (not just labels). Used across modules.

---

## 12. CMYK Print Tools

**Files:** `app/admin/cmyk-print/`

### Tools
- **Cost Calculator** — estimates print job cost based on paper, ink, quantity
- **Paper Stock** — `paper_stocks` table, manages paper inventory/specs
  - `sheet_sizes` — standard sheet sizes
  - `materials` — paper materials/finishes
  - `machines` — printing machines (4 machines)
- **Retail POS** — point-of-sale for walk-in retail print jobs

### Print Runs
**Tables:** `print_runs`, `print_run_jobs`, `print_batches`, `print_batch_items`
Groups multiple jobs into a single print run (efficient plate/ink usage).

---

## 13. Banking & Bank Transactions

**File:** `app/admin/finance/banking/`

### How Bank Statements Are Imported
Bank transactions are imported (CSV/manual) into `bank_transactions`. Each row represents one transaction from the bank statement.

### Categorization
When a transaction is categorized:
1. User picks: vendor payment / client receipt / expense / income etc.
2. Picks the specific vendor, client, or expense category
3. `is_verified` is set to `true`
4. `vendor_id` or `client_id` is set
5. Journal entry is auto-created

### Verification Rule
**`is_verified = false`** = transaction will NOT appear in any statement or report.
Normal UI flow always sets `is_verified = true` on categorization. Only manually inserted rows can have this wrong.

### Pink Badge in Banking UI
An uncategorized transaction shows a pink/warning badge. Once categorized, it shows the vendor/client name.

### Key Fields in `bank_transactions`
| Field | Meaning |
|---|---|
| `amount` | Always positive |
| `type` | `'credit'` (money in) or `'debit'` (money out) |
| `vendor_id` | Linked vendor UUID (nullable) |
| `client_id` | Linked client UUID (nullable) |
| `is_verified` | `true` if categorized |
| `category` | Expense/income category label |
| `description` | Original bank statement text |
| `transaction_date` | Date from bank statement |

---

## 14. Reports

**Files:** `app/admin/reports/`

### Vendor Statement
**File:** `app/admin/reports/vendor/[vendorId]/page.tsx`

Ledger structure:
1. Opening Balance row (from `vendor.opening_balance`)
2. Purchase Bills rows (SKIPPING `product_type = 'Opening Balance'` bills — anti-double-count guard)
3. Bank Payment rows (from `bank_transactions` where `vendor_id` matches AND `is_verified = true`)

### Client Statement
**File:** `app/admin/reports/client/[clientId]/page.tsx`

Ledger structure:
1. Opening Balance row (from `client.opening_balance` — debit or credit depending on `opening_balance_type`)
2. Job Invoice rows (jobs billed to client)
3. Payment rows (payments received from client)

### Finance Reports
**File:** `app/admin/reports/finance/`

### Sales Report
**File:** `app/admin/reports/sales/`

### Dispatch Report
**File:** `app/admin/reports/dispatch/`

---

## 15. Settings & Configuration

**Files:** `app/admin/settings/`

| Setting | What It Does |
|---|---|
| Company | Company name, address, GSTIN, logo |
| Users | User management — add/edit roles |
| Product Categories | Categories for jobs (with checklist linkage) |
| Vendor Categories | Categories for vendors (13 categories) |
| Production | Production stage config |
| Drive | Google Drive OAuth credentials for file upload |
| Notifications | Push notification settings |
| Preferences | UI preferences |
| Profile | User profile editing |

### App Settings Table
`app_settings` (3 rows) — key-value store for global settings (e.g., company name, FY start month).

---

## 16. Activity Log & Notifications

### Activity Log
**Table:** `activity_logs` (672 records)
Tracks all user actions for audit trail: who did what, when, on which record.
**File:** `app/admin/activity/`

### Broadcast Notifications
**Table:** `broadcast_notifications`, `notification_dismissals`
Admin can push a message to all users as a popup.
`notification_dismissals` tracks who has dismissed each notification.
**File:** `app/admin/broadcast/`

### Push Notifications
**Table:** `push_subscriptions` (14 records)
Web Push API — native mobile/desktop notifications when app is in background.

### EOD Reports
**Tables:** `daily_work_reports` (31 records), `report_task_updates` (128 records)
End-of-day reports submitted by employees. Admin can view all in `app/admin/eod-report/admin-view/`.

---

## 17. Known Issues & Watch List

### Active Risks

| Risk | Detail | Status |
|---|---|---|
| Nem's name collision | Two vendors named "Nem's" — wrong one can be selected during categorization | Documented — use company picker, always verify |
| Chandni Printers — PAID = ₹0 | Has opening balance but zero bank payments linked — possible wrong vendor ID | Needs manual verification by Satish |
| ONYX PRINT — PAID = ₹0 | Same issue as Chandni Printers | Needs manual verification by Satish |
| RLS disabled on 27 tables | `bank_transactions`, `purchase_bills`, `quotation_items` etc. have no Row Level Security | Low risk for internal app; fix if app goes public |
| FY boundary payments | Payment on Apr 1 for a prior-FY bill — appears correctly in current FY statement | Working correctly — just watch if date filters are changed |

### Do Not Change These
- The `product_type = 'Opening Balance'` filter in vendor statement ledger — removing it causes double-count
- `is_verified` check on bank_transactions — removing it shows unverified/junk transactions in statements
- The marketing/quotations re-export pattern — don't add separate logic there, fix in sales/quotations only

---

## 18. Change Log

*Add a new row every time you make a significant change to any module.*

| Date | Module | Change | Reason |
|---|---|---|---|
| May 2026 | Finance / Vendor Statement | Skip `product_type='Opening Balance'` bills in ledger loop | Fixed double-count of opening balance (showed ₹2,60,694 instead of ₹1,30,347 for Nem's Graphics) |
| May 2026 | Finance / Banking | Fixed `bank_transactions.vendor_id` for 18-Apr NEMS GRAPHICS payment | Payment was linked to Nem's Label instead of Nem's Graphics — PAID showed ₹0 |
| May 2026 | Finance / FINANCE_LOGIC_GUARD.md | Created this guard document | Prevent future finance logic bugs |
| May 2026 | CRM / Clients | Added opening_balance, opening_balance_date, opening_balance_type fields | Carry-forward last FY balance for clients (debit or credit) |
| May 2026 | Reports / Client Statement | Opening balance row shown at top of client ledger | Brought forward balance from last FY |
| May 2026 | Sales / Quotations | Replaced garbled mojibake arrow bytes with lucide-react ArrowRight icon on "Order" button | Button showed `Ã¢ÂÂ Order` due to UTF-8 encoding corruption |

---

*Last updated: 21 May 2026 — update this file with every module change.*
