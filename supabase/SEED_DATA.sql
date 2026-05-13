-- ============================================================================
-- AAYAM OFFICE SYSTEM: SEED DATA (v2 - Schema Aligned)
-- ============================================================================
-- Run this in Supabase SQL Editor.

-- 1. Create Sample Clients
-- Columns: name, company, email, phone, address, gstin, client_type, credit_limit, outstanding_balance, is_active
INSERT INTO clients (name, company, email, phone, address, gstin, client_type, credit_limit, outstanding_balance, is_active)
VALUES
  ('Ramesh Gupta', 'Gupta Textiles', 'ramesh@guptatex.com', '9876543210', '123 Textile Market, Surat', '24ABCDE1234F1Z5', 'regular', 100000, 0, true),
  ('Priya Patel', 'Priya Designs', 'priya@designs.com', '9898012345', '45 Ring Road, Surat', NULL, 'premium', 50000, 0, true),
  ('Amit Shah', 'Shah Electronics', 'amit@shah.com', '9909988776', 'Varachha Road, Surat', '24PQRST5678G2Z9', 'regular', 200000, 0, true),
  ('Sanjay Mehta', 'Mehta & Sons', 'sanjay@mehta.com', '9825011223', 'Adajan, Surat', NULL, 'corporate', 75000, 0, true);

-- 2. Create Sample Vendors
-- Columns: name, company, category, phone, email, gstin, payment_terms, outstanding_balance, is_active
INSERT INTO vendors (name, company, category, phone, email, gstin, payment_terms, outstanding_balance, is_active)
VALUES
  ('Vijay Kumar', 'Vijay Paper Mart', 'Paper Supplier', '9870098700', 'vijay@paper.com', '24XYZAB9876H1Z1', 30, 0, true),
  ('Rajesh Printers', 'Rajesh Offset', 'Offset Printing', '9825098250', 'rajesh@offset.com', '24LMNOP4321J1Z2', 15, 0, true),
  ('Sunil Binding', 'Sunil Binders', 'Binding', '9998887776', NULL, NULL, 7, 0, true);

-- 3. Create Sample Designers
-- Columns: name, email, phone, skills, employment_type, hourly_rate, monthly_salary, is_active
INSERT INTO designers (name, email, phone, skills, employment_type, hourly_rate, monthly_salary, is_active)
VALUES
  ('Rahul Sharma', 'rahul@aayam.com', '9000011111', ARRAY['Wedding Cards', 'CorelDraw'], 'full-time', 0, 25000, true),
  ('Sneha Patel', 'sneha@aayam.com', '9000022222', ARRAY['Branding', 'Photoshop'], 'full-time', 0, 22000, true),
  ('Ankit Verma', 'ankit@aayam.com', '9000033333', ARRAY['Packaging', 'Illustrator'], 'freelance', 500, 0, true);

-- 4. Create Sample Paper Stocks
-- Columns: name, gsm, size, quantity, unit, reorder_level, cost_per_unit
INSERT INTO paper_stocks (name, gsm, size, quantity, unit, reorder_level, cost_per_unit)
VALUES
  ('Glossy Art Paper', 130, '25x36', 500, 'sheets', 100, 5.5),
  ('Matt Board', 300, '22x28', 250, 'sheets', 50, 12.0),
  ('Maplitho', 80, '23x36', 1000, 'sheets', 200, 3.2),
  ('Texture Wedding', 250, '19x25', 100, 'sheets', 20, 25.0);

-- 5. Create Bank Accounts
-- Columns: name, account_number, account_type, opening_balance, current_balance, is_default, is_active
INSERT INTO bank_accounts (name, account_number, account_type, opening_balance, current_balance, is_default, is_active)
VALUES
  ('Office Cash', 'CASH-001', 'current', 15000, 15000, false, true),
  ('HDFC Primary', '50200012345678', 'current', 125000, 125000, true, true),
  ('SBI Current', '30987654321', 'current', 45000, 45000, false, true);

-- 6. Create Sample Jobs (Orders)
-- Using defaults for subtotal/gst to keep it simple, but satisfying NOT NULL constraints if any
WITH 
  client_1 AS (SELECT id FROM clients WHERE company = 'Gupta Textiles' LIMIT 1),
  client_2 AS (SELECT id FROM clients WHERE company = 'Priya Designs' LIMIT 1),
  designer_1 AS (SELECT id FROM designers WHERE name = 'Rahul Sharma' LIMIT 1),
  designer_2 AS (SELECT id FROM designers WHERE name = 'Sneha Patel' LIMIT 1)

INSERT INTO jobs (
  job_number, project_name, client_id, designer_id, 
  current_stage, priority, description, quantity,
  quote_per_piece, subtotal, gst_rate, gst_amount, discount_amount, total_amount,
  payment_status, amount_received, order_date
)
SELECT 
  'AAY-001', 'Diwali Brochure 2025', client_1.id, designer_1.id, 
  'designing', 'high', 'Trifold brochure with gold foil', 1000,
  15, 15000, 0, 0, 0, 15000,
  'pending', 0, NOW()
FROM client_1, designer_1
UNION ALL
SELECT 
  'AAY-002', 'Visiting Cards', client_1.id, designer_2.id, 
  'delivered', 'normal', '1000 cards on ivory sheet', 1000,
  2.5, 2500, 0, 0, 0, 2500,
  'paid', 2500, NOW() - INTERVAL '5 days'
FROM client_1, designer_2
UNION ALL
SELECT 
  'AAY-003', 'Wedding Invitation Suite', client_2.id, designer_1.id, 
  'printing', 'urgent', 'Premium box invite with inserts', 500,
  90, 45000, 0, 0, 0, 45000,
  'partial', 20000, NOW() - INTERVAL '2 days'
FROM client_2, designer_1;

-- 7. Create Design Tasks
WITH 
  job_1 AS (SELECT id FROM jobs WHERE job_number = 'AAY-001' LIMIT 1),
  client_1 AS (SELECT id FROM clients WHERE company = 'Gupta Textiles' LIMIT 1),
  designer_1 AS (SELECT id FROM designers WHERE name = 'Rahul Sharma' LIMIT 1)

INSERT INTO design_tasks (
  task_number, title, description, job_id, client_id, assigned_to, 
  status, priority, deadline, estimated_hours, actual_hours
)
SELECT 
  'TSK-001', 'Brochure Cover Design', 'Create 3 variations for cover', job_1.id, client_1.id, designer_1.id, 
  'in_progress', 'high', NOW() + INTERVAL '2 days', 4, 0
FROM job_1, client_1, designer_1;

SELECT 'Seed data v2 successfully inserted!' as result;
