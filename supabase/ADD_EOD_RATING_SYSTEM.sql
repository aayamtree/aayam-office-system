-- ============================================================
-- ADD ADMIN RATING + COMMENT SYSTEM TO EOD REPORTS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add rating columns to daily_work_reports
ALTER TABLE daily_work_reports
  ADD COLUMN IF NOT EXISTS admin_rating INTEGER CHECK (admin_rating >= 1 AND admin_rating <= 5),
  ADD COLUMN IF NOT EXISTS admin_comment TEXT,
  ADD COLUMN IF NOT EXISTS admin_rated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_rated_by UUID REFERENCES auth.users(id);

-- 2. Add task_status column to report_task_updates (was missing)
ALTER TABLE report_task_updates
  ADD COLUMN IF NOT EXISTS task_status TEXT DEFAULT 'START WORK'
    CHECK (task_status IN ('NOT START', 'START WORK', 'COMPLETE'));

-- 3. RLS: Allow admin to UPDATE any report (for rating)
DROP POLICY IF EXISTS "Admins can update any report for rating" ON daily_work_reports;
CREATE POLICY "Admins can update any report for rating"
  ON daily_work_reports FOR UPDATE
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- 4. RLS: Allow users to see their own report's rating
--    (they already have SELECT on own reports via "Users can view own reports")

-- 5. Index for fast rating lookups
CREATE INDEX IF NOT EXISTS idx_daily_reports_rating ON daily_work_reports(admin_rating)
  WHERE admin_rating IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Admin rating columns added to daily_work_reports!';
  RAISE NOTICE '   - admin_rating (1-5 stars)';
  RAISE NOTICE '   - admin_comment (free text)';
  RAISE NOTICE '   - admin_rated_at (timestamp)';
  RAISE NOTICE '   - admin_rated_by (admin user id)';
  RAISE NOTICE '   - task_status added to report_task_updates';
END $$;
