-- ============================================
-- SIMPLE FIX: DISABLE RLS FOR LOOKUP TABLES
-- ============================================
-- Configuration tables don't need row-level security
-- Just disable RLS entirely and grant permissions

-- Disable RLS on configuration tables
ALTER TABLE machines DISABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sizes DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled for actual data tables
ALTER TABLE print_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_run_jobs ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on config tables (cleanup)
DROP POLICY IF EXISTS "machines_select_policy" ON machines;
DROP POLICY IF EXISTS "machines_insert_policy" ON machines;
DROP POLICY IF EXISTS "machines_update_policy" ON machines;
DROP POLICY IF EXISTS "machines_delete_policy" ON machines;
DROP POLICY IF EXISTS "Allow authenticated users to view machines" ON machines;
DROP POLICY IF EXISTS "Allow authenticated users to insert machines" ON machines;
DROP POLICY IF EXISTS "Allow authenticated users to update machines" ON machines;
DROP POLICY IF EXISTS "Allow authenticated users to delete machines" ON machines;

DROP POLICY IF EXISTS "sheet_sizes_select_policy" ON sheet_sizes;
DROP POLICY IF EXISTS "sheet_sizes_insert_policy" ON sheet_sizes;
DROP POLICY IF EXISTS "sheet_sizes_update_policy" ON sheet_sizes;
DROP POLICY IF EXISTS "sheet_sizes_delete_policy" ON sheet_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to view sheet_sizes" ON sheet_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to insert sheet_sizes" ON sheet_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to update sheet_sizes" ON sheet_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to delete sheet_sizes" ON sheet_sizes;

DROP POLICY IF EXISTS "materials_select_policy" ON materials;
DROP POLICY IF EXISTS "materials_insert_policy" ON materials;
DROP POLICY IF EXISTS "materials_update_policy" ON materials;
DROP POLICY IF EXISTS "materials_delete_policy" ON materials;
DROP POLICY IF EXISTS "Allow authenticated users to view materials" ON materials;
DROP POLICY IF EXISTS "Allow authenticated users to insert materials" ON materials;
DROP POLICY IF EXISTS "Allow authenticated users to update materials" ON materials;
DROP POLICY IF EXISTS "Allow authenticated users to delete materials" ON materials;

-- Create simple policies for print_runs and print_run_jobs
DROP POLICY IF EXISTS "print_runs_all" ON print_runs;
CREATE POLICY "print_runs_all" ON print_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "print_run_jobs_all" ON print_run_jobs;
CREATE POLICY "print_run_jobs_all" ON print_run_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant full permissions to authenticated users
GRANT ALL ON machines TO authenticated, anon;
GRANT ALL ON sheet_sizes TO authenticated, anon;
GRANT ALL ON materials TO authenticated, anon;
GRANT ALL ON print_runs TO authenticated;
GRANT ALL ON print_run_jobs TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS DISABLED for lookup tables';
    RAISE NOTICE '   - machines: RLS OFF';
    RAISE NOTICE '   - sheet_sizes: RLS OFF';
    RAISE NOTICE '   - materials: RLS OFF';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Simple policies for data tables';
    RAISE NOTICE '   - print_runs: Allow ALL';
    RAISE NOTICE '   - print_run_jobs: Allow ALL';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Quick-add should work now!';
    RAISE NOTICE '========================================';
END $$;
