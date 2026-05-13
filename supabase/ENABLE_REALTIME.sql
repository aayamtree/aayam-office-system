-- ============================================
-- ENABLE SUPABASE REALTIME ON KEY TABLES
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- Enables real-time WebSocket notifications so
-- all connected clients get instant updates.
-- ============================================

-- Run each block separately if any fails.
-- If a table doesn't exist, skip that line.

-- Core business tables
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_items;

-- Payments & Finance
ALTER PUBLICATION supabase_realtime ADD TABLE payments_received;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE vendor_payments;

-- Sales & Marketing
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE quotations;
ALTER PUBLICATION supabase_realtime ADD TABLE sales_orders;

-- Design & Production
ALTER PUBLICATION supabase_realtime ADD TABLE design_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE design_projects;

-- Print Planner
ALTER PUBLICATION supabase_realtime ADD TABLE print_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE print_run_jobs;

-- Dispatch
ALTER PUBLICATION supabase_realtime ADD TABLE dispatches;

-- Calendar
ALTER PUBLICATION supabase_realtime ADD TABLE user_calendar_events;

-- CRM
ALTER PUBLICATION supabase_realtime ADD TABLE vendors;

-- CMYK / POS
ALTER PUBLICATION supabase_realtime ADD TABLE paper_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_sales;
