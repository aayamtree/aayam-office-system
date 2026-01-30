-- ============================================
-- PRINT PLANNER RLS POLICIES FIX
-- ============================================
-- This script enables RLS policies for all print planner tables
-- Allows authenticated users to perform CRUD operations

-- ============================================
-- 1. MACHINES TABLE
-- ============================================

-- Enable RLS
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to view machines" ON machines;
DROP POLICY IF EXISTS "Allow authenticated users to insert machines" ON machines;
DROP POLICY IF EXISTS "Allow authenticated users to update machines" ON machines;
DROP POLICY IF EXISTS "Allow authenticated users to delete machines" ON machines;

-- Create new policies
CREATE POLICY "Allow authenticated users to view machines"
  ON machines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update machines"
  ON machines FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete machines"
  ON machines FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 2. SHEET_SIZES TABLE
-- ============================================

-- Enable RLS
ALTER TABLE sheet_sizes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to view sheet_sizes" ON sheet_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to insert sheet_sizes" ON sheet_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to update sheet_sizes" ON sheet_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to delete sheet_sizes" ON sheet_sizes;

-- Create new policies
CREATE POLICY "Allow authenticated users to view sheet_sizes"
  ON sheet_sizes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert sheet_sizes"
  ON sheet_sizes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update sheet_sizes"
  ON sheet_sizes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete sheet_sizes"
  ON sheet_sizes FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 3. MATERIALS TABLE
-- ============================================

-- Enable RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to view materials" ON materials;
DROP POLICY IF EXISTS "Allow authenticated users to insert materials" ON materials;
DROP POLICY IF EXISTS "Allow authenticated users to update materials" ON materials;
DROP POLICY IF EXISTS "Allow authenticated users to delete materials" ON materials;

-- Create new policies
CREATE POLICY "Allow authenticated users to view materials"
  ON materials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert materials"
  ON materials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update materials"
  ON materials FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete materials"
  ON materials FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 4. PRINT_RUNS TABLE
-- ============================================

-- Enable RLS
ALTER TABLE print_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to view print_runs" ON print_runs;
DROP POLICY IF EXISTS "Allow authenticated users to insert print_runs" ON print_runs;
DROP POLICY IF EXISTS "Allow authenticated users to update print_runs" ON print_runs;
DROP POLICY IF EXISTS "Allow authenticated users to delete print_runs" ON print_runs;

-- Create new policies
CREATE POLICY "Allow authenticated users to view print_runs"
  ON print_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert print_runs"
  ON print_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update print_runs"
  ON print_runs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete print_runs"
  ON print_runs FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 5. PRINT_RUN_JOBS TABLE
-- ============================================

-- Enable RLS
ALTER TABLE print_run_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to view print_run_jobs" ON print_run_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to insert print_run_jobs" ON print_run_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to update print_run_jobs" ON print_run_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to delete print_run_jobs" ON print_run_jobs;

-- Create new policies
CREATE POLICY "Allow authenticated users to view print_run_jobs"
  ON print_run_jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert print_run_jobs"
  ON print_run_jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update print_run_jobs"
  ON print_run_jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete print_run_jobs"
  ON print_run_jobs FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify policies are created

-- Check machines policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'machines';

-- Check sheet_sizes policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'sheet_sizes';

-- Check materials policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'materials';

-- Check print_runs policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'print_runs';

-- Check print_run_jobs policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'print_run_jobs';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Ensure authenticated users have table-level permissions

GRANT SELECT, INSERT, UPDATE, DELETE ON machines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sheet_sizes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON print_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON print_run_jobs TO authenticated;

-- Grant usage on sequences if they exist
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies successfully created for all print planner tables';
  RAISE NOTICE '✅ Tables covered: machines, sheet_sizes, materials, print_runs, print_run_jobs';
  RAISE NOTICE '✅ Authenticated users can now: SELECT, INSERT, UPDATE, DELETE';
END $$;
