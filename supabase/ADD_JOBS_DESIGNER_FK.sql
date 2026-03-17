-- ============================================================
-- ADD FK CONSTRAINT: jobs.designer_id → profiles.id
-- This fixes the PostgREST join so Queue cards show designer name
-- Run in Supabase SQL Editor AFTER ADD_DESIGNER_STATUS.sql
-- ============================================================

-- 1. Clean up any jobs where designer_id doesn't match any profile
--    (set to NULL so FK doesn't fail on existing bad data)
UPDATE jobs
SET designer_id = NULL
WHERE designer_id IS NOT NULL
  AND designer_id NOT IN (SELECT id FROM profiles);

-- 2. Add the FK constraint
ALTER TABLE jobs
  ADD CONSTRAINT fk_jobs_designer_id
  FOREIGN KEY (designer_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 3. Verify the FK was created
SELECT conname, contype
FROM pg_constraint
WHERE conname = 'fk_jobs_designer_id';

-- 4. Verify Queue join now works (should show designer names)
SELECT j.id, j.project_name, j.designer_id, p.full_name AS designer_name
FROM jobs j
LEFT JOIN profiles p ON j.designer_id = p.id
ORDER BY j.created_at DESC
LIMIT 10;
