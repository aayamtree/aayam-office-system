# Aayam Office System — New Features Testing Guide
**Date:** 9 Feb 2026 | **Total New Features:** 7

---

## Feature 1: Repeat Order Button (Jobs Page)

**Where:** Jobs → Any Job Card  
**Who should test:** Marketing / Admin

**Steps:**
1. Go to **Jobs** page
2. Hover on any job card
3. You will see a new **Copy** icon (between Edit ✏️ and ₹ Payment)
4. Click the Copy icon
5. A "New Job" form will open — pre-filled with:
   - Same client, job type, category, vendor, designer, pricing
   - Project name will say **"Original Name (Repeat)"**
   - Deadline will be empty (set new deadline)
   - Stage will be "New"
6. Change the deadline and quantity as needed
7. Click Save

✅ **Expected result:** A new job is created with all details copied from the original job.

---

## Feature 2: Client History View (CRM → Clients)

**Where:** CRM → Clients → Eye icon on any client  
**Who should test:** Marketing / Admin / Finance

**Steps:**
1. Go to **CRM → Clients**
2. Click the **Eye 👁️** icon on any client card
3. The modal now shows an enhanced view:
   - Client type badge (regular / premium / corporate)
   - **Financial Summary** — 3 boxes showing:
     - Total Billed
     - Total Received
     - Outstanding Balance (red if pending)
   - **Recent Jobs** — Last 5 jobs with stage badges and amounts
   - **"View All Jobs"** button at the bottom

✅ **Expected result:** You can see client's complete financial picture and job history without leaving the page.

---

## Feature 3: Payment Reports Page (Finance)

**Where:** Finance → Reports (`/admin/finance/reports`)  
**Who should test:** Finance / Admin

**Steps:**
1. Go to **Finance** section
2. Click **Reports** (or go to `/admin/finance/reports`)
3. Set date range using the **From** and **To** date pickers
4. Try all **4 tabs**:

| Tab | What it shows |
|---|---|
| **Monthly Summary** | Total collected, expenses, net profit, GST. Bar chart showing Cash vs Bank vs UPI vs Cheque |
| **Client-wise** | Which client paid how much, how many payments |
| **Job Profitability** | Per job: billed amount, received, expenses, profit |
| **Outstanding** | Clients with pending balance, sorted highest first |

✅ **Expected result:** All 4 tabs show correct data based on the selected date range.

---

## Feature 4: Auto Stage Progression (Background)

**Where:** Works automatically — no button to click  
**Who should test:** Design Team / Dispatch Team

**How it works:**
- When a **design task is marked "Completed"** → The linked job **automatically moves to "Approval"** stage
- When a **dispatch is created** for a job → The job **automatically moves to "Dispatched"** stage
- The system logs this as "Auto-progressed" in job history

**Test steps:**
1. Create a job in "Designing" stage
2. Go to **Design Tasks** → mark that job's task as "Completed"
3. Go back to **Jobs** → check if the job moved to "Approval" automatically

✅ **Expected result:** Job stage changes without anyone manually changing it.

---

## Feature 5: Calendar Auto-Events (Background)

**Where:** Works automatically when creating/editing jobs  
**Who should test:** Admin / Marketing

**How it works:**
- When you create a **job with a deadline** → A calendar event "📋 Deadline: Project Name" is automatically created
- When you update the deadline → The calendar event updates too (no duplicates)

**Test steps:**
1. Create a new job with a deadline date
2. Go to **Calendar** page
3. Check if the deadline event appears on that date

✅ **Expected result:** Deadline calendar event appears automatically.

---

## Feature 6: Overdue Alerts Widget (Dashboard)

**Where:** Admin Dashboard → right side, above Activity Feed  
**Who should test:** Admin

**Steps:**
1. Log in as Admin
2. Go to **Dashboard**
3. On the right side (above Activity Feed), you'll see **"⚠️ Overdue Items"**
4. It shows:
   - Jobs past their deadline
   - Invoices past due date
   - Follow-ups past scheduled date
5. Items are color coded: 🔴 7+ days late | 🟡 3+ days | 🟠 1+ day
6. Click any item → goes to the relevant page

✅ **Expected result:** If there are overdue items, they appear with days late count. If everything is on time, shows "All caught up!"

---

## Feature 7: WhatsApp Quick Link Button

**Where:** CRM → Clients → Eye icon → Phone number  
**Who should test:** Marketing / Dispatch

**Steps:**
1. Go to **CRM → Clients**
2. Click the **Eye 👁️** icon on any client
3. Next to the phone number, you'll see a **green WhatsApp (💬) icon**
4. Click it → opens WhatsApp web/app with that client's number

✅ **Expected result:** WhatsApp opens in a new tab with the client's number pre-filled.

---

## ⚠️ Before Testing — Admin Must Do:

Run the database migration in **Supabase SQL Editor**:
- Open Supabase → SQL Editor
- Paste contents of `supabase/PHASE1_MIGRATION.sql`
- Click **Run**
- This creates 2 new tables and adds columns needed for the new features

---

## Bug Fixes (No Testing Needed)

6 pre-existing errors were fixed to make the build work:
- Date formatting errors on Activity, Invoices, and Quotations pages
- File size display error on New Project page
- Import casing issues on Dashboard, Jobs, Sidebar, and Header
