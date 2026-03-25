-- Job Subtasks
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS job_subtasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  assigned_to  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','in_progress','review','done')),
  due_date     DATE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by job and assignee
CREATE INDEX IF NOT EXISTS idx_job_subtasks_job_id       ON job_subtasks(job_id);
CREATE INDEX IF NOT EXISTS idx_job_subtasks_assigned_to  ON job_subtasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_subtasks_status       ON job_subtasks(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_job_subtasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_job_subtasks_updated_at ON job_subtasks;
CREATE TRIGGER trg_job_subtasks_updated_at
  BEFORE UPDATE ON job_subtasks
  FOR EACH ROW EXECUTE FUNCTION update_job_subtasks_updated_at();

-- RLS: same pattern as jobs table
ALTER TABLE job_subtasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "subtasks_read" ON job_subtasks
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only staff (non-anon) can insert/update/delete
CREATE POLICY "subtasks_write" ON job_subtasks
  FOR ALL USING (auth.role() = 'authenticated');
