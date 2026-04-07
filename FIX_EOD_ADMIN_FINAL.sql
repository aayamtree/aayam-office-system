-- ============================================================
-- FINAL FIX: Admin cannot see EOD reports
-- Root cause: Original policies check JWT metadata (raw_user_meta_data->>'role')
-- but this app stores roles in the profiles table — they are SEPARATE.
--
-- Solution: Create a SECURITY DEFINER function that checks profiles.role
-- SECURITY DEFINER bypasses RLS on profiles table, so the role check
-- always works correctly regardless of profiles RLS policies.
--
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: Create a reusable is_admin() helper function
-- SECURITY DEFINER = runs as the table owner, bypasses RLS on profiles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- STEP 2: Fix SELECT policy on daily_work_reports
-- Drop all existing admin SELECT policies (both old and new)
DROP POLICY IF EXISTS "Admins can view all reports" ON daily_work_reports;
DROP POLICY IF EXISTS "Admins can read all reports" ON daily_work_reports;

-- Recreate using is_admin() function
CREATE POLICY "Admins can view all reports"
  ON daily_work_reports FOR SELECT
  USING (is_admin());

-- STEP 3: Fix UPDATE policy on daily_work_reports (for admin ratings)
DROP POLICY IF EXISTS "Admins can update any report for rating" ON daily_work_reports;

CREATE POLICY "Admins can update any report for rating"
  ON daily_work_reports FOR UPDATE
  USING (is_admin());

-- STEP 4: Fix SELECT policy on report_task_updates
-- Drop all existing admin SELECT policies
DROP POLICY IF EXISTS "Admins can view all task updates" ON report_task_updates;
DROP POLICY IF EXISTS "Admins can read all report task updates" ON report_task_updates;

-- Recreate using is_admin() function
CREATE POLICY "Admins can view all task updates"
  ON report_task_updates FOR SELECT
  USING (is_admin());

-- STEP 5: Verify the fix — this should return rows for admin users
-- (Run this separately after applying the policies above)
-- SELECT COUNT(*) FROM daily_work_reports;

DO $$
BEGIN
  RAISE NOTICE '✅ EOD Admin RLS FINAL FIX applied!';
  RAISE NOTICE '   Created is_admin() SECURITY DEFINER function';
  RAISE NOTICE '   Fixed SELECT policy on daily_work_reports';
  RAISE NOTICE '   Fixed UPDATE policy on daily_work_reports (ratings)';
  RAISE NOTICE '   Fixed SELECT policy on report_task_updates';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 WHY THIS WORKS:';
  RAISE NOTICE '   Old policy checked: raw_user_meta_data→role (JWT metadata)';
  RAISE NOTICE '   New policy checks: profiles.role via SECURITY DEFINER function';
  RAISE NOTICE '   SECURITY DEFINER bypasses profiles RLS, so role check always works';
END $$;
