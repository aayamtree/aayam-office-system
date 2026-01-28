-- Add product_category field to jobs table for checklist matching
-- This separates workflow type (Design+Print) from physical product type (Box, Pouch, etc.)

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS product_category VARCHAR(100);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobs_product_category ON jobs(product_category);

-- Update existing jobs with default value if needed
UPDATE jobs SET product_category = 'Other' WHERE product_category IS NULL;

COMMENT ON COLUMN jobs.product_category IS 'Physical product type for checklist matching (Box, Pouch, Label, Banner, Book, Brochure, Other)';
