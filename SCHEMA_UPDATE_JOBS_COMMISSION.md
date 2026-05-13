-- Add sales_person_id to jobs table to track commissions
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sales_person_id uuid REFERENCES profiles(id);

-- Backfill existing jobs: Assume the creator is the sales person
-- This makes historical data appear in commissions page immediately
UPDATE jobs 
SET sales_person_id = (created_by::uuid) 
WHERE sales_person_id IS NULL 
  AND created_by IS NOT NULL 
  AND created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; -- Regex ensures valid UUID
