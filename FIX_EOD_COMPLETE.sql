-- ============================================================
-- EOD SYSTEM - COMPLETE FIX (Run once in Supabase SQL Editor)
-- Date: April 2026
-- Fixes:
--   1. Admin RLS — admins can now read all EOD reports
--   2. Admin RLS — admins can rate/update reports
--   3. Admin RLS — admins can read all task updates
-- ============================================================

-- ── STEP 1: Create is_admin() helper (checks profiles table, not JWT) ──────────
-- SECURITY DEFINER means it runs as table owner, bypasses profiles RLS
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── STEP 2: Fix SELECT policy on daily_work_reports ───────────────────────────
DROP POLICY IF EXISTS "Admins can view all reports"            ON daily_work_reports;
DROP POLICY IF EXISTS "Admins can read all reports"            ON daily_work_reports;

CREATE POLICY "Admins can view all reports"
  ON daily_work_reports FOR SELECT
  USING (is_admin());

-- ── STEP 3: Fix UPDATE policy on daily_work_reports (for star ratings) ────────
DROP POLICY IF EXISTS "Admins can update any report for rating" ON daily_work_reports;

CREATE POLICY "Admins can update any report for rating"
  ON daily_work_reports FOR UPDATE
  USING (is_admin());

-- ── STEP 4: Fix SELECT policy on report_task_updates ──────────────────────────
DROP POLICY IF EXISTS "Admins can view all task updates"           ON report_task_updates;
DROP POLICY IF EXISTS "Admins can read all report task updates"    ON report_task_updates;

CREATE POLICY "Admins can view all task updates"
  ON report_task_updates FOR SELECT
  USING (is_admin());

-- ── VERIFY: Check which profiles have admin role ──────────────────────────────
-- Run this after applying the above to confirm admin accounts are set correctly.
-- Every name listed here will be able to see all EOD reports in the dashboard.
SELECT full_name, role, email FROM profiles WHERE role = 'admin' ORDER BY full_name;

DO $$
BEGIN
  RAISE NOTICE '✅ EOD Complete Fix applied!';
  RAISE NOTICE '   is_admin() function created (checks profiles.role)';
  RAISE NOTICE '   Admin SELECT policy fixed on daily_work_reports';
  RAISE NOTICE '   Admin UPDATE policy fixed on daily_work_reports';
  RAISE NOTICE '   Admin SELECT policy fixed on report_task_updates';
  RAISE NOTICE '';
  RAISE NOTICE '👉 Next: Check the SELECT query output above.';
  RAISE NOTICE '   If SATISH V / Meet / Eklavya are NOT listed, run:';
  RAISE NOTICE '   UPDATE profiles SET role = ''admin'' WHERE full_name = ''SATISH V'';';
END $$;
