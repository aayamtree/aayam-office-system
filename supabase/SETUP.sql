-- =============================================
-- AAYAM OFFICE - FRESH DATABASE SETUP
-- Run this ONCE in Supabase SQL Editor
-- =============================================

-- 1. PROFILES (for login users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'Gujarat',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VENDORS
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'Gujarat',
  category TEXT DEFAULT 'Paper',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DESIGNERS
CREATE TABLE IF NOT EXISTS designers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  skills TEXT[],
  employment_type TEXT DEFAULT 'full-time',
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  monthly_salary DECIMAL(12,2) DEFAULT 0,
  joining_date DATE,
  city TEXT,
  state TEXT DEFAULT 'Gujarat',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. JOBS
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES designers(id) ON DELETE SET NULL,
  job_type TEXT DEFAULT 'Design + Print',
  quantity INTEGER DEFAULT 1,
  quote_per_piece DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(4,2) DEFAULT 18,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  amount_received DECIMAL(12,2) DEFAULT 0,
  client_deadline DATE,
  current_stage TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  files JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  subtotal DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(4,2) DEFAULT 18,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DISABLE ROW LEVEL SECURITY (Important!)
-- =============================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE designers DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- =============================================
-- DONE! Now create a user in Authentication
-- =============================================
