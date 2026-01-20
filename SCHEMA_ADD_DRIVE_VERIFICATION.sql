-- =====================================================
-- Google Drive Integration: Database Schema Updates
-- =====================================================
-- Adds columns to track Drive file verification status
-- =====================================================

-- Add Drive file tracking columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS drive_file_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS drive_file_verified_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS drive_file_status TEXT DEFAULT 'pending';

-- Add comments for documentation
COMMENT ON COLUMN jobs.drive_file_id IS 'Google Drive file ID extracted from drive_link';
COMMENT ON COLUMN jobs.drive_file_name IS 'Name of the file on Google Drive';
COMMENT ON COLUMN jobs.drive_file_verified_at IS 'Last time file was verified to exist';
COMMENT ON COLUMN jobs.drive_file_status IS 'Verification status: verified, error, pending';

-- Create index for faster queries on file status
CREATE INDEX IF NOT EXISTS idx_jobs_drive_file_status ON jobs(drive_file_status);

-- =====================================================
-- Verification
-- =====================================================
-- Check columns were added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'jobs' 
-- AND column_name LIKE 'drive_file%';
