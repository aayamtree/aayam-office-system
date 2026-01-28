-- =============================================
-- ADD QUOTATION TRACKING TO FOLLOW-UPS
-- =============================================
-- This migration adds quotation tracking to prevent duplicate quotes
-- from the same follow-up

-- Add quotation_id column to follow_ups table
ALTER TABLE follow_ups 
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_follow_ups_quotation ON follow_ups(quotation_id);

-- Add comment for documentation
COMMENT ON COLUMN follow_ups.quotation_id IS 'Links to quotation created from this follow-up to prevent duplicates';
