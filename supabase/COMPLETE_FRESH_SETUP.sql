-- ==============================================================================
-- AAYAM OFFICE SYSTEM - COMPLETE FRESH SETUP (v2)
-- Includes CRM, JOBS, FINANCE, NOTES, REMINDERS
-- Run this in Supabase SQL Editor to RESET and REBUILD the database correctly.
-- WARNING: THIS WILL DELETE ALL EXISTING DATA!
-- ==============================================================================

-- 1. CLEAN SLATE (Drop existing tables)
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS designers CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. CREATE TABLES

-- PROFILES (For Auth Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'staff',
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- CLIENTS
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'Gujarat',
  is_active BOOLEAN DEFAULT true,
  client_type TEXT DEFAULT 'regular',
  credit_limit NUMERIC DEFAULT 0,
  outstanding_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENDORS
CREATE TABLE vendors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'Gujarat',
  category TEXT DEFAULT 'Paper',
  payment_terms TEXT DEFAULT '',
  outstanding_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DESIGNERS
CREATE TABLE designers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  active_jobs INTEGER DEFAULT 0,
  specialization TEXT[],
  outstanding_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- JOBS (Main Work Orders)
CREATE TABLE jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_no SERIAL,
  title TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES designers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  files TEXT[],
  description TEXT,
  amount NUMERIC DEFAULT 0,
  advance NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  delivery_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INVOICES
CREATE TABLE invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_no TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  job_ids UUID[],
  amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'draft',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXPENSES (New Module Support)
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTES (Built-in "Google Keep" style)
CREATE TABLE notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  color TEXT DEFAULT 'yellow', -- yellow, green, blue, pink, purple
  is_pinned BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id), -- Personal notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REMINDERS (For Calendar Integration)
CREATE TABLE reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SECURITY SETTINGS (Disable RLS for ease of use)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE designers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Allow ALL access (Admin Tool Mode)
CREATE POLICY "Allow all access" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all access" ON clients FOR ALL USING (true);
CREATE POLICY "Allow all access" ON vendors FOR ALL USING (true);
CREATE POLICY "Allow all access" ON designers FOR ALL USING (true);
CREATE POLICY "Allow all access" ON jobs FOR ALL USING (true);
CREATE POLICY "Allow all access" ON invoices FOR ALL USING (true);
CREATE POLICY "Allow all access" ON expenses FOR ALL USING (true);
CREATE POLICY "Allow all access" ON notes FOR ALL USING (true);
CREATE POLICY "Allow all access" ON reminders FOR ALL USING (true);


-- 5. TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- CONFIRMATION
SELECT 'Complete Database + Notes + Reminders Setup Success!' as status;
