-- =====================================================
-- EOD SNAPSHOT SYSTEM - Phase 3 Schema
-- Purpose: Edit audit log + upsert-safe unique constraint
-- Run this in Supabase SQL Editor ONCE
-- =====================================================

-- ============================
-- STEP 1: Deduplicate report_task_updates
-- Remove any duplicate (report_id, job_id) rows
-- (keeps the most recently created row per pair)
-- ============================
DELETE FROM report_task_updates
WHERE id NOT IN (
  SELECT DISTINCT ON (report_id, job_id) id
  FROM report_task_updates
  ORDER BY report_id, job_id, created_at DESC
);

-- ============================
-- STEP 2: Add unique constraint on (report_id, job_id)
-- Enables UPSERT instead of DELETE+INSERT
-- ============================
ALTER TABLE report_task_updates
  ADD CONSTRAINT IF NOT EXISTS uq_report_task_updates_report_job
  UNIQUE (report_id, job_id);

-- Index for fast lookup by job
CREATE INDEX IF NOT EXISTS idx_task_updates_job_id
  ON report_task_updates(job_id);

-- ============================
-- STEP 3: Create eod_edit_log table
-- Records every past-EOD edit made by users
-- ============================
CREATE TABLE IF NOT EXISTS eod_edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who made the edit
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which report / task the edit is for
  report_id UUID NOT NULL REFERENCES daily_work_reports(id) ON DELETE CASCADE,
  task_update_id UUID REFERENCES report_task_updates(id) ON DELETE SET NULL,

  -- The original date of the EOD being edited
  original_date DATE NOT NULL,

  -- What changed
  field_changed TEXT NOT NULL,  -- 'task_status', 'status_update', 'time_spent', etc.
  old_value TEXT,
  new_value TEXT,

  -- When the edit was made
  edited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Convenience: store designer name so admin can see it without join
  user_name TEXT
);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_eod_edit_log_user ON eod_edit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_eod_edit_log_report ON eod_edit_log(report_id);
CREATE INDEX IF NOT EXISTS idx_eod_edit_log_edited_at ON eod_edit_log(edited_at DESC);

-- ============================
-- STEP 4: RLS for eod_edit_log
-- ============================
ALTER TABLE eod_edit_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own edit log entries
DROP POLICY IF EXISTS "Users can view own edit logs" ON eod_edit_log;
CREATE POLICY "Users can view own edit logs"
  ON eod_edit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own edit log entries
DROP POLICY IF EXISTS "Users can insert own edit logs" ON eod_edit_log;
CREATE POLICY "Users can insert own edit logs"
  ON eod_edit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all edit log entries
DROP POLICY IF EXISTS "Admins can view all edit logs" ON eod_edit_log;
CREATE POLICY "Admins can view all edit logs"
  ON eod_edit_log FOR SELECT
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================
-- STEP 5: Allow users to UPDATE their own past task updates
-- (subject to edit logging via application layer)
-- ============================
DROP POLICY IF EXISTS "Users can update own task updates" ON report_task_updates;
CREATE POLICY "Users can update own task updates"
  ON report_task_updates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM daily_work_reports
      WHERE daily_work_reports.id = report_task_updates.report_id
      AND daily_work_reports.user_id = auth.uid()
    )
  );

-- ============================
-- SUCCESS
-- ============================
DO $$
BEGIN
  RAISE NOTICE '✅ EOD Snapshot Schema Applied!';
  RAISE NOTICE '📋 Unique constraint: report_task_updates(report_id, job_id)';
  RAISE NOTICE '📝 Table created: eod_edit_log';
  RAISE NOTICE '🔒 RLS applied to eod_edit_log';
  RAISE NOTICE '✏️  Users can now update past task updates (with app-layer audit logging)';
END $$;
