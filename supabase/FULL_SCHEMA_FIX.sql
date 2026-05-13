-- SAFE FULL SCHEMA CREATION SCRIPT
-- Run this to ensure all tables exist and are unlocked

-- 1. JOBS
CREATE TABLE IF NOT EXISTS jobs (
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
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. DISPATCHES
CREATE TABLE IF NOT EXISTS dispatches (
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

-- 3. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
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

-- 4. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  hsn_code TEXT,
  gst_rate NUMERIC DEFAULT 18
);

-- 5. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
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

-- 6. VENDOR PAYMENTS
CREATE TABLE IF NOT EXISTS vendor_payments (
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

CREATE TABLE IF NOT EXISTS counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT UNIQUE NOT NULL,
  current_number INTEGER DEFAULT 0,
  financial_year TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. DISABLE RLS ON ALL (For Safety)
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE counters DISABLE ROW LEVEL SECURITY;

SELECT 'Schema Fixed and Unlocked' as status;
