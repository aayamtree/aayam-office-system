-- ==================================================================
-- COMPLETE PRINT PLANNER TABLES SETUP
-- ==================================================================
-- Run this ENTIRE script to create tables and set up RLS properly

-- ==================================================================
-- 1. CREATE TABLES (IF NOT EXISTS)
-- ==================================================================

CREATE TABLE IF NOT EXISTS machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sheet_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================================
-- 2. DISABLE RLS (to clean slate)
-- ==================================================================

ALTER TABLE machines DISABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sizes DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE print_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE print_run_jobs DISABLE ROW LEVEL SECURITY;

-- ==================================================================
-- 3. DROP ALL EXISTING POLICIES
-- ==================================================================

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('machines', 'sheet_sizes', 'materials', 'print_runs', 'print_run_jobs')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ==================================================================
-- 4. RE-ENABLE RLS
-- ==================================================================

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_run_jobs ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- 5. CREATE PERMISSIVE POLICIES (ALLOW ALL FOR AUTHENTICATED)
-- ==================================================================

-- MACHINES
CREATE POLICY "machines_select_policy" ON machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "machines_insert_policy" ON machines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "machines_update_policy" ON machines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_delete_policy" ON machines FOR DELETE TO authenticated USING (true);

-- SHEET_SIZES
CREATE POLICY "sheet_sizes_select_policy" ON sheet_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "sheet_sizes_insert_policy" ON sheet_sizes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sheet_sizes_update_policy" ON sheet_sizes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sheet_sizes_delete_policy" ON sheet_sizes FOR DELETE TO authenticated USING (true);

-- MATERIALS
CREATE POLICY "materials_select_policy" ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "materials_insert_policy" ON materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "materials_update_policy" ON materials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "materials_delete_policy" ON materials FOR DELETE TO authenticated USING (true);

-- PRINT_RUNS
CREATE POLICY "print_runs_select_policy" ON print_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "print_runs_insert_policy" ON print_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "print_runs_update_policy" ON print_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "print_runs_delete_policy" ON print_runs FOR DELETE TO authenticated USING (true);

-- PRINT_RUN_JOBS
CREATE POLICY "print_run_jobs_select_policy" ON print_run_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "print_run_jobs_insert_policy" ON print_run_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "print_run_jobs_update_policy" ON print_run_jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "print_run_jobs_delete_policy" ON print_run_jobs FOR DELETE TO authenticated USING (true);

-- ==================================================================
-- 6. GRANT TABLE PERMISSIONS
-- ==================================================================

GRANT ALL ON machines TO authenticated;
GRANT ALL ON sheet_sizes TO authenticated;
GRANT ALL ON materials TO authenticated;
GRANT ALL ON print_runs TO authenticated;
GRANT ALL ON print_run_jobs TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ==================================================================
-- 7. VERIFICATION
-- ==================================================================

DO $$
DECLARE
    machine_policies INT;
    sheet_policies INT;
    material_policies INT;
BEGIN
    SELECT COUNT(*) INTO machine_policies FROM pg_policies WHERE tablename = 'machines';
    SELECT COUNT(*) INTO sheet_policies FROM pg_policies WHERE tablename = 'sheet_sizes';
    SELECT COUNT(*) INTO material_policies FROM pg_policies WHERE tablename = 'materials';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Machines policies: %', machine_policies;
    RAISE NOTICE 'Sheet sizes policies: %', sheet_policies;
    RAISE NOTICE 'Materials policies: %', material_policies;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS is ENABLED but PERMISSIVE';
    RAISE NOTICE 'All authenticated users can INSERT';
    RAISE NOTICE '========================================';
END $$;
