-- =============================================
-- PERFORMANCE INDEXES
-- Run once in Supabase SQL Editor
-- These indexes dramatically speed up common queries
-- Safe to re-run (IF NOT EXISTS prevents duplicates)
-- =============================================

-- ─────────────────────────────────────────────
-- JOBS (most queried table)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs(current_stage);
CREATE INDEX IF NOT EXISTS idx_jobs_client_deadline ON jobs(client_deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_internal_deadline ON jobs(internal_deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_vendor_id ON jobs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_jobs_designer_id ON jobs(designer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
-- Composite index for dashboard pipeline queries
CREATE INDEX IF NOT EXISTS idx_jobs_stage_deadline ON jobs(current_stage, client_deadline)
  WHERE current_stage NOT IN ('delivered', 'cancelled');

-- ─────────────────────────────────────────────
-- LEADS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);
-- Composite for dashboard follow-up queries
CREATE INDEX IF NOT EXISTS idx_leads_followup_active ON leads(next_follow_up, status)
  WHERE status NOT IN ('won', 'lost', 'converted');

-- ─────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
-- Composite for overdue payment queries
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid_due ON invoices(due_date)
  WHERE payment_status != 'paid';

-- ─────────────────────────────────────────────
-- FOLLOW-UPS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

-- ─────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);

-- ─────────────────────────────────────────────
-- SALES ORDERS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_orders_client_id ON sales_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);

-- ─────────────────────────────────────────────
-- DISPATCHES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_job_id ON dispatches(job_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON dispatches(created_at DESC);

-- ─────────────────────────────────────────────
-- DESIGN TASKS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_design_tasks_status ON design_tasks(status);
CREATE INDEX IF NOT EXISTS idx_design_tasks_assigned_to ON design_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_design_tasks_job_id ON design_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_design_tasks_priority ON design_tasks(priority);

-- ─────────────────────────────────────────────
-- QUOTATIONS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);

-- ─────────────────────────────────────────────
-- PAYMENTS RECEIVED
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_received_job_id ON payments_received(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_invoice_id ON payments_received(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_date ON payments_received(payment_date DESC);

-- ─────────────────────────────────────────────
-- COMMISSIONS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- ─────────────────────────────────────────────
-- ACTIVITY LOGS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);

-- ─────────────────────────────────────────────
-- EOD REPORTS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_eod_reports_user_id ON eod_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_eod_reports_date ON eod_reports(report_date DESC);

-- ─────────────────────────────────────────────
-- CALENDAR EVENTS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON user_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON user_calendar_events(event_date);

-- ─────────────────────────────────────────────
-- JOB STAGE HISTORY
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_job_stage_history_job_id ON job_stage_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_stage_history_created ON job_stage_history(created_at DESC);

-- ─────────────────────────────────────────────
-- INVOICE ITEMS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ─────────────────────────────────────────────
-- QUOTATION ITEMS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- =============================================
-- Run ANALYZE to update query planner statistics
-- =============================================
ANALYZE jobs;
ANALYZE leads;
ANALYZE invoices;
ANALYZE clients;
ANALYZE follow_ups;
ANALYZE dispatches;
ANALYZE design_tasks;
ANALYZE quotations;
ANALYZE sales_orders;
ANALYZE payments_received;
ANALYZE activity_logs;

-- =============================================
-- Verify: List all indexes created
-- =============================================
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
