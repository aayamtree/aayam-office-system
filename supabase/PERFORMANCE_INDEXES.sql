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
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_jobs_client_deadline ON jobs(client_deadline); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_jobs_internal_deadline ON jobs(internal_deadline); EXCEPTION WHEN undefined_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_jobs_vendor_id ON jobs(vendor_id); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_jobs_designer_id ON jobs(designer_id); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status); EXCEPTION WHEN undefined_column THEN NULL; END $$;
-- Composite index for dashboard pipeline queries
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_jobs_stage_deadline ON jobs(current_stage, client_deadline)
    WHERE current_stage NOT IN ('delivered', 'cancelled');
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- LEADS
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to); EXCEPTION WHEN undefined_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up); EXCEPTION WHEN undefined_column THEN NULL; END $$;
-- Composite for dashboard follow-up queries
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_followup_active ON leads(next_follow_up, status)
    WHERE status NOT IN ('won', 'lost', 'converted');
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id); EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date); EXCEPTION WHEN undefined_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
-- Composite for overdue payment queries
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_invoices_unpaid_due ON invoices(due_date)
    WHERE payment_status != 'paid';
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- FOLLOW-UPS
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- CLIENTS (only create if columns exist)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- SALES ORDERS
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_sales_orders_client_id ON sales_orders(client_id); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders(created_at DESC); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- DISPATCHES
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_dispatches_job_id ON dispatches(job_id); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON dispatches(created_at DESC); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- DESIGN TASKS
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_design_tasks_status ON design_tasks(status); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_design_tasks_assigned_to ON design_tasks(assigned_to); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_design_tasks_job_id ON design_tasks(job_id); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_design_tasks_priority ON design_tasks(priority); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- QUOTATIONS
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON quotations(client_id); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- PAYMENTS RECEIVED
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_received_job_id ON payments_received(job_id);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_received_invoice_id ON payments_received(invoice_id);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_received_date ON payments_received(payment_date DESC);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- COMMISSIONS
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- ACTIVITY LOGS
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- EOD REPORTS
-- ─────────────────────────────────────────────
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_eod_reports_user_id ON eod_reports(user_id); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_eod_reports_date ON eod_reports(report_date DESC); EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;


-- ─────────────────────────────────────────────
-- CALENDAR EVENTS
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON user_calendar_events(user_id);
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON user_calendar_events(event_date);
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- JOB STAGE HISTORY
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_job_stage_history_job_id ON job_stage_history(job_id);
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_job_stage_history_created ON job_stage_history(created_at DESC);
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- INVOICE ITEMS
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- QUOTATION ITEMS
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- =============================================
-- Run ANALYZE to update query planner statistics
-- =============================================
DO $$ BEGIN ANALYZE jobs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE leads; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE invoices; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE clients; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE follow_ups; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE dispatches; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE design_tasks; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE quotations; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE sales_orders; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE payments_received; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ANALYZE activity_logs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
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
