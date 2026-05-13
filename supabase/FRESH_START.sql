-- ==========================================
-- FRESH START SCRIPT (NUCLEAR OPTION)
-- ==========================================
-- WARNING: THIS WILL DELETE ALL DATA IN THE DATABASE
-- Run this to get a 100% clean slate compatible with the code.

-- 1. DROP EVERYTHING (CASCADE)
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS dispatches CASCADE;
DROP TABLE IF EXISTS vendor_payments CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS design_tasks CASCADE;
DROP TABLE IF EXISTS task_remarks CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS designers CASCADE;
DROP TABLE IF EXISTS counters CASCADE;
DROP FUNCTION IF EXISTS get_next_number CASCADE;

-- 2. CREATE TABLES

-- PROFILES (Usually managed by Supabase Auth, but we ensure columns exist)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- CLIENTS
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  alt_phone TEXT,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  client_type TEXT DEFAULT 'regular',
  credit_limit NUMERIC DEFAULT 0,
  outstanding_balance NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- VENDORS
CREATE TABLE vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  category TEXT,
  payment_terms INTEGER DEFAULT 0,
  outstanding_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;

-- JOBS (ORDERS)
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_number TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  vendor_id UUID REFERENCES vendors(id),
  designer_id UUID, 
  job_type TEXT,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  
  quote_per_piece NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  gst_rate NUMERIC DEFAULT 18,
  gst_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  
  payment_status TEXT DEFAULT 'pending', 
  amount_received NUMERIC DEFAULT 0,
  
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_deadline TIMESTAMP WITH TIME ZONE,
  internal_deadline TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  
  current_stage TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  
  files JSONB DEFAULT '[]',
  notes TEXT,
  is_active BOOLEAN DEFAULT true, -- Requested by error log
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
-- Drop FK immediately for safety
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_created_by_fkey;


-- DISPATCHES
CREATE TABLE dispatches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_number TEXT UNIQUE NOT NULL,
  job_id UUID REFERENCES jobs(id),
  client_id UUID REFERENCES clients(id),
  status TEXT DEFAULT 'pending',
  transporter_name TEXT,
  tracking_number TEXT,
  vehicle_number TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  dispatch_date TIMESTAMP WITH TIME ZONE,
  expected_delivery TIMESTAMP WITH TIME ZONE,
  actual_delivery TIMESTAMP WITH TIME ZONE,
  packages INTEGER DEFAULT 1,
  weight NUMERIC,
  delivery_address TEXT,
  proof_of_delivery_url TEXT,
  receiver_name TEXT,
  notes TEXT,
  dispatched_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE dispatches DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches DROP CONSTRAINT IF EXISTS dispatches_dispatched_by_fkey;

-- INVOICES
CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  job_id UUID REFERENCES jobs(id),
  subtotal NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  amount_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  invoice_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  terms TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;

-- INVOICE ITEMS
CREATE TABLE invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  hsn_code TEXT,
  gst_rate NUMERIC DEFAULT 18
);
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;

-- EXPENSES
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_number TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  payment_mode TEXT,
  bank_account_id UUID, 
  expense_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  receipt_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;

-- VENDOR PAYMENTS
CREATE TABLE vendor_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number TEXT UNIQUE NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  purchase_bill_id UUID,
  amount NUMERIC DEFAULT 0,
  payment_mode TEXT,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  bank_account_id UUID,
  reference_number TEXT,
  notes TEXT,
  paid_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE vendor_payments DISABLE ROW LEVEL SECURITY;

-- COUNTERS
CREATE TABLE counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT UNIQUE NOT NULL,
  current_number INTEGER DEFAULT 0,
  financial_year TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE counters DISABLE ROW LEVEL SECURITY;

-- 3. FUNCTIONS
CREATE OR REPLACE FUNCTION get_next_number(counter_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
  prefix_val TEXT;
  year_val TEXT;
  result TEXT;
BEGIN
  -- Determine prefix based on input
  IF counter_id = 'job' THEN prefix_val := 'AAY';
  ELSIF counter_id = 'invoice' THEN prefix_val := 'INV';
  ELSE prefix_val := 'GEN';
  END IF;

  year_val := to_char(current_date, 'YY');

  -- Upsert counter
  INSERT INTO counters (prefix, current_number, financial_year)
  VALUES (prefix_val, 0, year_val)
  ON CONFLICT (prefix) DO NOTHING;

  -- Increment
  UPDATE counters 
  SET current_number = current_number + 1, updated_at = NOW()
  WHERE prefix = prefix_val
  RETURNING current_number INTO next_val;

  -- Format result
  result := prefix_val || '-' || year_val || '-' || lpad(next_val::text, 3, '0');
  
  RETURN result;
END;
$$;

SELECT 'FRESH INSTALL COMPLETE' as status;
