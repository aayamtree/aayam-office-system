-- ============================================================
-- WORK LOGS — Auto-captured activity for smart EOD
-- No new table needed beyond this. Ultra-light.
-- Run once in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  log_type TEXT NOT NULL CHECK (log_type IN (
    'task_started', 'task_completed', 'task_updated',
    'file_uploaded', 'stage_changed', 'note_added', 'manual'
  )),
  description TEXT NOT NULL,         -- Human-readable log entry
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  task_id UUID,                      -- Optional task reference
  metadata JSONB DEFAULT '{}',       -- Extra context (stage name, file name, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast EOD queries
CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_work_logs_created ON work_logs(created_at DESC);

-- RLS
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- Users see their own logs; admin sees all
CREATE POLICY "Users see own work logs" ON work_logs
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users insert own work logs" ON work_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own work logs" ON work_logs
  FOR DELETE USING (user_id = auth.uid());

DO $$
BEGIN
  RAISE NOTICE 'work_logs table created successfully!';
  RAISE NOTICE 'Auto-logs will now capture designer activity throughout the day.';
END $$;
