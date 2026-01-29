-- ================================================
-- COMPLETE DATA RESET FOR FRESH TESTING
-- ================================================
-- ⚠️ WARNING: This deletes ALL operational data!
-- Only keeps: User profiles and system configuration
-- ================================================

-- Step 1: Disable foreign key checks temporarily
SET session_replication_role = replica;

-- ================================================
-- DELETE ALL OPERATIONAL DATA
-- ================================================

-- Financial & Payment Data
DELETE FROM payments_received;
DELETE FROM vendor_payments;
DELETE FROM purchase_bills;
DELETE FROM bank_transactions;

-- Sales & Invoicing
DELETE FROM invoices;
DELETE FROM sales_orders;

-- POS System
DELETE FROM pos_sale_items;
DELETE FROM pos_sales;
DELETE FROM pos_products;
DELETE FROM pos_categories;

-- Job Management
DELETE FROM job_files;
DELETE FROM design_tasks;
DELETE FROM design_projects;
DELETE FROM job_checklist;
DELETE FROM dispatches;
DELETE FROM jobs;

-- Marketing & CRM
DELETE FROM quotation_items;
DELETE FROM quotations;
DELETE FROM follow_ups;
DELETE FROM leads;
DELETE FROM clients;

-- Inventory
DELETE FROM paper_stock;

-- Vendors & Designers
DELETE FROM vendors;
DELETE FROM designers;

-- Bank Accounts (optional - uncomment if you want to keep bank setup)
-- DELETE FROM bank_accounts;

-- Activity & Notes
DELETE FROM activity_logs;
DELETE FROM notes;
DELETE FROM reminders;

-- User Calendar Events (optional - uncomment to clear)
-- DELETE FROM user_calendar_events;

-- EOD Reports (optional - uncomment to clear)
-- DELETE FROM eod_reports;

-- ================================================
-- RESET ALL COUNTERS
-- ================================================
DELETE FROM id_counters;

-- Re-insert default counters at 0
INSERT INTO id_counters (counter_id, current_value) VALUES
  ('job', 0),
  ('invoice', 0),
  ('quotation', 0),
  ('purchase_bill', 0),
  ('client', 0),
  ('lead', 0),
  ('sales_order', 0),
  ('dispatch', 0);

-- ================================================
-- RE-ENABLE FOREIGN KEY CHECKS
-- ================================================
SET session_replication_role = DEFAULT;

-- ================================================
-- VERIFY CLEAN DATABASE
-- ================================================
SELECT 
  'DELETED' as status,
  (SELECT COUNT(*) FROM clients) as clients,
  (SELECT COUNT(*) FROM leads) as leads,
  (SELECT COUNT(*) FROM quotations) as quotations,
  (SELECT COUNT(*) FROM follow_ups) as follow_ups,
  (SELECT COUNT(*) FROM jobs) as jobs,
  (SELECT COUNT(*) FROM invoices) as invoices,
  (SELECT COUNT(*) FROM payments_received) as payments,
  (SELECT COUNT(*) FROM vendors) as vendors,
  (SELECT COUNT(*) FROM designers) as designers,
  (SELECT COUNT(*) FROM activity_logs) as activities;

-- ================================================
-- WHAT REMAINS?
-- ================================================
-- ✅ User profiles (profiles table)
-- ✅ System settings
-- ✅ Bank accounts (unless you uncommented deletion)
-- ✅ User calendar events (unless you uncommented deletion)
-- ✅ EOD reports (unless you uncommented deletion)
-- ✅ Google Drive credentials
-- ✅ RLS policies and permissions

-- ================================================
-- NEXT STEPS
-- ================================================
-- 1. Refresh your browser (Ctrl+Shift+R)
-- 2. Start adding fresh test data
-- 3. All counters reset - next job will be JOB-001, etc.
