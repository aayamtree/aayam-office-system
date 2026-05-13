-- Create table to store organization-wide Google OAuth tokens
-- Only admin's Google account credentials will be stored here

CREATE TABLE IF NOT EXISTS google_drive_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMPTZ NOT NULL,
    
    -- Which scopes were granted
    scopes TEXT NOT NULL,
    
    -- Who connected (should be admin)
    connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Status tracking
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one active connection at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_drive_active 
ON google_drive_credentials(is_active) 
WHERE is_active = true;

-- RLS Policies
ALTER TABLE google_drive_credentials ENABLE ROW LEVEL SECURITY;

-- Admin can read/write
CREATE POLICY "Admins can manage Google Drive credentials"
ON google_drive_credentials
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- All authenticated users can read (to use for uploads)
CREATE POLICY "All users can read active Google Drive credentials"
ON google_drive_credentials
FOR SELECT
TO authenticated
USING (is_active = true);

COMMENT ON TABLE google_drive_credentials IS 'Stores organization-wide Google Drive OAuth credentials for centralized file uploads';
