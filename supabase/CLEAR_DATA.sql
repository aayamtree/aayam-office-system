-- ========================================
-- CLEAR TEST/SAMPLE DATA FROM DATABASE
-- ========================================
-- RUN THESE CAREFULLY IN SUPABASE SQL EDITOR
-- Each section can be run independently

-- ========================================
-- OPTION 1: Clear ALL Data (DANGER!)
-- ========================================
-- ⚠️ WARNING: This will delete EVERYTHING
-- Only run this if you want to start completely fresh

-- Disable triggers temporarily
SET session_replication_role = replica;

-- Delete in correct order (respecting foreign keys)
DELETE FROM quotation_items;
DELETE FROM follow_ups;
DELETE FROM quotations;
DELETE FROM leads;
DELETE FROM clients;
DELETE FROM activity_logs;
DELETE FROM notes;
DELETE FROM reminders;
DELETE FROM job_files;
DELETE FROM design_tasks;
DELETE FROM design_projects;
DELETE FROM job_checklist;
DELETE FROM jobs;
DELETE FROM dispatches;
DELETE FROM invoices;
DELETE FROM sales_orders;
DELETE FROM payment_received;
DELETE FROM vendor_payments;
DELETE FROM purchase_bills;
DELETE FROM bank_transactions;
DELETE FROM pos_sales;
DELETE FROM pos_sale_items;
DELETE FROM pos_products;
DELETE FROM pos_categories;
DELETE FROM paper_stock;
DELETE FROM vendors;
DELETE FROM designers;
DELETE FROM bank_accounts;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset sequence counters (optional)
-- This resets auto-increment counters
DELETE FROM id_counters;

-- ========================================
-- OPTION 2: Clear ONLY Marketing Data
-- ========================================
-- Safer option - only clears marketing-related data
-- This handles ALL foreign key dependencies

-- Step 1: Delete related financial records first
DELETE FROM payment_received WHERE client_id IN (SELECT id FROM clients);

-- Step 2: Delete quotation-related data
DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations);
DELETE FROM quotations;

-- Step 3: Delete follow-ups
DELETE FROM follow_ups;

-- Step 4: Delete jobs related to clients (if you want to keep jobs, skip this)
-- DELETE FROM job_files WHERE job_id IN (SELECT id FROM jobs WHERE client_id IN (SELECT id FROM clients));
-- DELETE FROM design_tasks WHERE job_id IN (SELECT id FROM jobs WHERE client_id IN (SELECT id FROM clients));
-- DELETE FROM job_checklist WHERE job_id IN (SELECT id FROM jobs WHERE client_id IN (SELECT id FROM clients));
-- DELETE FROM jobs WHERE client_id IN (SELECT id FROM clients);

-- Step 5: Delete invoices related to clients
DELETE FROM invoices WHERE client_id IN (SELECT id FROM clients);

-- Step 6: Delete sales orders
DELETE FROM sales_orders WHERE client_id IN (SELECT id FROM clients);

-- Step 7: Delete leads
DELETE FROM leads;

-- Step 8: Finally delete clients
DELETE FROM clients;

-- Step 9: Reset marketing counters
DELETE FROM id_counters WHERE counter_id IN ('lead', 'quotation', 'client');

-- Verify counts
SELECT 
  (SELECT COUNT(*) FROM leads) as leads,
  (SELECT COUNT(*) FROM clients) as clients,
  (SELECT COUNT(*) FROM quotations) as quotations,
  (SELECT COUNT(*) FROM follow_ups) as follow_ups,
  (SELECT COUNT(*) FROM payment_received) as payments;

-- ========================================
-- OPTION 3: Clear Specific Table
-- ========================================
-- Run only the table you want to clear

-- Clear Leads only
DELETE FROM follow_ups WHERE lead_id IS NOT NULL;
DELETE FROM leads;

-- Clear Clients only  
DELETE FROM clients WHERE id NOT IN (SELECT DISTINCT client_id FROM jobs WHERE client_id IS NOT NULL);

-- Clear Quotations only
DELETE FROM quotation_items;
DELETE FROM quotations;

-- Clear Follow-ups only
DELETE FROM follow_ups;

-- ========================================
-- OPTION 4: Clear Test Users' Data Only
-- ========================================
-- Replace 'USER_EMAIL_HERE' with actual test user email

-- First, get the user ID
WITH test_user AS (
  SELECT id FROM profiles WHERE email = 'test@example.com' -- Change this
)
DELETE FROM leads WHERE created_by IN (SELECT id FROM test_user);
DELETE FROM quotations WHERE created_by IN (SELECT id FROM test_user);
DELETE FROM follow_ups WHERE created_by IN (SELECT id FROM test_user);

-- ========================================
-- OPTION 5: Clear Data Created After Specific Date
-- ========================================
-- Delete only recent test data

DELETE FROM follow_ups WHERE created_at > '2026-01-28';
DELETE FROM quotations WHERE created_at > '2026-01-28';
DELETE FROM leads WHERE created_at > '2026-01-28';
DELETE FROM clients WHERE created_at > '2026-01-28';

-- ========================================
-- VERIFY DELETION
-- ========================================
-- Run these to check what's left

SELECT COUNT(*) as leads_count FROM leads;
SELECT COUNT(*) as clients_count FROM clients;
SELECT COUNT(*) as quotations_count FROM quotations;
SELECT COUNT(*) as follow_ups_count FROM follow_ups;

-- ========================================
-- NOTES
-- ========================================
-- 1. Always backup before running delete queries!
-- 2. Start with Option 2 or 3 (safer)
-- 3. Option 1 is DESTRUCTIVE - use only for fresh start
-- 4. You cannot undo these operations!
-- 5. RLS policies might prevent deletion - run as admin

-- To disable RLS temporarily (if needed):
-- ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
-- ... run deletes ...
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
