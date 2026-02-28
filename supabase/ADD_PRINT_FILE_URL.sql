-- ═══════════════════════════════════════════════════
-- ADD print_files JSONB to jobs table (supports multiple print files)
-- Run in: Supabase → SQL Editor → Paste & Run
-- Safe to run multiple times (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════

-- Add print_files as JSONB array (each entry: {name, url, size, type, uploaded_at, uploaded_by})
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS print_files JSONB DEFAULT '[]'::jsonb;

-- Verify
SELECT id, job_number, project_name, print_files
FROM jobs
WHERE print_files IS NOT NULL AND print_files != '[]'::jsonb
ORDER BY updated_at DESC
LIMIT 10;
