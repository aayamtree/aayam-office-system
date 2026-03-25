-- =====================================================
-- FIX: Jobs table RLS policies
--
-- Problem: Admin (and all authenticated users) cannot read jobs
-- client-side because the jobs table lacks RLS SELECT policies.
-- The dashboard works because it uses the service_role key
-- (server-side, bypasses RLS). Client-side queries are blocked.
--
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard → SQL Editor → New Query
-- =====================================================

-- Step 1: Ensure RLS is enabled
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing conflicting policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON jobs;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON jobs;
DROP POLICY IF EXISTS "Authenticated can read jobs" ON jobs;
DROP POLICY IF EXISTS "Staff can read jobs" ON jobs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON jobs;

-- Step 3: CREATE PERMISSIVE POLICIES
-- All authenticated (logged-in) staff can read all jobs
CREATE POLICY "Authenticated users can read jobs"
ON jobs FOR SELECT
TO authenticated
USING (true);

-- All authenticated staff can insert new jobs
CREATE POLICY "Authenticated users can insert jobs"
ON jobs FOR INSERT
TO authenticated
WITH CHECK (true);

-- All authenticated staff can update jobs
CREATE POLICY "Authenticated users can update jobs"
ON jobs FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only admins/finance can delete jobs (extra safety)
CREATE POLICY "Admin and finance can delete jobs"
ON jobs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'finance', 'account')
    AND profiles.is_active = true
  )
);

-- =====================================================
-- Also fix related tables that may have the same issue
-- =====================================================

-- CLIENTS table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read clients" ON clients;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON clients;
CREATE POLICY "Authenticated users can read clients"
ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients"
ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients"
ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- VENDORS table
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read vendors" ON vendors;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON vendors;
CREATE POLICY "Authenticated users can read vendors"
ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert vendors"
ON vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update vendors"
ON vendors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- LEADS table (might also be affected)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read leads" ON leads;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON leads;
CREATE POLICY "Authenticated users can read leads"
ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads"
ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads"
ON leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- INVOICES table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON invoices;
CREATE POLICY "Authenticated users can read invoices"
ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoices"
ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoices"
ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- Verification: After running, check policies exist
-- =====================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('jobs', 'clients', 'vendors', 'leads', 'invoices')
ORDER BY tablename, cmd;
