-- Add drive_link column to jobs table for storing Google Drive links
-- This allows users to attach design files/assets to jobs

-- Step 1: Add the column
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS drive_link TEXT;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN jobs.drive_link IS 'Google Drive link or URL to design assets/files for this job';

-- Done! Now jobs can have attached drive links
