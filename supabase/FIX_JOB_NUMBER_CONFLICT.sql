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

-- 4. Rename existing JOB- format records to AAY- format
-- This converts e.g. JOB-20260211-0005 → AAY-26-XXXX using the counter
DO $$
DECLARE
  rec RECORD;
  next_num INTEGER;
  year_val TEXT;
BEGIN
  year_val := to_char(current_date, 'YY');
  
  -- Ensure counter exists
  INSERT INTO counters (prefix, current_number, financial_year)
  VALUES ('AAY', 0, year_val)
  ON CONFLICT (prefix) DO NOTHING;
  
  -- Get current counter value
  SELECT current_number INTO next_num FROM counters WHERE prefix = 'AAY';
  
  FOR rec IN SELECT id FROM jobs WHERE job_number LIKE 'JOB-%' ORDER BY created_at
  LOOP
    next_num := next_num + 1;
    UPDATE jobs SET job_number = 'AAY-' || year_val || '-' || LPAD(next_num::TEXT, 4, '0')
    WHERE id = rec.id;
  END LOOP;
  
  -- Update the counter to the new value
  UPDATE counters SET current_number = next_num, updated_at = NOW() WHERE prefix = 'AAY';
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After running, verify:
-- 1. No conflicting triggers remain:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'jobs'::regclass AND tgname LIKE '%job_number%';
-- Should return: 0 rows
--
-- 2. All jobs now use AAY- format:
-- SELECT job_number FROM jobs ORDER BY created_at;
-- Should all start with AAY-
-- =====================================================
