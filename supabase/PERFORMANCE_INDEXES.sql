-- ============================================
-- PERFORMANCE INDEXES
-- Run this in Supabase SQL Editor (one-time)
-- These speed up the most common queries  
-- ============================================

-- === LEADS ===
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);

-- === FOLLOW-UPS ===
CREATE INDEX IF NOT EXISTS idx_follow_ups_follow_up_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_client_id ON follow_ups(client_id);

-- === QUOTATIONS ===
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON quotations(lead_id);

-- === JOBS ===
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs(current_stage);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_sales_person_id ON jobs(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);

-- === DESIGN TASKS ===
-- Filtered by assigned_to (designer)
CREATE INDEX IF NOT EXISTS idx_design_tasks_assigned_to ON design_tasks(assigned_to);
-- Filtered by status
CREATE INDEX IF NOT EXISTS idx_design_tasks_status ON design_tasks(status);
-- Filtered by job_id
CREATE INDEX IF NOT EXISTS idx_design_tasks_job_id ON design_tasks(job_id);

-- === INVOICES ===
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- === PURCHASE BILLS ===
CREATE INDEX IF NOT EXISTS idx_purchase_bills_vendor_id ON purchase_bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_job_id ON purchase_bills(job_id);

-- === DISPATCHES ===
CREATE INDEX IF NOT EXISTS idx_dispatches_job_id ON dispatches(job_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON dispatches(created_at DESC);

-- === PAYMENTS ===
CREATE INDEX IF NOT EXISTS idx_payments_received_job_id ON payments_received(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_client_id ON payments_received(client_id);

-- === EXPENSES ===
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date DESC);

-- === COMMISSIONS ===
CREATE INDEX IF NOT EXISTS idx_commissions_marketing_person_id ON commissions(marketing_person_id);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at DESC);

-- === CLIENTS ===
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);

-- ============================================
-- DONE! These indexes help Supabase find data
-- faster without scanning every row.
-- ============================================
