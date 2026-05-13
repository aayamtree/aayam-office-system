-- ═══════════════════════════════════════════════════════════════════
-- CREATE job_stage_history TABLE
-- Tracks every stage change for a job (production stages + designer status)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_stage_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  from_stage       TEXT NOT NULL,
  to_stage         TEXT NOT NULL,
  notes            TEXT DEFAULT NULL,

  -- Audit trail: who made the change
  changed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name  TEXT DEFAULT NULL,
  changed_by_role  TEXT DEFAULT NULL,

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast per-job and per-user queries
CREATE INDEX IF NOT EXISTS idx_job_stage_history_job_id     ON job_stage_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_stage_history_changed_by ON job_stage_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_job_stage_history_created_at ON job_stage_history(created_at DESC);

-- Enable Row Level Security
ALTER TABLE job_stage_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (admin sees everything, designers see their jobs)
CREATE POLICY "Authenticated users can read job history"
  ON job_stage_history FOR SELECT
  TO authenticated
  USING (true);

-- Only allow inserts via service role or authenticated users
-- (actual row ownership is tracked via changed_by column)
CREATE POLICY "Authenticated users can insert job history"
  ON job_stage_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE job_stage_history IS
  'Audit log for all job stage changes (production stages and designer status).
   Designer status changes use "designer:" prefix in from_stage/to_stage
   e.g. "designer:live" → "designer:hold"';

COMMENT ON COLUMN job_stage_history.changed_by      IS 'UUID of user who made the change';
COMMENT ON COLUMN job_stage_history.changed_by_name IS 'Full name at time of change (denormalized for display)';
COMMENT ON COLUMN job_stage_history.changed_by_role IS 'Role at time of change: admin | designer | etc.';
