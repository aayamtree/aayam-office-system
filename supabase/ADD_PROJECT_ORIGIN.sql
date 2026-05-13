-- =============================================
-- ADD PROJECT ORIGIN & PARENT JOB LINKING
-- =============================================
-- Run this in Supabase SQL Editor
-- Adds support for designer-created projects with admin approval gate

-- 1. Parent job linking (for add-on projects)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES jobs(id);

-- 2. Track who created this job (admin/marketing/designer)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_origin TEXT DEFAULT 'admin';

-- 3. Ensure product_category column exists
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS product_category TEXT;

-- Verify
SELECT 'Migration complete: parent_job_id, project_origin, product_category columns added' AS status;
