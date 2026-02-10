# Aayam Office System — Database Map

> All roles share **one Supabase database**. "Status" shows if it's working. Add your notes in "Your Notes" column.

## Core Business Tables

| # | Table | Who Adds | From Where | Status | Your Notes |
|---|---|---|---|---|---|
| 1 | `clients` | Marketing, Admin | CRM Clients, Quick Add, Command Palette | ✅ Working | |
| 2 | `jobs` | Admin, Designer | New Job form, Design Studio, Production Queue | ✅ Connected to clients via client_id | |
| 3 | `leads` | Marketing | Marketing → Leads | ✅ Working | |
| 4 | `quotations` | Marketing, Admin | Marketing → Quotations, Sales → Quotations | ✅ Both can create quotes | admin can create quote directly for client not from marketing channel |
| 5 | `invoices` | Admin, Accounts | Finance → Invoices | ✅ Working | |
| 6 | `payments` | Accounts | Finance → Payments | ✅ Supports cash, bank & UPI modes | have record facility of cash and bank or upi transfer |
| 7 | `follow_ups` | Marketing | Marketing → Follow-ups | ✅ Connected to leads via lead_id | connect to leads |
| 8 | `notes` | Everyone | Dashboard Quick Notes, My Notes page | ✅ Each user sees only their own notes (filtered by user_id) | every dashboard / user have its own |
| 9 | `user_calendar_events` | Everyone | Dashboard widget, Full Calendar page | ✅ Each user has own calendar (filtered by user_id) | every dashboard/user have its own |
| 10 | `vendors` | Admin | Vendor management, Vendor Quick Add | ✅ Connected via jobs. ❌ Need reports page | vendors connect with jobs, print run, client. NEED: vendor/client/job reports (monthly/quarterly/annual) |
| 11 | `print_runs` | Admin/Production | Print Planner | ✅ Working | NEED: "Send to Printer" button on job page — set vendor, machine, mark as sent to print WITHOUT creating a full print run |

## Config / Reference Tables

| # | Table | Purpose | Status | Your Notes |
|---|---|---|---|---|
| 12 | `profiles` | User accounts & roles | ✅ Working | |
| 13 | `machines` | Print machines | ✅ Connected to jobs & vendors via print_runs | connect with jobs, vendor |
| 14 | `sheet_sizes` | Paper sizes | ✅ User-defined via Quick Add (no preloaded list) | we can define sheet size, no preload selection |
| 15 | `materials` | Print materials | ✅ User-defined & editable via Quick Add | depend on type of job (box, pouch, sticker etc.), editable, no predefined |
| 16 | `job_types` | Job type categories | ✅ User-defined, saves to dropdown. ❌ QC form: not yet | NEED: QC form — Pre-Print QC (based on product type) + Post-Print QC (based on job type). Keep separate. QC depends on BOTH job type & product type |
| 17 | `job_stages` | Workflow stages | ✅ Working | |
| 18 | `product_types` | Product types | ✅ Working | |
| 19 | `product_categories` | Product sub-categories | ✅ Working | |
| 20 | `priorities` | Priority levels | ✅ Working | |
| 21 | `vendor_categories` | Vendor groupings | ✅ Working | |
| 22 | `cash_accounts` | Bank/cash accounts | ✅ Working | |
| 23 | `paper_stock` | Paper inventory | ✅ Supports multiple sizes & material types | multiple paper types in CMYK — flexible entry for different size and type of paper materials |

## Tracking / History Tables

| # | Table | Purpose | Status | Your Notes |
|---|---|---|---|---|
| 24 | `job_stage_history` | Stage changes on jobs | ✅ Working | |
| 25 | `activity_logs` | System activity feed | ✅ Working | |
| 26 | `attachments` | Files on jobs | ✅ Working | |
| 27 | `print_run_jobs` | Jobs linked to print runs | ✅ Working | |
| 28 | `calendar_event_mentions` | @tagged users in events | ✅ Working | |
| 29 | `broadcast_notifications` | System notifications | ✅ Working | |
| 30 | `notification_dismissals` | Dismissed notifications | ✅ Working | |
| 31 | `commissions` | Marketing commissions | ✅ Working | |
| 32 | `eod_reports` | End-of-day reports | ✅ Working | |
