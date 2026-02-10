-- ============================================
-- FIX RLS FOR ALL QUICK ADD TABLES
-- ============================================
-- Run this in Supabase SQL Editor to fix ALL 
-- Quick Add modal 400 errors.
-- ============================================

-- =====================
-- PART 1: CONFIG TABLES (disable RLS — low-risk admin data)
-- =====================
ALTER TABLE job_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE priorities DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_categories DISABLE ROW LEVEL SECURITY;

-- Grant full access
GRANT ALL ON job_types TO authenticated;
GRANT ALL ON job_stages TO authenticated;
GRANT ALL ON product_categories TO authenticated;
GRANT ALL ON product_types TO authenticated;
GRANT ALL ON priorities TO authenticated;
GRANT ALL ON vendor_categories TO authenticated;

-- =====================
-- PART 2: DATA TABLES (keep RLS but allow all authenticated users)
-- =====================

-- CLIENTS table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_delete" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to view clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to insert clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to update clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to delete clients" ON clients;

CREATE POLICY "clients_all" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VENDORS table
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "vendors_insert" ON vendors;
DROP POLICY IF EXISTS "vendors_update" ON vendors;
DROP POLICY IF EXISTS "vendors_delete" ON vendors;
DROP POLICY IF EXISTS "Allow authenticated users to view vendors" ON vendors;
DROP POLICY IF EXISTS "Allow authenticated users to insert vendors" ON vendors;
DROP POLICY IF EXISTS "Allow authenticated users to update vendors" ON vendors;
DROP POLICY IF EXISTS "Allow authenticated users to delete vendors" ON vendors;

CREATE POLICY "vendors_all" ON vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================
-- PART 3: Cleanup any restrictive policies on config tables
-- =====================
DO $$
DECLARE
    tbl TEXT;
    pol RECORD;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'job_types', 'job_stages', 'product_categories',
        'product_types', 'priorities', 'vendor_categories'
    ])
    LOOP
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
        END LOOP;
    END LOOP;
END $$;

-- =====================
-- DONE
-- =====================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PART 1: Config tables — RLS OFF';
    RAISE NOTICE '   job_types, job_stages, product_categories,';
    RAISE NOTICE '   product_types, priorities, vendor_categories';
    RAISE NOTICE '';
    RAISE NOTICE '✅ PART 2: Data tables — open policies';
    RAISE NOTICE '   clients: authenticated can do ALL';
    RAISE NOTICE '   vendors: authenticated can do ALL';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 All Quick Add modals should work now!';
    RAISE NOTICE '========================================';
END $$;
