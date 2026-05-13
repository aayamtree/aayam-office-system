-- COMPREHENSIVE FIX: Add ALL Missing Columns for Design Studio
-- Run this in Supabase SQL Editor to fix all Design Studio errors

-- ============================================
-- 1. JOBS TABLE - Missing Columns
-- ============================================

-- Add drive_link column (for Google Drive assets)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS drive_link TEXT;

COMMENT ON COLUMN jobs.drive_link IS 'Google Drive link or URL to design assets/files';

-- Add status column (for job workflow - different from current_stage)
-- This tracks overall job status: active, completed, cancelled, on-hold
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'on-hold'));

COMMENT ON COLUMN jobs.status IS 'Overall job status: active, completed, cancelled, on-hold';

-- ============================================
-- 2. PROFILES TABLE - Missing Columns
-- ============================================

-- Add document_url column (for designer identity documents)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS document_url TEXT;

COMMENT ON COLUMN profiles.document_url IS 'URL to stored identity document (Aadhar, PAN, etc.)';

-- ============================================
-- 3. UPDATE EXISTING RECORDS
-- ============================================

-- Set default status for existing jobs (if NULL)
UPDATE jobs 
SET status = 'active' 
WHERE status IS NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify columns were added:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'jobs' AND column_name IN ('drive_link', 'status');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'document_url';

-- ============================================
-- SUMMARY
-- ============================================
-- Added columns:
-- ✅ jobs.drive_link - For Google Drive links
-- ✅ jobs.status - For overall job status
-- ✅ profiles.document_url - For identity documents
-- 
-- All Design Studio features should now work without column errors!
