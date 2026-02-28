-- ═══════════════════════════════════════════════════
-- ADD print_file_url to jobs table
-- Run in: Supabase → SQL Editor → Paste & Run
-- Safe to run multiple times (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════

-- Add the print file URL column
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS print_file_url TEXT;

-- Add index for fast lookups (e.g. "find all jobs with print file ready")
CREATE INDEX IF NOT EXISTS idx_jobs_print_file_url ON jobs(print_file_url) WHERE print_file_url IS NOT NULL;

-- Verify
SELECT id, job_number, project_name, print_file_url
FROM jobs
WHERE print_file_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
