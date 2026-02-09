# 🔍 Aayam Office System — Workflow Audit & Feature Suggestions

## Audit Scope
Scanned **68 admin pages**, **947-line database schema**, **50+ data hooks**, and **5 API routes** and mapped them against the business workflow:

```
Marketing → Design → Print Setup → Printing → QC → Dispatch
```

---

## ✅ What's Working Well (Existing Modules)

| Stage | Module | Pages | Status |
|---|---|---|---|
| **Lead Capture** | Marketing → Leads | Leads page with add/edit/convert | ✅ Solid |
| **Follow-ups** | Marketing → Follow-ups | Calendar view, scheduling | ✅ Solid |
| **Quotations** | Marketing → Quotations | Line items, GST, PDF-ready | ✅ Solid |
| **Sales Orders** | Sales → Orders | Linked to quotations | ✅ Solid |
| **Job Creation** | Jobs | Full CRUD, stage tracking, file attachments | ✅ Solid |
| **Design Tasks** | Design Studio → Tasks | Kanban board, remarks, drive links | ✅ Solid |
| **Design Projects** | Design Studio → Projects | Project grouping | ✅ Basic |
| **Print Planner** | Print Planner | Print runs, machine/sheet/material config | ✅ Solid |
| **Production Queue** | Production Queue | Job grouping by type | ✅ Basic |
| **QC Check** | Dispatch → QC & Packing | Checklist-based QC | ✅ Solid |
| **Dispatch** | Dispatch → Command Center | Create dispatch, transporter info | ✅ Solid |
| **Dispatch History** | Dispatch → History | Past dispatches | ✅ Solid |
| **Invoicing** | Finance → Invoices | Line items, GST, payment tracking | ✅ Solid |
| **Payments** | Finance → Payments | Received + vendor payments | ✅ Solid |
| **Banking** | Finance → Banking | Bank accounts, transactions | ✅ Solid |
| **Vendors** | Finance → Vendors | Vendor management + purchase bills | ✅ Solid |
| **Reports** | Reports | Finance, Sales, Dispatch reports | ✅ Solid |
| **CRM** | CRM → Clients | Client database | ✅ Solid |
| **Commissions** | Marketing → Commissions | Calculator, tracking | ✅ Solid |
| **POS** | CMYK Print → Retail POS | Products, categories, sales | ✅ Solid |
| **Paper Stock** | CMYK Print → Paper Stock | Inventory tracking | ✅ Solid |
| **Calendar** | Calendar | Personal events, mentions | ✅ Solid |
| **Activity Log** | Activity | System-wide logging | ✅ Solid |
| **EOD Report** | EOD Report | Daily summaries | ✅ Solid |
| **Settings** | Settings | Users, company, production config | ✅ Solid |

---

## 🔴 Critical Gaps (Missing from Workflow)

### 1. No Job Stage Auto-Progression
> **Problem:** Job moves from `new → design → print_ready → printing → finishing → dispatched → delivered` manually. There's no automation.
>
> **Impact:** Staff must manually click to change stages. Easy to forget. Jobs can get "stuck" in wrong stages.
>
> **Suggestion:** When a design task is marked "completed", auto-move the linked job to `print_ready`. When QC passes, auto-move to `dispatched`. When dispatch is created, auto-mark as `dispatched`.

### 2. No Client Approval Tracking
> **Problem:** The `client_approval` and `approval_date` fields exist in the Job schema but there's no UI for it. Your workflow says "once its finalize then if we have to print..." — there's no formal approval step.
>
> **Impact:** No record of when client approved the design. Disputes can happen.
>
> **Suggestion:** Add a "Client Approval" step in Design Studio — designer can mark design as "sent for approval" and later mark "client approved" with date.

### 3. No File Handoff Between Design → Print
> **Problem:** When design is complete, there's no formal "forward to print file" action. The `print_ready` and `file_version` fields exist but aren't used in UI.
>
> **Impact:** Print team doesn't know which file version is final. Can print wrong version.
>
> **Suggestion:** Add a "Mark Print-Ready" action on design tasks that tags the final file version and notifies print team.

### 4. No Print Job Type Separation (Label/Box/Pouch/Sheet)
> **Problem:** You mentioned "print queue is very important — that type of job must be proper identify and only fit with its type." The current production queue doesn't properly separate by **product type** (label, box, pouch, standard sheet).
>
> **Impact:** Jobs could be grouped incorrectly in print runs.
>
> **Suggestion:** Use the `ProductCategory` to create tabs/filters in Print Planner — one tab per type (Label Jobs, Box Jobs, Pouch Jobs, Sheet Jobs). Each category should have its own queue.

### 5. No Post-Print Tracking
> **Problem:** You said "post print process done from our side if printer not provide that service." There's no tracker for post-print processes (lamination, cutting, die-cutting, folding, etc.).
>
> **Impact:** Can't track which finishing steps are complete.
>
> **Suggestion:** Add a "Finishing Checklist" per job type — configurable per product category (e.g., Box needs: die-cut → fold → glue; Label needs: laminate → die-cut).

---

## 🟡 Important Improvements Needed

### 6. No Advance Payment / 50% Collection Tracking
> **Problem:** You collect 50% advance before starting work, but there's no specific "advance collected" status or checkpoint. Payment status only tracks `unpaid/partial/paid`.
>
> **Impact:** Jobs might start without advance being collected. No dashboard visibility.
>
> **Suggestion:** Add an `advance_required` and `advance_collected` field to Job. Show a warning on Jobs page if job is started without advance.

### 7. Sales Order → Job Conversion is Not Seamless
> **Problem:** Sales Orders have a `status` field but converting a Sales Order to a Job isn't visible in the flow.
>
> **Impact:** Data entry duplication — same project info entered in Sales Order then again in Job.
>
> **Suggestion:** Add a "Create Job from Sales Order" button that pre-fills job fields from the sales order.

### 8. No Job Cost Tracking (Profit per Job)
> **Problem:** You track invoice amounts and purchase bills separately, but there's no per-job cost breakdown or profit calculation.
>
> **Impact:** Can't see if a specific job was profitable or not.
>
> **Suggestion:** Link purchase bills to jobs. Show a "Job Profitability" card: Revenue (invoice) - Cost (purchase bills + vendor payments + design hours) = Profit.

### 9. Designer Workload Visibility
> **Problem:** `DesignerHours` table exists but there's no UI to log hours or view who's overloaded.
>
> **Impact:** Can't balance workload across designers.
>
> **Suggestion:** Add a simple "Time Log" on each task + a "Team Workload" dashboard showing hours per designer this week/month.

### 10. No WhatsApp/Communication Integration
> **Problem:** Marketing team contacts clients regularly. No integration with any messaging platform.
>
> **Impact:** Follow-up notes are manual. No message history linked to leads/clients.
>
> **Suggestion:** Add a "Quick WhatsApp" button (opens `wa.me/` link) on lead/client cards. Log communication history.

---

## 🆕 New Feature Suggestions (High Impact)

### 🔥 Feature 1: **Job Timeline / Progress Tracker**
A visual timeline showing every stage a job has passed through with timestamps and who made the change. Currently, the stage changes happen but there's no history visible on the job detail page.

```
[New] → [Design] → [Print Ready] → [In Print] → [QC Passed] → [Dispatched] → [Delivered]
 Jan 5    Jan 8       Jan 12         Jan 14        Jan 15          Jan 16         Jan 18
```

### 🔥 Feature 2: **Client Portal (Read-only)**
A simple read-only page where clients can check their order status. Share a unique link like `yoursite.com/track/AAY-26-1234`. Shows current stage, expected delivery, and recent updates.

### 🔥 Feature 3: **Repeat Order / Job Templates**
Since your clients are recurring (brand packaging), add a "Repeat Order" button on past jobs that clones all settings (product type, quantities, designer, print specs) into a new job. Huge time saver.

### 🔥 Feature 4: **Daily Order Summary Notification**
Auto-generate a daily summary at 6PM: "Today: 3 new orders, 2 jobs dispatched, ₹1.5L payments received, 4 designs pending approval." Send to admin via the existing notification system.

### 🔥 Feature 5: **Material/Paper Cost Calculator**
Link paper stock inventory to print runs. When setting up a print run, auto-calculate paper cost based on sheet size, GSM, and quantity. Helps with instant costing.

### 🔥 Feature 6: **Overdue Alerts Dashboard Widget**
A dashboard card showing all overdue items across the system:
- Jobs past deadline
- Invoices past due date
- Follow-ups past schedule
- Pending approvals
Currently scattered across different pages with no unified view.

---

## 📊 Audit Summary

| Category | Count |
|---|---|
| **Working well** | 25 modules |
| **Critical gaps** | 5 issues |
| **Important improvements** | 5 issues |
| **New feature ideas** | 6 features |

### Priority Recommendation
1. **Start with** Gap #1 (Auto-progression) + Gap #4 (Print type separation) — these directly impact your daily workflow
2. **Then** Feature #1 (Job Timeline) + Gap #3 (File Handoff) — visibility and traceability
3. **Then** Feature #3 (Repeat Orders) + Gap #6 (Advance tracking) — efficiency gains
4. **Later** Feature #2 (Client Portal) + Feature #5 (Cost Calculator) — nice-to-haves

> [!IMPORTANT]
> The system is **quite comprehensive** already with 68 pages covering every major workflow stage. The gaps identified are mostly about **connecting the dots** between existing modules rather than building entirely new features.
