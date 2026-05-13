-- ============================================================
-- ADD designer_status TO jobs TABLE
-- Single source of truth for designer work status
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add designer_status column to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS designer_status TEXT
  CHECK (designer_status IN ('live', 'hold', 'review', 'end', 'transfer'));

-- 2. Verify
SELECT id, project_name, current_stage, designer_status
FROM jobs
ORDER BY created_at DESC
LIMIT 10;
