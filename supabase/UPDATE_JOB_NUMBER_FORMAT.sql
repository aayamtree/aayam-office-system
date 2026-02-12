-- =====================================================
-- UPDATE: Job Number Format to AAY-DDMMXXX
-- =====================================================
-- Changes format from AAY-YY-XXX to AAY-DDMMXXX
-- DD = day, MM = month, XXX = daily sequence (001, 002, etc.)
-- Example: AAY-1202001 (Feb 12, 1st job), AAY-1202002 (Feb 12, 2nd job)
-- =====================================================

-- 1. Drop the old trigger (from FIX_DESIGN_STUDIO)
DROP TRIGGER IF EXISTS trigger_set_job_number ON jobs;
DROP FUNCTION IF EXISTS set_job_number();
DROP FUNCTION IF EXISTS generate_job_number();
DROP SEQUENCE IF EXISTS job_number_seq;

-- 2. Replace get_next_number function with new format
CREATE OR REPLACE FUNCTION get_next_number(counter_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
  prefix_val TEXT;
  date_part TEXT;
  daily_count INTEGER;
  result TEXT;
BEGIN
  -- Determine prefix based on input
  IF counter_id = 'job' THEN
    -- NEW FORMAT: AAY-DDMMXXX
    date_part := to_char(current_date, 'DDMM');
    
    -- Count how many jobs were created today
    SELECT COUNT(*) INTO daily_count
    FROM jobs
    WHERE created_at::date = current_date;
    
    next_val := daily_count + 1;
    
    result := 'AAY-' || date_part || lpad(next_val::text, 3, '0');
    RETURN result;
    
  ELSIF counter_id = 'invoice' THEN prefix_val := 'INV';
  ELSIF counter_id = 'sales_order' THEN prefix_val := 'SO';
  ELSIF counter_id = 'lead' THEN prefix_val := 'LD';
  ELSE prefix_val := 'GEN';
  END IF;

  -- For non-job counters, keep the old sequential logic
  INSERT INTO counters (prefix, current_number, financial_year)
  VALUES (prefix_val, 0, to_char(current_date, 'YY'))
  ON CONFLICT (prefix) DO NOTHING;

  UPDATE counters 
  SET current_number = current_number + 1, updated_at = NOW()
  WHERE prefix = prefix_val
  RETURNING current_number INTO next_val;

  result := prefix_val || '-' || to_char(current_date, 'YY') || '-' || lpad(next_val::text, 3, '0');
  
  RETURN result;
END;
$$;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Test the new format:
-- SELECT get_next_number('job');
-- Should return: AAY-1202001 (if run on Feb 12 with 0 jobs today)
--
-- Check all triggers are gone:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'jobs'::regclass AND tgname LIKE '%job_number%';
-- Should return 0 rows
-- =====================================================
