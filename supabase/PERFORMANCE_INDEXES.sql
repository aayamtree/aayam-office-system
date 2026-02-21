-- ============================================
-- PERFORMANCE INDEXES (Safe version)
-- Run this in Supabase SQL Editor (one-time)
-- Each index is wrapped safely — skips if table/column doesn't exist
-- ============================================

DO $$
BEGIN
  -- === LEADS ===
  CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped some leads indexes — column/table missing';
END $$;

DO $$
BEGIN
  -- === FOLLOW-UPS ===
  CREATE INDEX IF NOT EXISTS idx_follow_ups_follow_up_date ON follow_ups(follow_up_date);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_client_id ON follow_ups(client_id);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped some follow_ups indexes';
END $$;

DO $$
BEGIN
  -- === QUOTATIONS ===
  CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
  CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
  CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON quotations(client_id);
  CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON quotations(lead_id);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped some quotations indexes';
END $$;

DO $$
BEGIN
  -- === JOBS ===
  CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs(current_stage);
  CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped some jobs indexes';
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_jobs_sales_person_id ON jobs(sales_person_id);
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipped jobs sales_person_id index';
END $$;

DO $$
BEGIN
  -- === DESIGN TASKS ===
  CREATE INDEX IF NOT EXISTS idx_design_tasks_assigned_to ON design_tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_design_tasks_status ON design_tasks(status);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped some design_tasks indexes';
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_design_tasks_job_id ON design_tasks(job_id);
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipped design_tasks job_id index';
END $$;

DO $$
BEGIN
  -- === INVOICES ===
  CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped some invoices indexes';
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipped invoices job_id index';
END $$;

DO $$
BEGIN
  -- === PURCHASE BILLS ===
  CREATE INDEX IF NOT EXISTS idx_purchase_bills_vendor_id ON purchase_bills(vendor_id);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped purchase_bills vendor_id index';
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_purchase_bills_job_id ON purchase_bills(job_id);
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipped purchase_bills job_id index';
END $$;

DO $$
BEGIN
  -- === DISPATCHES ===
  CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON dispatches(created_at DESC);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped dispatches created_at index';
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_dispatches_job_id ON dispatches(job_id);
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipped dispatches job_id index';
END $$;

DO $$
BEGIN
  -- === PAYMENTS RECEIVED ===
  CREATE INDEX IF NOT EXISTS idx_payments_received_client_id ON payments_received(client_id);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped payments_received client_id index';
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_received_job_id ON payments_received(job_id);
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipped payments_received job_id index';
END $$;

DO $$
BEGIN
  -- === EXPENSES ===
  CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date DESC);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped expenses index';
END $$;

DO $$
BEGIN
  -- === COMMISSIONS ===
  CREATE INDEX IF NOT EXISTS idx_commissions_marketing_person_id ON commissions(marketing_person_id);
  CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at DESC);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped commissions indexes';
END $$;

DO $$
BEGIN
  -- === CLIENTS ===
  CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
  CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'Skipped clients indexes';
END $$;

-- ============================================
-- DONE! Each block runs independently.
-- Missing columns are safely skipped.
-- ============================================
