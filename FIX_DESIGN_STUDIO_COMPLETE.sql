-- =====================================================
-- COMPREHENSIVE FIX: Design Studio Database Schema
-- =====================================================
-- This script fixes ALL missing columns and creates
-- auto-generation logic for job_number field
-- =====================================================

-- =====================================================
-- PART 1: Add Missing Columns
-- =====================================================

-- Add drive_link column for Google Drive assets
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS drive_link TEXT;

-- Add status column for overall job status
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add document_url to profiles for identity documents
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- =====================================================
-- PART 2: Set Default Values for Required Fields
-- =====================================================

-- Set defaults for numeric fields (prevent NULL errors)
ALTER TABLE jobs ALTER COLUMN quantity SET DEFAULT 1;
ALTER TABLE jobs ALTER COLUMN quote_per_piece SET DEFAULT 0;
ALTER TABLE jobs ALTER COLUMN subtotal SET DEFAULT 0;
ALTER TABLE jobs ALTER COLUMN gst_rate SET DEFAULT 0;
ALTER TABLE jobs ALTER COLUMN gst_amount SET DEFAULT 0;
ALTER TABLE jobs ALTER COLUMN discount_amount SET DEFAULT 0;
ALTER TABLE jobs ALTER COLUMN total_amount SET DEFAULT 0;
ALTER TABLE jobs ALTER COLUMN amount_received SET DEFAULT 0;

-- Set default for payment_status
ALTER TABLE jobs ALTER COLUMN payment_status SET DEFAULT 'pending';

-- =====================================================
-- PART 3: Auto-Generate Job Number
-- =====================================================

-- Create sequence for job numbering
CREATE SEQUENCE IF NOT EXISTS job_number_seq START 1;

-- Create function to generate unique job numbers
-- Format: JOB-YYYYMMDD-XXXX (e.g., JOB-20260120-0001)
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    job_num TEXT;
    date_part TEXT;
BEGIN
    -- Get next number from sequence
    next_num := nextval('job_number_seq');
    
    -- Format: JOB-YYYYMMDD-XXXX
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    job_num := 'JOB-' || date_part || '-' || LPAD(next_num::TEXT, 4, '0');
    
    RETURN job_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-set job_number on insert
CREATE OR REPLACE FUNCTION set_job_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
        NEW.job_number := generate_job_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_set_job_number ON jobs;

-- Create trigger to auto-generate job_number before insert
CREATE TRIGGER trigger_set_job_number
    BEFORE INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_job_number();

-- =====================================================
-- PART 4: Update Existing Records
-- =====================================================

-- Set status for existing jobs (if NULL)
UPDATE jobs 
SET status = 'active' 
WHERE status IS NULL;

-- Set payment_status for existing jobs (if NULL)
UPDATE jobs 
SET payment_status = 'pending' 
WHERE payment_status IS NULL;

-- Set quantity for existing jobs (if NULL or 0)
UPDATE jobs 
SET quantity = 1 
WHERE quantity IS NULL OR quantity = 0;

-- =====================================================
-- PART 5: Verification Queries
-- =====================================================

-- Uncomment these to verify the changes:

-- Check all columns exist with proper defaults
-- SELECT column_name, column_default, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'jobs'
-- AND column_name IN ('job_number', 'quantity', 'total_amount', 'payment_status', 'drive_link', 'status')
-- ORDER BY column_name;

-- Test job_number generator
-- SELECT generate_job_number();
-- SELECT generate_job_number();
-- Should return: JOB-20260120-0001, JOB-20260120-0002

-- =====================================================
-- SUMMARY
-- =====================================================
-- ✅ Added missing columns: drive_link, status, document_url
-- ✅ Set defaults for all required numeric/financial fields
-- ✅ Created auto-generation function for job_number
-- ✅ Updated existing records with proper defaults
-- 
-- Design Studio should now work without ANY column errors!
-- =====================================================
