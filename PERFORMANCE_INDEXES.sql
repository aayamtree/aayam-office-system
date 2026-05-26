-- =====================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Created: 2026-05-26
-- Purpose: Add missing indexes for frequently filtered columns
-- =====================================================

-- High-priority indexes for performance (run these first)
-- These will dramatically improve query performance

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs(current_stage);
CREATE INDEX IF NOT EXISTS idx_jobs_client_deadline ON jobs(client_deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_designer_id ON jobs(designer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_vendor_id ON jobs(vendor_id);

-- Composite indexes for complex queries in dashboard
CREATE INDEX IF NOT EXISTS idx_jobs_stage_deadline ON jobs(current_stage, client_deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_created_amount ON jobs(created_at DESC, total_amount);

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_is_converted ON leads(is_converted);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_date);

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Vendors table indexes
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);

-- Invoices table indexes
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Design tasks table indexes
CREATE INDEX IF NOT EXISTS idx_design_tasks_status ON design_tasks(status);
CREATE INDEX IF NOT EXISTS idx_design_tasks_job_id ON design_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_design_tasks_assigned_to ON design_tasks(assigned_to);

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_can_design ON profiles(can_design) WHERE is_active = true;

-- QC records table indexes
CREATE INDEX IF NOT EXISTS idx_qc_records_job_id ON qc_records(job_id);
CREATE INDEX IF NOT EXISTS idx_qc_records_performed_at ON qc_records(performed_at DESC);

-- Quotations table indexes
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_received_invoice_id ON payments_received(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_payment_date ON payments_received(payment_date DESC);

-- Bank transactions indexes
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_vendor_id ON bank_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date DESC);

-- Follow-ups table indexes
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_next_date ON follow_ups(next_followup_date);

-- Activity logs indexes (for audit trail queries)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Print runs indexes
CREATE INDEX IF NOT EXISTS idx_print_runs_status ON print_runs(status);
CREATE INDEX IF NOT EXISTS idx_print_runs_scheduled_date ON print_runs(scheduled_date);

-- =====================================================
-- VERIFICATION QUERY
-- Run this to see all indexes after creation
-- =====================================================

-- SELECT 
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
