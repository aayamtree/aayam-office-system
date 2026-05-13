-- ============================================================
-- FIX: Admin cannot see designer EOD reports
-- Problem: No SELECT policy exists for admins on daily_work_reports
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Allow admins to READ all EOD reports
DROP POLICY IF EXISTS "Admins can read all reports" ON daily_work_reports;
CREATE POLICY "Admins can read all reports"
  ON daily_work_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 2. Allow admins to READ all report task updates
DROP POLICY IF EXISTS "Admins can read all report task updates" ON report_task_updates;
CREATE POLICY "Admins can read all report task updates"
  ON report_task_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 3. Allow users to read their OWN report task updates (if not already exists)
DROP POLICY IF EXISTS "Users can read own report task updates" ON report_task_updates;
CREATE POLICY "Users can read own report task updates"
  ON report_task_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM daily_work_reports
      WHERE daily_work_reports.id = report_task_updates.report_id
      AND daily_work_reports.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✅ EOD Admin RLS fixed!';
  RAISE NOTICE '   Admins can now read all daily_work_reports';
  RAISE NOTICE '   Admins can now read all report_task_updates';
END $$;
