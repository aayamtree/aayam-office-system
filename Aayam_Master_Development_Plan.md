# Aayam Office System — Master Development Plan
**Date:** 9 Feb 2026 | **Version:** 1.0

---

## Business Context
Aayam is a 24-year-old graphic design and print agency. The system manages the full workflow:

```
Marketing → Design → Print Setup → Printing → QC → Dispatch
```

### Key Business Rules (from owner input):
1. **Leads don't connect to Jobs directly** — leads convert only after client confirmation + 50% advance payment
2. **Not all clients come from leads** — many are existing/repeat clients or referrals from other clients
3. **Expenses are two types** — general (staff, rent, food) and job-specific (special materials)
4. **Print Planner batches multiple jobs** — Print Run ID is internal-only, individual jobs connect to their own clients
5. **Job is the centerline** — everything revolves around a single Job Number

---

## Current System Status

### ✅ Working Well (25 modules, 68 pages)
- Lead capture, follow-ups, quotations, sales orders
- Job creation with stage tracking (Kanban + List view)
- Design studio (tasks, projects, drive integration)
- Print planner (runs, machine/sheet/material config)
- Dispatch (QC checklist, transporter, history)
- Finance (invoices, payments, banking, vendors, expenses)
- CRM, reports, calendar, EOD, activity logs, POS

### 🔴 Issues Found
| # | Issue | Category |
|---|---|---|
| 1 | Quotation `converted_to_job_id` rarely set | Broken link |
| 2 | Expenses have no optional `job_id` | Missing field |
| 3 | No job stage auto-progression | Workflow gap |
| 4 | No client approval tracking UI | Workflow gap |
| 5 | No design-to-print file handoff | Workflow gap |
| 6 | Print queue doesn't separate by product type (label/box/pouch) | Workflow gap |
| 7 | No post-print finishing checklist | Workflow gap |
| 8 | No `referred_by` on clients | Missing field |
| 9 | No repeat order cloning | Missing feature |
| 10 | No client job history view | Missing feature |
| 11 | No per-job profit calculation | Missing feature |
| 12 | No advance payment checkpoint | Missing feature |

---

## Implementation Phases

### Phase 1: Fix Database Connections *(Quick Wins)*

> Goal: Ensure all entities properly link back to Job for full traceability.

#### 1A. Add `job_id` to Expenses

**File:** `types/database.ts`  
```diff
export interface Expense extends BaseEntity {
  expense_number: string;
  category: string;
+ job_id?: string;       // Optional — only for job-specific expenses
  amount: number;
  ...
}
```

**SQL Migration:**
```sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);
```

**UI Change:** Add optional "Link to Job" dropdown in expense form (finance page).

---

#### 1B. Auto-Set `converted_to_job_id` on Quotations

**File:** `lib/hooks.ts` → `useJobs.createJob`  
When creating a job that references a quotation/sales order, auto-update:
```
quotation.converted_to_job_id = new_job.id
```

**No UI change needed** — happens automatically in the hook.

---

#### 1C. Add `referred_by` to Client

**File:** `types/database.ts`  
```diff
export interface Client extends BaseEntity {
  ...
  brand_name?: string;
+ referred_by?: string;   // Client ID who referred this client
}
```

**SQL Migration:**
```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES clients(id);
```

**File:** `app/admin/crm/clients/page.tsx`  
- Add "Referred By" dropdown (list of existing clients) to client form
- Show referral in view modal and table

---

#### 1D. Quoted Qty vs Actual Qty (Print Overrun)

> **Business Rule:** Quotation is based on fixed quantity, but actual print output can be 5-10% more (overrun). Invoice must bill on **actual delivered quantity**, not quoted.

**File:** `types/database.ts`  
```diff
export interface Job extends BaseEntity {
  ...
  quantity: number;           // Ordered/quoted quantity
+ actual_quantity?: number;   // Actual delivered qty (after overrun)
  quote_per_piece: number;
  ...
}
```

**SQL Migration:**
```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_quantity INTEGER;
```

**UI Changes:**
- Job form: `quantity` field label → "Ordered Qty"
- After printing, add "Actual Qty" field (editable before invoicing)
- Invoice generation: use `actual_quantity` if set, else fall back to `quantity`
- Job card/detail: show both → "Ordered: 5,000 | Actual: 5,400"

---

#### 1E. Split Payment Tracking

> **Business Rule:** A single payment can be split across modes: part cash + part bank/UPI. GST trail matters only for bank/UPI payments (not cash). Need summaries by month, client, quarter.

**Current problem:** `PaymentReceived` has single `amount` + single `payment_mode`. Can't record "₹25K cash + ₹25K bank" as one transaction.

**Solution:** Add payment splits to each payment record.

**File:** `types/database.ts`
```diff
export interface PaymentReceived extends BaseEntity {
  payment_number: string;
  client_id?: string;
  invoice_id?: string;
  job_id?: string;
  amount: number;           // Total payment amount
- payment_mode: PaymentMode;
+ payment_mode: PaymentMode; // Primary mode (for backward compatibility)
+ splits?: PaymentSplit[];   // Breakdown by mode
  payment_date: string;
  bank_account_id?: string;
  reference_number?: string;
  notes?: string;
  received_by?: string;
  attachment_url?: string;
}

+ // Payment Split — one payment can have multiple modes
+ export interface PaymentSplit {
+   id: string;
+   payment_id: string;
+   mode: PaymentMode;        // 'cash' | 'bank_transfer' | 'upi' | etc.
+   amount: number;
+   bank_account_id?: string; // Which bank account (for bank/UPI)
+   reference_number?: string;
+   has_gst: boolean;         // GST applicable on this split?
+ }
```

**SQL Migration:**
```sql
CREATE TABLE IF NOT EXISTS payment_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES payments_received(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  bank_account_id UUID REFERENCES bank_accounts(id),
  reference_number TEXT,
  has_gst BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage payment splits" ON payment_splits
  FOR ALL USING (true) WITH CHECK (true);
```

**UI Changes (Payment form):**
- Default: single mode (backward compatible)
- Toggle: "Split Payment" → shows two rows:
  - Split 1: Mode dropdown + Amount + Bank account (if bank/UPI) + GST checkbox
  - Split 2: Mode dropdown + Amount + Bank account + GST checkbox
- Total must equal payment amount
- Example: ₹50,000 → Cash: ₹25,000 + UPI: ₹25,000 (GST ✓)

**Reports (Phase 4D):**
- Monthly collection: Total cash / Total bank / Total UPI
- Client-wise: All payments grouped by client with split breakdown
- Quarterly: GST-applicable vs non-GST collections
- Job-wise: All payments linked to a job

---

### Phase 2: Client Enhancement Features

> Goal: Support the 24-year agency workflow — most clients are existing/repeat/referred.

#### 2A. Repeat Order Button on Jobs

**File:** `app/admin/jobs/page.tsx`

Add `handleRepeatOrder(job)` function:
- Copies: `client_id`, `job_type`, `product_category`, `designer_id`, `vendor_id`, `quote_per_piece`, `gst_rate`, `quantity`
- Sets: `project_name = "{original} (Repeat)"`, `current_stage = 'new'`, `payment_status = 'pending'`
- Opens New Job modal pre-filled

Add Copy icon button to JobCard hover actions (next to Edit, Payment, Delete).

---

#### 2B. Client History View (Enhanced View Modal)

**File:** `app/admin/crm/clients/page.tsx`

Replace simple view modal with a richer panel:
- **Client Info**: name, phone, email, address, brands, referred_by
- **Jobs**: All jobs for this client (job number, project name, stage, amount)
- **Financial Summary**: Total billed, total received, outstanding balance
- **Quick Actions**: "Create New Job for Client", "View Invoices"

Fetches data using existing hooks (`useJobs`, `useInvoices`).

---

### Phase 3: Workflow Improvements

> Goal: Automate job progression and improve operational tracking.

#### 3A. Job Stage Auto-Progression

**Files:** `lib/hooks.ts`, `app/admin/designers/tasks/page.tsx`, `app/admin/dispatch/qc-check/page.tsx`

Rules:
- When design task status → `completed` → auto-move linked job to `approval`
- When client approval marked → auto-move job to `printing`
- When QC status → `passed` → auto-move job to `ready`
- When dispatch created → auto-move job to `dispatched`

Implementation: Add auto-stage logic in the respective hooks/pages.

---

#### 3B. Print Queue Product Type Separation

**File:** `app/admin/production-queue/page.tsx` or `app/admin/print-planner/[id]/page.tsx`

Add filter tabs at top of print queue:
- **All** | **Labels** | **Boxes** | **Pouches** | **Sheets** | **Stickers**

Filter based on `job.product_category` field. Each tab shows only jobs of that type.

---

#### 3C. Client Approval Tracking

**File:** `app/admin/designers/tasks/page.tsx` or new component

Add actions on design tasks:
- "Send for Approval" → sets `job.client_approval = false`, marks as sent
- "Client Approved" → sets `job.client_approval = true`, `job.approval_date = now()`
- Auto-moves job stage to `printing` (per 3A)

---

#### 3D. Post-Print Finishing Checklist

**File:** `types/database.ts` (extend existing `JobChecklist`)

The `job_checklists` table already supports `category: 'design' | 'dispatch'`.  
Add a `'finishing'` category with items like:
- Lamination, Die-cutting, Folding, Gluing, Binding (configurable per product type)

**File:** New component or extend existing QC check page.

---

#### 3F. Print Planner — UPS-Based Quantity Calculation

> **Business Rule:** Each job in a print run has a different number of "UPS" (copies) per sheet based on design size. UPS × Sheets = Final output quantity. Same sheet count → different output per job.

**Example:**
```
Print Run #PR-001 → 1000 sheets of 20x30
├── Job AAY-26-1234 (Label 50x30mm)   → 40 ups/sheet → 40 × 1000 = 40,000 labels
├── Job AAY-26-1235 (Label 100x60mm)  → 12 ups/sheet → 12 × 1000 = 12,000 labels  
└── Job AAY-26-1240 (Box 150x100mm)   →  6 ups/sheet →  6 × 1000 =  6,000 boxes
```

**Current state:** `PrintRunJob` already has `ups_in_sheet` and `qty_on_sheet` fields, but no calculated output or actual output.

**File:** `types/database.ts`
```diff
export interface PrintRunJob extends BaseEntity {
  print_run_id: string;
  job_id: string;
  client_name?: string;
  item_name?: string;
  qty_on_sheet?: number;
  quantity_needed?: number;
  ups_in_sheet?: number;
+ sheets_to_print?: number;      // How many sheets to print for this job
+ expected_output?: number;      // Auto: ups_in_sheet × sheets_to_print
+ actual_output?: number;        // Actual produced (for overrun tracking)
  file_version?: string;
  notes?: string;
}
```

**SQL Migration:**
```sql
ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS sheets_to_print INTEGER;
ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS expected_output INTEGER;
ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS actual_output INTEGER;
```

**UI Changes (Print Planner page):**
- When adding job to print run: enter UPS per sheet
- System auto-calculates: `sheets_to_print = CEIL(quantity_needed / ups_in_sheet)`
- Shows expected output: `expected = ups_in_sheet × sheets_to_print`
- After printing: enter actual output (for overrun/underrun)
- Summary per print run: table showing each job, ups, sheets, expected, actual

**Print Run Summary View:**
```
| Job #      | Product    | UPS | Sheets | Expected | Actual | Overrun |
|------------|------------|-----|--------|----------|--------|---------|
| AAY-26-1234| Label      |  40 |  1000  |  40,000  | 41,200 |  +3.0%  |
| AAY-26-1235| Label      |  12 |  1000  |  12,000  | 12,400 |  +3.3%  |
| AAY-26-1240| Box        |   6 |  1000  |   6,000  |  5,900 |  -1.7%  |
```

---

#### 3E. Role-Based Privacy Enforcement (RBAC)

> **Business Rule:** Each section only sees their own data. Marketing can't see design files. Designers can't see dispatch or finance. But the Job flows seamlessly between all sections.

**Current state:** Sidebar already has `allowedRoles` per menu. Dashboard redirects by role. Some pages filter by `created_by`. But enforcement is **inconsistent** — many pages are accessible to all.

**Privacy Matrix:**

| Data / Page | Admin | Marketing | Designer | Dispatch | Finance | CMYK |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Leads & Follow-ups** | ✅ | ✅ own | ❌ | ❌ | ❌ | ❌ |
| **Clients** | ✅ | ✅ own | ❌ | ❌ | ✅ read | ❌ |
| **Quotations** | ✅ | ✅ own | ❌ | ❌ | ✅ | ❌ |
| **Jobs (overview)** | ✅ | ✅ own clients | ✅ assigned | ✅ ready+ | ✅ | ✅ assigned |
| **Design Tasks** | ✅ | ❌ | ✅ assigned | ❌ | ❌ | ❌ |
| **Print Planner** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Dispatch** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Invoices** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Payments** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Expenses** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Reports** | ✅ | own only | own only | own only | ✅ | own only |
| **Settings** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Implementation approach:**
- Sidebar filtering: already exists ✅
- Page-level guards: add `if (role !== 'admin' && !allowedRoles.includes(role)) redirect`
- Data-level filtering: filter queries by `assigned_to`, `created_by`, or `designer_id`
- Job flow: Jobs are visible in read-only at each section's relevant stage

---

### Phase 4: New Features *(Lower Priority)*

#### 4A. Job 360° View Page

**File:** New page `app/admin/jobs/[id]/page.tsx`

Single page showing everything about one job:
- Client info, project type, quantity, dates
- Design tasks (status, files, drive links)
- Print run assignment
- QC status & dispatch info
- Financial summary (invoiced, received, costs, profit)
- Activity timeline

---

#### 4B. Overdue Alerts Dashboard Widget

**File:** `app/admin/dashboard/page.tsx`

New dashboard card "⚠️ Overdue Items" showing:
- Jobs past deadline
- Invoices past due date
- Follow-ups past schedule

---

#### 4C. WhatsApp Quick Links

**Files:** Client cards, Lead cards, Dispatch pages

Add a WhatsApp icon button that opens `https://wa.me/91{phone}` for quick messaging.

---

#### 4D. Payment Reports Dashboard

**File:** New page or extend `app/admin/finance/reports/page.tsx`

Comprehensive payment reports:
- **Monthly summary:** Total collections, cash vs bank vs UPI breakdown
- **Client-wise:** All payments per client, with mode splits
- **Quarterly:** GST-applicable collections vs non-GST (for filing)
- **Job-wise:** Revenue, received, costs, profit per job
- **Outstanding:** Clients with pending balances

Filters: Date range, client, payment mode, GST status.

---

#### 4E. Section Performance Monitoring & Reports

> **Business Rule:** Each section must be accountable. Monitor performance monthly/quarterly. Admin sees all; each section sees their own stats.

**KPIs per Section:**

| Section | KPIs (Monthly/Quarterly) |
|---|---|
| **Marketing** | Leads generated, conversion rate, revenue from converted leads, follow-up frequency, clients added |
| **Design** | Tasks completed, avg turnaround time, revision count, on-time delivery %, workload per designer |
| **Print (CMYK)** | Print runs completed, jobs printed, machine utilization, wastage/overrun % |
| **Dispatch** | Dispatches completed, on-time delivery rate, pending dispatches, QC pass rate |
| **Finance** | Total collections, cash vs bank split, outstanding balance, invoices raised, expenses |

**Implementation:**

1. **Admin Dashboard widgets** — add section summary cards:
   - Marketing: "X leads this month, Y converted"
   - Design: "X tasks done, avg Z days turnaround"
   - Dispatch: "X dispatches, Y% on-time"
   - Finance: "₹X collected, ₹Y outstanding"

2. **Section-specific dashboards** — each role's dashboard shows their own KPIs

3. **Reports page** — filterable by section, date range, person
   - Exportable summaries (monthly/quarterly)
   - Comparison: this month vs last month

---

#### 3G. Shared Calendar System

> **Business Rule:** Single shared calendar. Everyone enters events. Each person sees their own entries filtered by default, but can view "Team" view. Calendar widget visible on every dashboard.

**Current state:** Calendar exists (`UserCalendarEvent` table) with `user_id`, mentions via @, weekly grid, daily briefing. But it's **personal only** — no team view, no auto-events, no dashboard widget.

**Enhancements:**

**1. Shared View Toggle:**
```
[My Events] [Team Events] [All]
```
- **My Events** (default): filter by `user_id = me` OR `tagged_users includes me`
- **Team Events**: filter by same role/department
- **All** (admin only): everyone's events

**2. Auto-Generated Events (System → Calendar):**

| System Action | Calendar Event Created |
|---|---|
| Job created with deadline | "🔴 Job #AAY-26-1234 Deadline" (assigned to designer) |
| Follow-up scheduled | "📞 Follow-up: Client Name" (assigned to marketer) |
| Dispatch scheduled | "🚚 Dispatch: Job #1234 to Client" (assigned to dispatch) |
| Invoice due date | "💰 Invoice #INV-089 Due" (assigned to finance) |
| Design task assigned | "🎨 Design: Project Name" (assigned to designer) |

These auto-events are **read-only** (can't delete, auto-removed when source changes).

**3. Event Categories with Colors:**

| Category | Color | Used By |
|---|---|---|
| Job Deadline | 🔴 Red | All |
| Follow-up | 🟡 Yellow | Marketing |
| Design Task | 🔵 Blue | Designer |
| Print Schedule | 🟣 Purple | CMYK |
| Dispatch | 🟢 Green | Dispatch |
| Payment Due | 🟠 Orange | Finance |
| Meeting | ⚫ Gray | All |
| Personal | ⚪ White | Personal |

**4. Dashboard Mini-Calendar Widget:**
- Compact 7-day strip on every dashboard
- Shows today's events count + next upcoming event
- Click to expand full calendar
- Color dots for event types

**5. Type Changes:**
```diff
export interface UserCalendarEvent {
  ...
  user_id: string;
+ visibility: 'private' | 'team' | 'all';   // Who can see this event
+ source: 'manual' | 'auto';                 // Auto = system-generated
+ source_type?: 'job' | 'followup' | 'dispatch' | 'invoice' | 'task';
+ source_id?: string;                        // Link back to source entity
  ...
}
```

**SQL Migration:**
```sql
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'team';
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS source_id UUID;
```

**💡 Suggestions to Make Calendar Better:**

| Suggestion | Why It Helps |
|---|---|
| **Auto-deadline sync** | When job deadline changes, calendar event updates automatically |
| **Morning briefing** | 8:30 AM notification: "Today you have: 3 tasks, 2 follow-ups, 1 dispatch" |
| **Overdue highlighting** | Past events that aren't completed show in red |
| **Drag-and-drop reschedule** | Drag an event to move it to another day |
| **Weekly planning view** | Monday morning: see the full week ahead for your section |
| **Admin bird's-eye** | Admin sees all sections' events overlaid — spots scheduling conflicts |
| **Recurring auto-events** | "Every Friday 4 PM: Weekly team meeting" |

---

#### 3H. Dashboard Sticky Notes System

> **Business Rule:** Each user can create personal notes/reminders on their dashboard. Can tag users across sections to share notes.

**New table:** `user_notes`

```sql
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'personal',     -- 'personal' | 'pinned' | 'shared'
  tagged_users UUID[] DEFAULT '{}',      -- Who can see shared notes
  job_id UUID REFERENCES jobs(id),       -- Optional link to a job
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON user_notes
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = ANY(tagged_users));
```

**TypeScript type:**
```typescript
export interface UserNote {
  id: string;
  user_id: string;
  content: string;
  note_type: 'personal' | 'pinned' | 'shared';
  tagged_users?: string[];
  job_id?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  creator?: UserProfile;
  job?: Job;
}
```

**Dashboard widget:** Collapsible panel showing pinned notes first, then recent. Quick-add with @mention support. Badge for unread shared notes.

---

### Phase 4: New Features

#### 4A–4C. Job 360°, Alerts, WhatsApp
*(As previously defined)*

---

#### 4F. Business Reports Hub

> **Goal:** Generate actionable reports from ALL system data. Admin sees everything; each section sees their own.

**File:** New page `app/admin/reports/page.tsx` with sub-tabs

**Report Categories:**

---

**📊 1. Sales & Revenue Reports**

| Report | Data Source | Shows |
|---|---|---|
| Monthly Revenue | Jobs + Invoices | Total billed, collected, outstanding per month |
| Client Revenue Ranking | Jobs + Payments | Top 10/20 clients by revenue |
| Product Type Revenue | Jobs (product_category) | Revenue by label/box/pouch/sticker/other |
| Quotation Conversion | Quotations | Quotes sent vs accepted vs rejected rate |
| Job Type Analysis | Jobs (job_type) | Design-only vs Design+Print vs Print-only revenue split |
| Average Order Value | Jobs | Avg job value, trend over months |
| Repeat Client Rate | Jobs + Clients | % of revenue from repeat clients vs new |

---

**🏭 2. Production Reports**

| Report | Data Source | Shows |
|---|---|---|
| Job Turnaround Time | Jobs (created → dispatched) | Avg days per stage, bottleneck identification |
| Stage-wise Bottleneck | Jobs (current_stage) | How many jobs stuck at each stage and for how long |
| Print Overrun/Underrun | Jobs (actual_qty vs quantity) | % overrun by product type, vendor |
| UPS Efficiency | PrintRunJobs | Sheets used vs optimal, waste % |
| Vendor Performance | Jobs + Vendors | On-time delivery, quality, cost comparison |
| CMYK Utilization | Jobs (vendor=CMYK) + POS | In-house jobs vs retail, paper consumption, daily P&L |
| Designer Workload | DesignTasks | Tasks per designer, avg turnaround, revision count |

---

**💰 3. Finance Reports**

| Report | Data Source | Shows |
|---|---|---|
| Cash Flow | Payments + Expenses | Cash in vs cash out, daily/weekly/monthly |
| Payment Mode Split | Payments (splits) | Cash vs Bank vs UPI, total and % |
| GST Summary | Payments (has_gst) | Quarterly GST-applicable collections for filing |
| Outstanding Aging | Invoices | Unpaid invoices grouped by 30/60/90/120+ days |
| Expense by Category | Expenses | Staff, material, office, job-specific breakdown |
| Profit per Job | Jobs + Expenses + Payments | Revenue − costs = profit per job |
| Vendor Payment Due | Purchase Bills | Pending vendor payments |

---

**📢 4. Marketing Reports**

| Report | Data Source | Shows |
|---|---|---|
| Lead Funnel | Leads | New → Contacted → Interested → Converted, drop-off % |
| Lead Source Analysis | Leads (source) | Which channels bring most leads |
| Follow-up Compliance | Follow-ups | Scheduled vs completed %, avg response time |
| Marketer Performance | Leads + Jobs | Leads, conversions, revenue per marketer |
| Client Acquisition Cost | Leads + Expenses | Cost per acquired client |
| Referral Network | Clients (referred_by) | Which clients refer most new business |

---

**🚚 5. Dispatch Reports**

| Report | Data Source | Shows |
|---|---|---|
| On-time Delivery | Dispatches | % delivered on/before deadline |
| QC Pass/Fail Rate | Job Checklists | First-pass quality rate, common failure reasons |
| Transporter Performance | Dispatches | Delivery time, reliability per transporter |
| Pending Dispatch Aging | Jobs (stage=ready) | How long jobs sit after QC before dispatch |

---

**🔑 6. Executive / Admin Reports**

| Report | Data Source | Shows |
|---|---|---|
| Business Health Dashboard | All data | Revenue trend, growth %, cash position, overdue count |
| Monthly Comparison | All data | This month vs last vs same month last year |
| Section Scorecard | All sections | KPI summary for each department in one view |
| Employee Productivity | Tasks + Logs | Work output per team member |
| Client Retention | Jobs + Clients | Active vs inactive clients, churn rate |

---

**💡 Usability Suggestions for Reports:**

| Suggestion | Why It Helps |
|---|---|
| **One-click PDF export** | Share with partners, CA, or for meetings |
| **Date range picker** | Standard: Today, This Week, This Month, This Quarter, Custom |
| **Comparison mode** | "This month vs last month" side-by-side |
| **Auto-email reports** | Admin gets weekly/monthly summary emailed automatically |
| **Favorites** | Pin most-used reports to dashboard |
| **Drill-down** | Click a number → see the underlying jobs/invoices |
| **Charts + Tables** | Every report has both a visual chart and data table |
| **Mobile-friendly** | Reports should render well on phone for quick checks |

---

## Database Changes Summary

| Table | Change | Type |
|---|---|---|
| `clients` | Add `referred_by UUID` | New column |
| `expenses` | Add `job_id UUID` | New column |
| `jobs` | Add `actual_quantity INTEGER` | New column |
| `print_run_jobs` | Add `sheets_to_print`, `expected_output`, `actual_output` | 3 new columns |
| `user_calendar_events` | Add `visibility`, `source`, `source_type`, `source_id` | 4 new columns |
| `payment_splits` | **New table** — split payments by mode | New table |
| `user_notes` | **New table** — dashboard sticky notes | New table |
| `quotations` | Auto-populate `converted_to_job_id` | Logic fix |
| `job_checklists` | Add `finishing` category | Extend enum |

**Total new tables:** 2 (`payment_splits`, `user_notes`)  
**Total new columns:** 10  
**Total logic fixes:** 2

---

## Priority & Order

| Order | Phase | Effort | Impact |
|---|---|---|---|
| 1st | Phase 1 (Fix Connections + Actual Qty + Split Payments) | 🟡 Medium (3-4 hrs) | High — data traceability |
| 2nd | Phase 2 (Client Enhancements) | 🟢 Small (2-3 hrs) | High — daily workflow |
| 3rd | Phase 3A-3B (Auto-progression + Print types) | 🟡 Medium (3-4 hrs) | High — reduces manual work |
| 4th | Phase 3C-3D (Approval + Finishing) | 🟡 Medium (2-3 hrs) | Medium — better tracking |
| 5th | Phase 3E (RBAC Privacy Enforcement) | 🟡 Medium (3-4 hrs) | High — data security |
| 6th | Phase 3F (UPS Calculation in Print Planner) | 🟡 Medium (2-3 hrs) | High — accurate production |
| 7th | Phase 3G (Shared Calendar + Auto-Events) | 🟡 Medium (3-4 hrs) | High — team coordination |
| 8th | Phase 3H (Dashboard Notes) | 🟢 Small (1-2 hrs) | Medium — personal productivity |
| 9th | Phase 4D (Payment Reports) | 🟡 Medium (3-4 hrs) | High — financial visibility |
| 10th | Phase 4E (Performance Monitoring) | 🟡 Medium (4-5 hrs) | High — accountability |
| 11th | Phase 4F (Business Reports Hub) | 🔴 Large (6-8 hrs) | High — business intelligence |
| 12th | Phase 4A-4C (Job 360°, Alerts, WhatsApp) | 🔴 Large (5+ hrs each) | Medium — nice-to-have |

---

> **IMPORTANT:** No implementation starts until this plan is approved. All changes are additive — nothing existing breaks.
