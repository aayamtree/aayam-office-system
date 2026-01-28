-- Simple fix: Make refresh_token optional
-- We can work with just access_token for now

ALTER TABLE google_drive_credentials 
ALTER COLUMN refresh_token DROP NOT NULL;

-- Verify the change
\d google_drive_credentials;
