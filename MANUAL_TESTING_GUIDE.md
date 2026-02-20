# Aayam Office System — Manual Testing Guide

> **App URL:** https://aayam-office-system.vercel.app  
> **Last Updated:** 2026-02-19

---

## How to Use This Guide

1. Log in with your credentials at `/login`
2. Go through each department section below
3. For each test case, mark ✅ (pass) or ❌ (fail) and note any issues
4. Report all failures to the dev team with screenshots

---

## 1. Dashboard (`/admin/dashboard`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.1 | Page loads | Navigate to `/admin/dashboard` | Dashboard loads with stats cards, no errors | ☐ |
| 1.2 | Stats cards display | Check all stat cards | All cards show numeric values (even if 0) | ☐ |
| 1.3 | Needs Attention bar | Click any badge on the "Needs Attention" bar | Expandable section shows detailed items | ☐ |
| 1.4 | Overdue Alerts widget | Check the Overdue Alerts section | Shows overdue invoices/tasks or "All caught up" | ☐ |
| 1.5 | Quick actions | Click "New Order" button in header | Navigates to sales order creation page | ☐ |
| 1.6 | Refresh button | Click the refresh icon in header | Data refreshes, green dot appears briefly | ☐ |
| 1.7 | Notifications bell | Click the bell icon | Dropdown shows notifications or "All caught up" | ☐ |

---

## 2. Marketing Department

### 2.1 Marketing Dashboard (`/admin/marketing/dashboard`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.1.1 | Page loads | Navigate to marketing dashboard | Shows follow-ups, overdue tasks, new leads, converted stats | ☐ |
| 2.1.2 | Today's Follow-ups card | Check the dark card | Shows count of today's follow-ups | ☐ |
| 2.1.3 | Today's Calls section | Check calls section | Shows scheduled calls or "No follow-ups scheduled" | ☐ |
| 2.1.4 | Overdue section | Check Overdue panel | Shows overdue count and items, or "All caught up" | ☐ |
| 2.1.5 | Leads Waiting section | Check bottom section | Shows new leads needing contact with "Start Call List" button | ☐ |

### 2.2 Leads (`/admin/marketing/leads`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.2.1 | Leads list loads | Navigate to leads page | Table of leads displayed with name, company, status | ☐ |
| 2.2.2 | Add new lead | Click "Add Lead" → fill form → save | New lead appears in the list | ☐ |
| 2.2.3 | Edit lead | Click on a lead → modify details → save | Changes are saved and reflected | ☐ |
| 2.2.4 | Search leads | Type in search box | List filters in real-time | ☐ |
| 2.2.5 | Filter by status | Use status filter dropdown | Only matching leads shown | ☐ |
| 2.2.6 | Convert lead to client | Click convert option on a lead | Lead status changes, appears in CRM clients | ☐ |

### 2.3 Follow-ups (`/admin/marketing/follow-ups`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.3.1 | Follow-ups list | Navigate to follow-ups | Shows scheduled follow-ups with dates | ☐ |
| 2.3.2 | Schedule follow-up | Create a new follow-up for a lead | Follow-up saved with date and notes | ☐ |
| 2.3.3 | Mark complete | Mark a follow-up as completed | Status changes to completed | ☐ |
| 2.3.4 | Overdue highlighting | Check overdue follow-ups | Past-due items are visually highlighted | ☐ |

### 2.4 Quotations (`/admin/marketing/quotations`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.4.1 | Quotations list | Navigate to quotations | List of quotations with amounts | ☐ |
| 2.4.2 | Create quotation | Create a new quotation with line items | Quotation saved with calculated total | ☐ |
| 2.4.3 | Edit quotation | Modify an existing quotation | Changes saved correctly | ☐ |

### 2.5 Commissions (`/admin/marketing/commissions`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.5.1 | Commission page loads | Navigate to commissions | Shows commission records and calculator | ☐ |
| 2.5.2 | Commission calculator | Enter amounts in the live calculator | GST and net commission calculated correctly | ☐ |
| 2.5.3 | Add commission record | Add a new commission entry | Record saved with correct calculations | ☐ |

### 2.6 Marketing Payments (`/admin/marketing/payments`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.6.1 | Payment list | Navigate to payments | Shows payment records | ☐ |
| 2.6.2 | Record payment | Add a new payment record | Payment recorded with amount and date | ☐ |

---

## 3. Sales Department

### 3.1 Sales Dashboard (`/admin/sales`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.1.1 | Page loads | Navigate to `/admin/sales` | Sales overview with stats and recent orders | ☐ |
| 3.1.2 | Sales stats | Check summary cards | Correct totals for orders, revenue, pending | ☐ |

### 3.2 Orders (`/admin/sales/orders`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.2.1 | Create new order | Click "New Order" → fill details → save | Order created with auto-generated job number | ☐ |
| 3.2.2 | Order details | Fill all fields: client, project, dimensions, quantity | All fields save correctly | ☐ |
| 3.2.3 | Priority setting | Set priority (Normal/Urgent/Critical) | Priority saved and displayed with correct color | ☐ |
| 3.2.4 | Order validation | Submit without required fields | Validation errors shown | ☐ |

### 3.3 Sales Leads (`/admin/sales/leads`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.3.1 | Leads list | Navigate to sales leads | Shows leads in table format | ☐ |

### 3.4 Sales Quotations (`/admin/sales/quotations`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.4.1 | Quotations list | Navigate to sales quotations | List of quotations displayed | ☐ |

---

## 4. Jobs Management (`/admin/jobs`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.1 | Jobs list loads | Navigate to `/admin/jobs` | Table of all jobs with filters | ☐ |
| 4.2 | Search jobs | Type job number or project name in search | Filtered results shown | ☐ |
| 4.3 | Filter by status | Use status filter | Only matching jobs displayed | ☐ |
| 4.4 | View job details | Click on a job row | Job detail page opens with full info | ☐ |
| 4.5 | Edit job | Modify job details and save | Changes persisted | ☐ |
| 4.6 | Change job status | Update status (e.g., Design → Production) | Status badge updates, appears in correct queue | ☐ |
| 4.7 | Job approval | Approve a job (admin only) | Approval popup with confirm, job marked approved | ☐ |
| 4.8 | Job planner | Navigate to `/admin/jobs/planner` | Visual timeline/calendar of jobs | ☐ |
| 4.9 | Job queue | Navigate to `/admin/jobs/queue` | Production queue view loads | ☐ |
| 4.10 | Job dossier | Navigate to `/admin/jobs/dossier` | Job dossier/summary page loads | ☐ |

---

## 5. Finance Department

### 5.1 Finance Dashboard (`/admin/finance`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.1.1 | Page loads | Navigate to `/admin/finance` | Finance overview with totals | ☐ |
| 5.1.2 | Revenue stats | Check total revenue cards | Accurate numbers displayed | ☐ |
| 5.1.3 | Outstanding amounts | Check outstanding/overdue sections | Correct overdue amounts shown | ☐ |

### 5.2 Daily Finance (`/admin/finance/daily`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.2.1 | Daily view loads | Navigate to daily finance | Shows today's financial activity | ☐ |
| 5.2.2 | Date navigation | Change date | Data updates for selected date | ☐ |

### 5.3 Payments (`/admin/finance/payments`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.3.1 | Payment list | Navigate to payments | Table of all payments | ☐ |
| 5.3.2 | Record payment | Add new payment → select account → save | Payment linked to correct bank/cash account | ☐ |
| 5.3.3 | Payment filters | Filter by date, status, type | Correct filtered results | ☐ |

### 5.4 New Payment (`/admin/finance/payments-new`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.4.1 | New payment form | Open new payment page | Form loads with all fields | ☐ |
| 5.4.2 | Submit payment | Fill and submit | Payment created successfully | ☐ |

### 5.5 Invoices (`/admin/finance/invoices`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.5.1 | Invoice list | Navigate to invoices | All invoices listed with amounts | ☐ |
| 5.5.2 | Invoice status | Check paid/unpaid/overdue badges | Correct status colors | ☐ |

### 5.6 Sales Orders (`/admin/finance/sales-orders`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.6.1 | Sales orders list | Navigate to sales orders | Financial view of sales orders | ☐ |

### 5.7 Expenses (`/admin/finance/expenses/quick`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.7.1 | Quick expense form | Navigate to quick expenses | Expense entry form loads | ☐ |
| 5.7.2 | Add expense | Enter expense details → save | Expense recorded with category | ☐ |

### 5.8 Banking (`/admin/finance/banking`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.8.1 | Banking overview | Navigate to banking | Bank accounts listed with balances | ☐ |
| 5.8.2 | Transaction history | Click on an account | Shows transaction list | ☐ |

### 5.9 Bank Accounts (`/admin/finance/banks`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.9.1 | Bank accounts list | Navigate to banks | All bank/cash accounts listed | ☐ |
| 5.9.2 | Add bank account | Add a new bank account | Account created with details | ☐ |

### 5.10 Opening Balance (`/admin/finance/opening-balance`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.10.1 | Set opening balance | Enter opening balances for accounts | Balances saved correctly | ☐ |

### 5.11 Journal (`/admin/finance/journal`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.11.1 | Journal entries | Navigate to journal | List of journal entries shown | ☐ |

### 5.12 Vendors (`/admin/finance/vendors`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.12.1 | Vendor list | Navigate to vendors | All vendors listed | ☐ |
| 5.12.2 | Add vendor | Add new vendor with details | Vendor saved | ☐ |
| 5.12.3 | Vendor payments | Go to vendor payments | Shows payment history per vendor | ☐ |
| 5.12.4 | Vendor purchases | Go to vendor purchases | Shows purchase records | ☐ |

### 5.13 Finance Reports (`/admin/finance/reports`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.13.1 | Reports overview | Navigate to finance reports | Report options listed | ☐ |
| 5.13.2 | Cashbook | Navigate to cashbook | Cash in/out with running balance | ☐ |
| 5.13.3 | Vendor reports | Navigate to vendor reports | Vendor-wise spending summary | ☐ |
| 5.13.4 | Date range filter | Select a date range | Reports filter to selected period | ☐ |

### 5.14 Accounts & Chart of Accounts (`/admin/finance/accounts`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.14.1 | Chart of accounts | Navigate to accounts | Account categories and hierarchy displayed | ☐ |

---

## 6. CRM (`/admin/crm`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 6.1 | CRM dashboard | Navigate to `/admin/crm` | Client overview with stats | ☐ |
| 6.2 | Client list | View all clients | Table with client name, company, contact | ☐ |
| 6.3 | Add client | Add a new client | Client saved with all details | ☐ |
| 6.4 | Edit client | Modify client info | Changes saved | ☐ |
| 6.5 | Search clients | Use search box | Filters clients in real-time | ☐ |
| 6.6 | Client details | Click on a client | Shows full client profile with order history | ☐ |

---

## 7. Design Department

### 7.1 Designers Dashboard (`/admin/designers`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.1.1 | Page loads | Navigate to designers | Shows designer workload overview | ☐ |

### 7.2 Design Tasks (`/admin/designers/tasks`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.2.1 | Task list | Navigate to tasks | All design tasks listed | ☐ |
| 7.2.2 | Task status update | Change a task's status | Status updates, moves in queue | ☐ |
| 7.2.3 | Task assignment | Assign task to a designer | Designer sees task in their queue | ☐ |

### 7.3 My Queue (`/admin/designers/my-queue`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.3.1 | Personal queue | Navigate to my queue | Only logged-in designer's tasks shown | ☐ |
| 7.3.2 | Task ordering | Check priority ordering | Higher priority tasks appear first | ☐ |

### 7.4 Team Queue (`/admin/designers/team-queue`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.4.1 | Team view | Navigate to team queue | All designers' tasks visible | ☐ |

### 7.5 My Notes (`/admin/designers/my-notes`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.5.1 | Notes list | Navigate to my notes | Personal notes and @mentions shown | ☐ |
| 7.5.2 | @mention notifications | Check for @mentions | Mentioned items highlighted | ☐ |

### 7.6 Projects (`/admin/designers/projects`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.6.1 | Projects list | Navigate to projects | Design projects listed | ☐ |

### 7.7 Timeline (`/admin/designers/timeline`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.7.1 | Timeline view | Navigate to timeline | Visual timeline of design work | ☐ |

### 7.8 New Project (`/admin/designers/new-project`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.8.1 | Create project | Fill out new project form → save | Project created | ☐ |

---

## 8. Dispatch Department

### 8.1 Dispatch Dashboard (`/admin/dispatch`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 8.1.1 | Page loads | Navigate to dispatch | Dispatch overview with pending/completed | ☐ |
| 8.1.2 | Dispatch a job | Mark a job as dispatched | Status updates, timestamp recorded | ☐ |
| 8.1.3 | Track delivery | Check delivery tracking info | Transporter and tracking details shown | ☐ |

### 8.2 QC Check (`/admin/dispatch/qc-check`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 8.2.1 | QC check list | Navigate to QC check | Jobs ready for quality check listed | ☐ |
| 8.2.2 | Pass QC | Mark a job as QC passed | Job moves to dispatch-ready queue | ☐ |
| 8.2.3 | Fail QC | Mark a job as QC failed | Job flagged for rework | ☐ |

### 8.3 Transporters (`/admin/dispatch/transporters`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 8.3.1 | Transporter list | Navigate to transporters | All transporters listed | ☐ |
| 8.3.2 | Add transporter | Add a new transporter | Transporter saved with details | ☐ |

### 8.4 Dispatch History (`/admin/dispatch/history`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 8.4.1 | History loads | Navigate to history | Past dispatches listed with dates | ☐ |
| 8.4.2 | Search history | Search by job number or client | Filtered results shown | ☐ |

---

## 9. CMYK Print (`/admin/cmyk-print`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 9.1 | Print dashboard | Navigate to CMYK Print | Print jobs overview loaded | ☐ |
| 9.2 | Cost calculator | Navigate to cost calculator | Calculator loads, accepts paper/size inputs | ☐ |
| 9.3 | Paper stock | Navigate to paper stock | Paper inventory listed | ☐ |
| 9.4 | Retail POS | Navigate to retail POS | Point of sale interface loads | ☐ |

---

## 10. Production Queue (`/admin/production-queue`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 10.1 | Queue loads | Navigate to production queue | Jobs in production pipeline listed | ☐ |
| 10.2 | Queue ordering | Check job ordering | Jobs ordered by priority/date | ☐ |
| 10.3 | Move job stage | Advance a job to next production stage | Stage updates correctly | ☐ |

---

## 11. Print Planner (`/admin/print-planner`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 11.1 | Planner loads | Navigate to print planner | Planning view with jobs displayed | ☐ |
| 11.2 | View job details | Click a job in the planner | Full job specs shown | ☐ |

---

## 12. Calendar (`/admin/calendar`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 12.1 | Calendar loads | Navigate to calendar | Monthly calendar view displayed | ☐ |
| 12.2 | Add event | Click a date → add event | Event saved and visible on calendar | ☐ |
| 12.3 | Edit event | Click existing event → modify | Changes saved | ☐ |
| 12.4 | Delete event | Delete an event | Event removed from calendar | ☐ |
| 12.5 | @mention in notes | Use @mention in a calendar note | Tagged user sees notification | ☐ |
| 12.6 | Daily briefing | Check auto daily briefing on login | Shows today's events and tasks | ☐ |

---

## 13. EOD Report (`/admin/eod-report`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 13.1 | EOD form loads | Navigate to EOD report | End-of-day report form displayed | ☐ |
| 13.2 | Fill EOD report | Enter daily tasks, challenges, plans | All fields accept input | ☐ |
| 13.3 | Submit EOD | Submit the report | Success toast, report saved | ☐ |
| 13.4 | Admin view | Navigate to admin view (admin only) | See all team members' EOD reports | ☐ |

---

## 14. Reports (`/admin/reports`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 14.1 | Reports page loads | Navigate to reports | Report categories listed | ☐ |
| 14.2 | Sales reports | Navigate to sales report | Sales data with charts/tables | ☐ |
| 14.3 | Finance reports | Navigate to finance report | Financial summary data | ☐ |
| 14.4 | Dispatch reports | Navigate to dispatch report | Dispatch performance data | ☐ |
| 14.5 | Date range filter | Apply date range on any report | Data filters correctly | ☐ |

---

## 15. Broadcast (`/admin/broadcast`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 15.1 | Broadcast page | Navigate to broadcast | Message composition interface | ☐ |
| 15.2 | Send broadcast | Compose and send a message | Message delivered to target audience | ☐ |

---

## 16. Activity Log (`/admin/activity`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 16.1 | Activity log loads | Navigate to activity | Recent system activities listed | ☐ |
| 16.2 | Activity details | Check activity entries | Shows who, what, when accurately | ☐ |

---

## 17. Settings (`/admin/settings`)

### 17.1 General Settings

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.1.1 | Settings page | Navigate to settings | Settings categories displayed | ☐ |

### 17.2 Profile (`/admin/settings/profile`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.2.1 | View profile | Navigate to profile | Shows current user info | ☐ |
| 17.2.2 | Edit profile | Update name/avatar → save | Changes reflected across app | ☐ |

### 17.3 Company (`/admin/settings/company`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.3.1 | Company details | Navigate to company settings | Company info displayed | ☐ |
| 17.3.2 | Update company | Modify company details → save | Changes saved | ☐ |

### 17.4 Users (`/admin/settings/users`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.4.1 | User list (admin only) | Navigate to users | All users listed with roles | ☐ |
| 17.4.2 | Add user | Add a new user (admin only) | User created with assigned role | ☐ |
| 17.4.3 | Edit user role | Change a user's role | Role updated, permissions change | ☐ |

### 17.5 Google Drive (`/admin/settings/drive`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.5.1 | Drive status | Check Drive connection status | Shows "Connected" or connection prompt | ☐ |
| 17.5.2 | Connect Drive | Connect Google Drive (if disconnected) | OAuth flow completes, status shows connected | ☐ |

### 17.6 Production Settings (`/admin/settings/production`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.6.1 | Production config | Navigate to production settings | Production workflow settings shown | ☐ |

### 17.7 Notifications (`/admin/settings/notifications`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.7.1 | Notification prefs | Navigate to notification settings | Notification preferences displayed | ☐ |

### 17.8 Preferences (`/admin/settings/preferences`)

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 17.8.1 | User preferences | Navigate to preferences | Theme / display preferences shown | ☐ |

---

## 18. Global / Cross-Cutting Tests

### 18.1 Sidebar Navigation

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 18.1.1 | Sidebar collapsed | Mouse away from sidebar (desktop) | Sidebar shows icons only (64px) | ☐ |
| 18.1.2 | Sidebar expand on hover | Hover over sidebar (desktop) | Sidebar expands to full labels (256px) | ☐ |
| 18.1.3 | Content shifts | Hover sidebar, check main content | Content and header shift right, no overlap | ☐ |
| 18.1.4 | Sidebar collapses back | Move mouse away from sidebar | Sidebar and content return to normal | ☐ |
| 18.1.5 | Mobile sidebar | On mobile, tap hamburger menu | Full sidebar slides in with overlay | ☐ |
| 18.1.6 | Mobile close | Tap overlay or X on mobile sidebar | Sidebar closes | ☐ |
| 18.1.7 | Navigation links | Click any sidebar menu item | Navigates to correct page | ☐ |

### 18.2 Header

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 18.2.1 | Breadcrumbs | Navigate to any nested page | Correct breadcrumb trail shown | ☐ |
| 18.2.2 | Breadcrumb links | Click on a breadcrumb | Navigates to that level | ☐ |
| 18.2.3 | Header sticky | Scroll down on any long page | Header stays fixed at top | ☐ |

### 18.3 Command Palette

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 18.3.1 | Open palette | Press `Cmd+K` (Mac) or `Ctrl+K` | Command palette opens | ☐ |
| 18.3.2 | Search commands | Type a page name (e.g., "Finance") | Matching pages listed | ☐ |
| 18.3.3 | Navigate from palette | Select a result | Navigates to that page | ☐ |

### 18.4 Responsive Design

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 18.4.1 | Desktop (1440px+) | View on large screen | Full sidebar, spacious layout | ☐ |
| 18.4.2 | Laptop (1024px) | View on laptop screen | Sidebar icons, content fills space | ☐ |
| 18.4.3 | Tablet (768px) | View on tablet | No sidebar, hamburger menu, responsive cards | ☐ |
| 18.4.4 | Mobile (375px) | View on phone | Mobile layout, bottom nav, stacked cards | ☐ |
| 18.4.5 | Bottom nav (mobile) | Check bottom nav bar on mobile | Shows main navigation icons | ☐ |

### 18.5 Role-Based Access

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 18.5.1 | Admin access | Login as admin | Full access to all pages and settings | ☐ |
| 18.5.2 | Marketing access | Login as marketing user | Sees only marketing-related pages | ☐ |
| 18.5.3 | Designer access | Login as designer | Redirected to design tasks, limited menu | ☐ |
| 18.5.4 | Restricted pages | Non-admin tries accessing settings/users | Access denied or menu item hidden | ☐ |

### 18.6 Authentication

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 18.6.1 | Login page | Navigate to `/login` | Login form displayed | ☐ |
| 18.6.2 | Valid login | Enter valid credentials | Redirected to dashboard | ☐ |
| 18.6.3 | Invalid login | Enter wrong credentials | Error message shown | ☐ |
| 18.6.4 | Session persistence | Close and reopen browser | Still logged in | ☐ |
| 18.6.5 | Logout | Click logout from sidebar | Redirected to login page | ☐ |
| 18.6.6 | Protected routes | Access `/admin/*` without login | Redirected to login | ☐ |

---

## Testing Summary

| Department | Total Tests | Pass | Fail | Notes |
|-----------|------------|------|------|-------|
| Dashboard | 7 | | | |
| Marketing | 19 | | | |
| Sales | 6 | | | |
| Jobs | 10 | | | |
| Finance | 28 | | | |
| CRM | 6 | | | |
| Design | 12 | | | |
| Dispatch | 9 | | | |
| CMYK Print | 4 | | | |
| Production Queue | 3 | | | |
| Print Planner | 2 | | | |
| Calendar | 6 | | | |
| EOD Report | 4 | | | |
| Reports | 5 | | | |
| Broadcast | 2 | | | |
| Activity Log | 2 | | | |
| Settings | 12 | | | |
| Global/Cross | 22 | | | |
| **TOTAL** | **159** | | | |

---

**Tested by:** _______________  
**Date:** _______________  
**Build/Commit:** _______________  
**Browser:** _______________  
**Device:** _______________
