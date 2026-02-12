-- =====================================================
-- FIX: Remove conflicting JOB- number trigger
-- =====================================================
-- The system has TWO job number generators:
--   1. get_next_number('job') RPC → AAY-YY-XXXX (CORRECT - used by app code)
--   2. trigger_set_job_number → JOB-YYYYMMDD-XXXX (CONFLICTING - from FIX_DESIGN_STUDIO_COMPLETE.sql)
--
-- This script removes the conflicting trigger and function,
-- keeping only the AAY-YY-XXXX format as the single source of truth.
-- =====================================================

-- 1. Drop the conflicting trigger
DROP TRIGGER IF EXISTS trigger_set_job_number ON jobs;

-- 2. Drop the conflicting functions
DROP FUNCTION IF EXISTS set_job_number();
DROP FUNCTION IF EXISTS generate_job_number();

-- 3. Drop the unused sequence
DROP SEQUENCE IF EXISTS job_number_seq;

-- 4. (Optional) Update existing JOB- format numbers to AAY- format
-- Uncomment and run if you want to fix existing records:
-- UPDATE jobs 
-- SET job_number = 'AAY-' || to_char(created_at, 'YY') || '-' || LPAD(
--   (ROW_NUMBER() OVER (ORDER BY created_at))::TEXT + 
--   COALESCE((SELECT current_number FROM counters WHERE prefix = 'AAY'), 0), 4, '0')
-- WHERE job_number LIKE 'JOB-%';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After running, verify no conflicting triggers remain:
-- SELECT tgname, tgrelid::regclass 
-- FROM pg_trigger 
-- WHERE tgrelid = 'jobs'::regclass AND tgname LIKE '%job_number%';
--
-- Should return: 0 rows
-- =====================================================
