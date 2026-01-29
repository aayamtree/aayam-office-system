-- ================================================
-- SIMPLIFIED DATABASE RESET
-- Only deletes from tables that exist in your system
-- ================================================

SET session_replication_role = replica;

-- Core Marketing & CRM (these definitely exist)
DELETE FROM quotation_items;
DELETE FROM quotations;
DELETE FROM follow_ups;
DELETE FROM leads;

-- Clients & Financial
DELETE FROM payments_received;
DELETE FROM invoices;
DELETE FROM sales_orders;
DELETE FROM clients;

-- Job Management
DELETE FROM job_files;
DELETE FROM design_tasks;
DELETE FROM job_checklist;
DELETE FROM dispatches;
DELETE FROM jobs;

-- Supporting Data
DELETE FROM vendors;
DELETE FROM designers;
DELETE FROM paper_stock;
DELETE FROM activity_logs;
DELETE FROM notes;
DELETE FROM reminders;

-- Optional: Uncomment if these tables exist
-- DELETE FROM vendor_payments;
-- DELETE FROM purchase_bills;
-- DELETE FROM bank_transactions;
-- DELETE FROM design_projects;

-- Reset counters
DELETE FROM id_counters;
INSERT INTO id_counters (counter_id, current_value) VALUES
  ('job', 0),
  ('invoice', 0),
  ('quotation', 0),
  ('client', 0),
  ('lead', 0),
  ('sales_order', 0),
  ('dispatch', 0);

SET session_replication_role = DEFAULT;

-- Verify deletion
SELECT 
  (SELECT COUNT(*) FROM clients) as clients,
  (SELECT COUNT(*) FROM leads) as leads,
  (SELECT COUNT(*) FROM quotations) as quotations,
  (SELECT COUNT(*) FROM jobs) as jobs,
  (SELECT COUNT(*) FROM invoices) as invoices,
  (SELECT COUNT(*) FROM payments_received) as payments,
  (SELECT COUNT(*) FROM activity_logs) as activities;
