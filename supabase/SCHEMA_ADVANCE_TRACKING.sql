-- =============================================
-- ADVANCE PAYMENT TRACKING
-- Adds advance tracking fields to jobs table
-- Run in Supabase SQL Editor
-- =============================================

-- Add advance tracking columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS advance_required boolean DEFAULT true;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS advance_collected boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS advance_amount numeric DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN jobs.advance_required IS 'Whether this job requires advance payment (typically 50%)';
COMMENT ON COLUMN jobs.advance_collected IS 'Whether the advance payment has been collected';
COMMENT ON COLUMN jobs.advance_amount IS 'Amount of advance collected';
