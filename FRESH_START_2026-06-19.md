# Fresh Start — 19 June 2026

The project/sales data was wiped to start clean with the new stage pipeline and the new
`DO / PO / DP` numbering scheme. A full backup was taken first and is still inside the database.

## What was deleted (now empty)
jobs (148), job_stage_history (211), quotations (24) + quotation_items (32), leads (25),
follow_ups, dossier_entries (22), daily_work_reports/EOD (31), report_task_updates,
design_tasks (4), design_projects, designer_hours, task_status_history, task_time_sessions,
task_transfers, print_runs (4), print_run_jobs, print_batches, print_batch_items,
sales_orders, invoices, invoice_items, payments_received, dispatches, commissions,
product_requirements, cmyk_expenses, cmyk_job_logs, label_checks, job_notes, job_subtasks,
notifications, broadcast_notifications, notification_dismissals, activity_logs, captures.

Sequential counters (QT, LD, INV, SO…) were reset to 0. Job numbers restart automatically
because they are derived from the (now empty) jobs table.

## What was KEPT (untouched)
clients (48), vendors (14), brands, product_categories (29), product_types, job_types,
job_stages (16, the new pipeline config), priorities, machines, materials, bank_accounts (1),
bank_transactions (79), journal_entries (29), purchase_bills (6), vendor_payments,
cash accounts/transactions, profiles/users (19), and all app settings.

Three links that pointed at deleted records were cleared (data kept):
`purchase_bills.job_id`, `notes.linked_job_id`, `clients.source_lead_id`.

## The backup — how to restore
A full snapshot of every cleared table lives in the database schema **`backup_20260619`**.
Each table is a 1:1 copy, e.g. `backup_20260619.jobs`, `backup_20260619.quotations`, etc.

To restore a table (example):
```sql
INSERT INTO public.jobs SELECT * FROM backup_20260619.jobs;
```
Restore children/parents in dependency order if restoring several. The original job→link
columns are saved in `backup_20260619.purchase_bills_joblinks`, `notes_joblinks`,
`clients_leadlinks`.

When you're confident the fresh start is good and no restore is needed, the backup schema
can be dropped to reclaim space:
```sql
DROP SCHEMA backup_20260619 CASCADE;
```

## New job numbering
Format: `<TYPE>-DDMMNNN` — `DO` = Design Only, `PO` = Print Only, `DP` = Design + Print.
DDMM = day+month, NNN = shared daily sequence. Example: `DP-1906001`.
The first job created today will be `…-1906001`.
