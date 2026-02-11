# Aayam Office System — Admin Testing Guide

> **Date**: 11 Feb 2026
> **App URL**: Your Vercel deployment URL
> **Login**: Use your admin credentials

---

## How to Report Bugs & Issues

When you find a problem during testing, note it down in this format and share with me:

```
🐛 BUG: [Short title]
Page: [Which page, e.g. "Dashboard" or "Finance > Invoices"]
Steps: [What you did, step by step]
Expected: [What should have happened]
Actual: [What actually happened]
Screenshot: [Attach if possible]
Severity: [Critical / Major / Minor / Cosmetic]
```

**Example:**
```
🐛 BUG: Payment amount not saving
Page: Finance > Payments
Steps: 1. Clicked "Record Payment" 2. Entered ₹5000 3. Clicked Save
Expected: Payment should save and show in list
Actual: Error message "Failed to save" appears
Screenshot: [attached]
Severity: Critical
```

**Severity Guide:**
| Level | Meaning | Example |
|-------|---------|---------|
| **Critical** | Can't use the feature at all | Page crashes, data not saving |
| **Major** | Feature works but has significant issues | Wrong calculations, missing data |
| **Minor** | Small issues, workaround exists | Alignment off, slow loading |
| **Cosmetic** | Visual/text issues only | Typo, wrong color, spacing |

> [!TIP]
> You can also just send me a list like:
> - "Dashboard calendar shows wrong month"
> - "Can't add vendor in Print Planner"
> - "Invoice PDF cuts off on mobile"
>
> I'll ask for more details if needed!

---

## Pre-Test Setup

Before starting, make sure:
- [ ] You're logged in as **Admin** role
- [ ] You have at least 1 client in the system
- [ ] You have at least 1 job created
- [ ] SQL scripts have been run (check Settings page for any warnings)

---

## Module 1: Dashboard (`/admin/dashboard`)

### 1.1 KPI Cards (Row 1)
- [ ] **Total Revenue** — shows a ₹ amount (or ₹0 if no invoices yet)
- [ ] **Active Jobs** — matches number of jobs currently in production
- [ ] **Pending Payments** — shows outstanding invoice total
- [ ] **Leads This Month** — shows count of leads added this month

### 1.2 Today's Focus (Row 2, Left)
- [ ] Shows 4 boxes: Jobs Due, Delayed, Completed, Payments Due
- [ ] Numbers match what you'd expect for today

### 1.3 Alerts Banner
- [ ] If there are overdue payments, follow-ups due, or blocked jobs → amber banner appears
- [ ] Clicking each badge navigates to the correct page
- [ ] If no alerts, banner is hidden (not showing empty)

### 1.4 Job Pipeline
- [ ] Colored horizontal bars showing jobs at each stage (Design, Print, QC, etc.)
- [ ] "X late" markers appear if jobs are overdue at any stage

### 1.5 Daily Summary + Overdue Alerts (Row 2, Right)
- [ ] Daily Summary widget shows today's numbers
- [ ] Overdue Alerts widget lists overdue items

### 1.6 Team Workload + Quick Notes (Row 3)
- [ ] **Team Workload** — shows designer workload bars
- [ ] **Quick Notes** — can type a note, save it, see it persist after refresh

### 1.7 Recent Orders + Sales Performance (Row 4)
- [ ] **Recent Orders table** — shows last 5 orders with job#, client, status, amount
- [ ] Clicking "View all" goes to Jobs page
- [ ] **Sales Performance** — monthly revenue bars (current month highlighted)

### 1.8 Calendar (Row 5)
- [ ] Full month calendar showing at bottom
- [ ] Can navigate months with ← → buttons
- [ ] "Today" button returns to current month
- [ ] Click any day → "New Event" modal opens
- [ ] Events show as small tags inside day cells
- [ ] Click event → toggles complete/incomplete
- [ ] "Full Calendar" link goes to `/admin/calendar`

---

## Module 2: Projects & Jobs (`/admin/jobs`)

### 2.1 Jobs Overview
- [ ] Jobs list loads with all jobs
- [ ] **Search** by job number or client name works
- [ ] **Filter by status** (All, Design, Printing, QC, Dispatch, Delivered) works
- [ ] **Filter by type** (Sticker, Pouch, Box, etc.) works
- [ ] Each job card shows: job#, client, project, status badge, amount, due date

### 2.2 Create New Job
- [ ] Click "New Job" button
- [ ] Fill in: Client (dropdown), Project Name, Job Type, Quantity, Amount, Due Date
- [ ] Save → job appears in list with auto-generated job number
- [ ] Job number follows format (e.g., `AYM-0001`)

### 2.3 Job Detail / Edit
- [ ] Click on a job → detail view opens
- [ ] Can edit fields and save
- [ ] **Stage progression** — can move job through stages (Design → Print → QC → Dispatch → Delivered)

### 2.4 Production Queue (`/admin/jobs/queue`)
- [ ] Shows jobs grouped by current stage
- [ ] Drag-and-drop or button to move between stages
- [ ] Overdue jobs highlighted

---

## Module 3: Print Planner (`/admin/print-planner`) ⭐ NEW

### 3.1 Step 1 — Select Jobs
- [ ] Left panel shows pending print jobs
- [ ] **Search** jobs by number or client name
- [ ] **Filter by type** (Sticker, Pouch, Box, etc.)
- [ ] Click "Add" → job moves to Selected list (right panel)
- [ ] **Type locking**: After adding a STICKER job, can't add POUCH job (alert appears)
- [ ] Can remove jobs from selection with ✕
- [ ] "Clear all" removes everything
- [ ] "Next: Configure UPS & Qty" button → goes to Step 2

### 3.2 Step 2 — Configure UPS & Quantity
- [ ] Table shows all selected jobs with editable columns
- [ ] **Qty Needed** — pre-filled from order quantity, editable
- [ ] **UPS / Sheet** — enter how many copies fit on one sheet
- [ ] **Sheets Required** — auto-calculates: ⌈qty ÷ ups⌉
- [ ] Example: 500 qty ÷ 10 ups = 50 sheets ✅
- [ ] Example: 501 qty ÷ 10 ups = 51 sheets (rounds up) ✅
- [ ] **Totals row** shows sum of qty and total sheets
- [ ] **Gang Sheet mode**: If 2+ clients, shows "GANG SHEET" badge
  - Total sheets = max across jobs (shared sheets), not sum
- [ ] Can remove individual jobs with ✕
- [ ] "Back to Selection" returns to Step 1
- [ ] "Next: Print Specs" goes to Step 3

### 3.3 Step 3 — Print Specs & Submit
- [ ] **Left panel**: Summary showing jobs count, clients, total qty, total sheets
- [ ] **Right panel**: Print specifications form
  - [ ] Select **Vendor** (required)
  - [ ] Select **Machine** (+ "Add" quick-add button)
  - [ ] Select **Sheet Size** (+ "Add" quick-add button)
  - [ ] Select **Material** (+ "Add" quick-add button)
  - [ ] Set **Deadline** date
  - [ ] Enter **Total Amount** (₹)
  - [ ] Add **Notes**
- [ ] "Create Print Run" → saves with correct UPS/qty values
- [ ] Success → returns to Step 1, job queue refreshed
- [ ] Check detail page: ups_in_sheet and quantity_needed are correct

### 3.4 Print Run Detail (`/admin/print-planner/[id]`)
- [ ] Shows print run number (PP-00001 format)
- [ ] Shows all jobs with their quantity, ups, sheets
- [ ] Can change status: Planned → Printed → Delivered
- [ ] Can add more jobs, remove jobs

---

## Module 4: Design Studio

### 4.1 Task Board (`/admin/designers/tasks?view=board`)
- [ ] Kanban board with columns: To Do, In Progress, Review, Done
- [ ] Can drag cards between columns
- [ ] Card shows: task name, assignee, priority

### 4.2 My Queue (`/admin/designers/my-queue`)
- [ ] Shows only tasks assigned to logged-in user
- [ ] Tasks sorted by priority/due date

### 4.3 Team Queue (`/admin/designers/team-queue`)
- [ ] Shows all team tasks
- [ ] Can filter by designer

### 4.4 Timeline (`/admin/designers/timeline`)
- [ ] Visual timeline of design tasks

### 4.5 My Notes (`/admin/designers/my-notes`)
- [ ] Personal notes editor
- [ ] Notes persist after page refresh

### 4.6 New Project (`/admin/designers/new-project`)
- [ ] Form to create a new design project
- [ ] Link to existing job

---

## Module 5: Marketing

### 5.1 Dashboard (`/admin/marketing/dashboard`)
- [ ] Marketing metrics overview
- [ ] Lead conversion stats

### 5.2 Leads (`/admin/marketing/leads`)
- [ ] List of all leads with status
- [ ] **Create new lead**: Name, Phone, Email, Source, Notes
- [ ] **Edit lead**: Change status (New → Contacted → Qualified → Converted → Lost)
- [ ] **Search and filter** works
- [ ] WhatsApp quick link button

### 5.3 Follow-ups (`/admin/marketing/follow-ups`)
- [ ] Shows leads that need follow-up
- [ ] Grouped by: Overdue, Today, This Week, Later
- [ ] Can mark follow-up as done
- [ ] Can reschedule

### 5.4 Quotations (`/admin/marketing/quotations`)
- [ ] Create quotation for a lead/client
- [ ] Add line items with quantity and price
- [ ] Total auto-calculates
- [ ] Can convert quotation to order

### 5.5 My Orders (`/admin/marketing/orders`)
- [ ] Shows orders created by this marketing user

### 5.6 Commissions (`/admin/marketing/commissions`)
- [ ] Commission calculator
- [ ] Commission tracking per order
- [ ] GST handling

---

## Module 6: CRM

### 6.1 Clients (`/admin/crm/clients`)
- [ ] Client list with search
- [ ] **Create client**: Name, Phone, Email, Address, GST Number
- [ ] **Edit client**: Update details
- [ ] Client detail shows: order history, total business, payment status

---

## Module 7: Sales & Finance

### 7.1 Finance Overview (`/admin/finance`)
- [ ] Revenue summary
- [ ] Receivables and payables
- [ ] Cash flow overview

### 7.2 Quotations (`/admin/sales/quotations`)
- [ ] Create, edit, send quotations
- [ ] Convert to order

### 7.3 Orders (`/admin/sales/orders`)
- [ ] Order list with status filters
- [ ] Create order from quotation or directly

### 7.4 Invoices (`/admin/finance/invoices`)
- [ ] Create invoice linked to job/order
- [ ] Add line items, taxes
- [ ] Mark as paid/partial/unpaid
- [ ] Invoice number auto-generation

### 7.5 Payments (`/admin/finance/payments`)
- [ ] Record payment against invoice
- [ ] Payment modes: Cash, UPI, Cheque, Bank Transfer
- [ ] Link to bank account
- [ ] Payment history with filters

### 7.6 Banking (`/admin/finance/banking`)
- [ ] Add bank accounts
- [ ] View transactions per account
- [ ] Cash vs bank balance tracking

### 7.7 Purchase Bills (`/admin/finance/vendors/purchases`)
- [ ] Record vendor purchase bills
- [ ] Link to vendor

### 7.8 Vendors (`/admin/finance/vendors`)
- [ ] Vendor list (print vendors, material suppliers, etc.)
- [ ] Create/edit vendor with contact details
- [ ] Payment tracking per vendor

---

## Module 8: Dispatch

### 8.1 Command Center (`/admin/dispatch`)
- [ ] Jobs ready for dispatch listed
- [ ] Can mark as dispatched with details (transporter, tracking)
- [ ] Shows delivery schedule

### 8.2 QC & Packing (`/admin/dispatch/qc-check`)
- [ ] Quality check checklist
- [ ] Mark items as pass/fail
- [ ] Packing details entry

### 8.3 Delivery History (`/admin/dispatch/history`)
- [ ] Past deliveries with dates, transporter, status
- [ ] Search and filter

### 8.4 Transporters (`/admin/dispatch/transporters`)
- [ ] List of transport partners
- [ ] Add/edit transporter details

---

## Module 9: CMYK Print

### 9.1 Station Overview (`/admin/cmyk-print`)
- [ ] In-house printing station dashboard
- [ ] Current print runs and status

### 9.2 Paper Stock (`/admin/cmyk-print/paper-stock`)
- [ ] Paper inventory tracking
- [ ] Add/deduct stock

### 9.3 Retail POS (`/admin/cmyk-print/retail-pos`)
- [ ] Point of sale for walk-in print orders
- [ ] Quick billing

---

## Module 10: Reports

### 10.1 Overview (`/admin/reports`)
- [ ] Report summary cards

### 10.2 Finance Reports (`/admin/reports/finance`)
- [ ] Revenue, expense, profit reports
- [ ] Date range filters

### 10.3 Sales Reports (`/admin/reports/sales`)
- [ ] Sales by client, by product type
- [ ] Monthly/quarterly breakdown

### 10.4 Vendor Reports (`/admin/finance/reports/vendor-reports`)
- [ ] Spending per vendor
- [ ] Payment status

### 10.5 Dispatch Reports (`/admin/reports/dispatch`)
- [ ] On-time delivery rate
- [ ] Delivery history analytics

---

## Module 11: Calendar (`/admin/calendar`)

- [ ] Full calendar view (week/month)
- [ ] **Create event**: Click on day → fill title, time, tagged users
- [ ] **Edit/delete** event
- [ ] **Tag team members** on events
- [ ] **Complete/uncomplete** toggle
- [ ] Events sync with dashboard calendar widget

---

## Module 12: EOD Report (`/admin/eod-report`)

- [ ] **Submit daily EOD**: Fill in today's summary
- [ ] Can add tasks completed, notes
- [ ] **Admin View** (`/admin/eod-report/admin-view`): See all team EOD reports
- [ ] Filter by date, by team member

---

## Module 13: Broadcast (`/admin/broadcast`)

- [ ] Create broadcast message
- [ ] Select recipients (all, specific roles)
- [ ] Message appears for selected users

---

## Module 14: Activity Log (`/admin/activity`)

- [ ] Shows all system activity (job created, payment recorded, etc.)
- [ ] Who did what, when
- [ ] Search/filter by action type

---

## Module 15: Settings (`/admin/settings`)

### 15.1 General Settings
- [ ] Page loads without errors

### 15.2 Company Info (`/admin/settings/company`)
- [ ] Edit company name, address, GST, logo
- [ ] Changes reflect on invoices

### 15.3 User Management (`/admin/settings/users`)
- [ ] List all users with roles
- [ ] **Create user**: Username, Password, Role
- [ ] **Edit user**: Change role, reset password
- [ ] **Roles available**: Admin, Finance, Designer, Marketing, Dispatch, CMYK

### 15.4 Notifications (`/admin/settings/notifications`)
- [ ] Notification preferences

### 15.5 Production Settings (`/admin/settings/production`)
- [ ] Configure job stages, default settings

### 15.6 Google Drive (`/admin/settings/drive`)
- [ ] Google Drive integration settings
- [ ] Connection status

---

## Module 16: Public Pages

### 16.1 Login (`/login`)
- [ ] Login with correct credentials → redirects to dashboard
- [ ] Wrong password → error message
- [ ] Empty fields → validation message

### 16.2 Job Tracking (`/track/[jobNumber]`)
- [ ] Enter job number → shows public tracking status
- [ ] Shows stage progress without requiring login

### 16.3 Emergency Page (`/emergency`)
- [ ] Emergency info page loads

---

## Cross-System Checks

### Navigation
- [ ] Sidebar opens/closes correctly
- [ ] All menu items load their pages (no 404s)
- [ ] Active page highlighted in sidebar
- [ ] Mobile responsive — sidebar collapses to hamburger menu
- [ ] Logout button works

### Role-Based Access
- [ ] Login as **Designer** → only sees Design Studio, Calendar, EOD, Profile
- [ ] Login as **Marketing** → sees Marketing, CRM, Calendar, EOD, Profile
- [ ] Login as **Finance** → sees Dashboard, Jobs, Finance, Reports
- [ ] Login as **Admin** → sees everything

### Data Integrity
- [ ] Create a lead → convert to client → create order → create invoice → record payment
- [ ] Full lifecycle works end-to-end
- [ ] Amounts are consistent across all pages

### Mobile Responsiveness
- [ ] Dashboard renders properly on phone
- [ ] Tables scroll horizontally on small screens
- [ ] Forms are usable on mobile
- [ ] Calendar is touch-friendly

---

## ✅ Testing Complete Checklist

After going through all modules:

- [ ] All pages load without errors
- [ ] All CRUD operations work (Create, Read, Update, Delete)
- [ ] Numbers/amounts are correct
- [ ] Navigation is smooth
- [ ] Mobile works
- [ ] No console errors (check browser DevTools → Console tab)

---

> [!IMPORTANT]
> **Send me your bug list** after testing! Use the format from the top of this document. Even a simple bullet list works — I'll handle the rest. Prioritize **Critical** and **Major** bugs first.
