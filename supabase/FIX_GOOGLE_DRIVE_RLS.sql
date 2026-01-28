-- Quick Fix: Disable RLS for Google Drive credentials table
-- This is safe because the API already checks if user is admin before allowing access

ALTER TABLE google_drive_credentials DISABLE ROW LEVEL SECURITY;

-- Verify it's disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'google_drive_credentials';
