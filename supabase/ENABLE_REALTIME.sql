-- ============================================
-- ENABLE SUPABASE REALTIME ON KEY TABLES
-- ============================================
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- This enables real-time WebSocket notifications for all key tables
-- so that when any user makes a change, all connected clients
-- get instant updates without page refresh.
-- ============================================

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

-- Calendar & Communication
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE user_calendar_events;

-- CRM
ALTER PUBLICATION supabase_realtime ADD TABLE vendors;

-- CMYK / POS
ALTER PUBLICATION supabase_realtime ADD TABLE paper_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_sales;

-- ============================================
-- NOTE: If a table doesn't exist yet, that line
-- will error — just skip it, it's not critical.
-- The important ones are: jobs, clients, invoices,
-- leads, design_tasks, print_runs, payments_received
-- ============================================
