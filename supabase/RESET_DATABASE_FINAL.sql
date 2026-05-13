-- ================================================
-- COMPLETE DATABASE RESET - PROPERLY AUDITED
-- Based on actual schema from SETUP.sql and other migrations
-- ================================================

SET session_replication_role = replica;

-- ================================================
-- DELETE IN CORRECT ORDER (foreign keys respected)
-- ================================================

-- Step 1: Quotation system
DELETE FROM quotation_items;
DELETE FROM quotations;

-- Step 2: Follow-ups
DELETE FROM follow_ups;

-- Step 3: Leads
DELETE FROM leads;

-- Step 4: Financial records (payments first)
DELETE FROM payments_received;
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM sales_orders;

-- Step 5: Job management
DELETE FROM job_checklists;
DELETE FROM design_tasks;
DELETE FROM dispatches;
DELETE FROM jobs;

-- Step 6: Supporting data
DELETE FROM clients;
DELETE FROM vendors;
DELETE FROM designers;
DELETE FROM paper_stock;

-- Step 7: Activity & notifications
DELETE FROM activity_logs;
DELETE FROM notes;
DELETE FROM reminders;

-- Step 8: Reset counter table (uses 'counters' not 'id_counters')
DELETE FROM counters;

-- Re-insert default counters
INSERT INTO counters (id, current_number) VALUES
  ('job', 0),
  ('invoice', 0),
  ('quotation', 0),
  ('client', 0),
  ('lead', 0),
  ('sales_order', 0),
  ('dispatch', 0),
  ('payment', 0);

SET session_replication_role = DEFAULT;

-- ================================================
-- VERIFICATION
-- ================================================
SELECT 
  'RESET COMPLETE' as status,
  (SELECT COUNT(*) FROM clients) as clients,
  (SELECT COUNT(*) FROM leads) as leads,
  (SELECT COUNT(*) FROM quotations) as quotations,
  (SELECT COUNT(*) FROM follow_ups) as follow_ups,
  (SELECT COUNT(*) FROM jobs) as jobs,
  (SELECT COUNT(*) FROM invoices) as invoices,
  (SELECT COUNT(*) FROM payments_received) as payments,
  (SELECT COUNT(*) FROM activity_logs) as activities,
  (SELECT COUNT(*) FROM counters) as counters_reset;

-- All counts should be 0 except counters (should be 8)
