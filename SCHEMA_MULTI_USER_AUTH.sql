-- =====================================================
-- MULTI-USER AUTHENTICATION SYSTEM
-- Complete schema for role-based access control
-- =====================================================

-- =====================================================
-- PART 1: User Roles & Permissions
-- =====================================================

-- Create user role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'admin',
        'account',
        'designer',
        'marketing',
        'dispatch',
        'cmyk'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update profiles table with role fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'designer';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.username IS 'Unique username for login (e.g., designer1, admin1)';
COMMENT ON COLUMN profiles.role IS 'User role: admin, account, designer, marketing, dispatch, cmyk';
COMMENT ON COLUMN profiles.is_active IS 'Whether user account is active';
COMMENT ON COLUMN profiles.last_login_at IS 'Last login timestamp';
COMMENT ON COLUMN profiles.force_password_change IS 'Force password change on next login';

-- Create unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- =====================================================
-- PART 2: Activity Logging
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE activity_logs IS 'Tracks all user activities for audit trail';
COMMENT ON COLUMN activity_logs.action IS 'Action performed: login, logout, create, update, delete, view';
COMMENT ON COLUMN activity_logs.resource_type IS 'Type of resource: job, invoice, client, etc.';
COMMENT ON COLUMN activity_logs.resource_id IS 'ID of the resource affected';
COMMENT ON COLUMN activity_logs.details IS 'Additional details in JSON format';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- =====================================================
-- PART 3: Password Reset Tokens
-- =====================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens';
COMMENT ON COLUMN password_reset_tokens.token IS 'Unique reset token';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration time (24 hours)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'When token was used';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- =====================================================
-- PART 4: Row Level Security Policies
-- =====================================================

-- Enable RLS on activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all activity logs
CREATE POLICY admin_view_all_activity ON activity_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'account')
        )
    );

-- Users can see their own activity
CREATE POLICY user_view_own_activity ON activity_logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- System can insert activity logs
CREATE POLICY system_insert_activity ON activity_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Enable RLS on password_reset_tokens
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view their own reset tokens
CREATE POLICY user_own_reset_tokens ON password_reset_tokens
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- =====================================================
-- PART 5: Helper Functions
-- =====================================================

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = required_role
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION has_any_role(required_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = ANY(required_roles)
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
DECLARE
    user_role_value user_role;
BEGIN
    SELECT role INTO user_role_value FROM profiles WHERE id = auth.uid();
    RETURN user_role_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 6: Update Existing Data
-- =====================================================

-- Set existing users as designers by default
UPDATE profiles
SET role = 'designer'
WHERE role IS NULL;

-- Ensure all users are active by default
UPDATE profiles
SET is_active = true
WHERE is_active IS NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check roles were added to profiles
-- SELECT id, name, email, role, is_active FROM profiles LIMIT 10;

-- Check activity_logs table
-- SELECT * FROM activity_logs LIMIT 10;

-- Check password_reset_tokens table
-- SELECT * FROM password_reset_tokens LIMIT 10;

-- Test role functions
-- SELECT has_role('admin'), get_user_role();

-- =====================================================
-- SUMMARY
-- =====================================================
-- ✅ Created user_role enum (6 roles)
-- ✅ Added role, is_active, last_login_at to profiles
-- ✅ Created activity_logs table with indexes
-- ✅ Created password_reset_tokens table
-- ✅ Set up RLS policies for security
-- ✅ Created helper functions for role checking
-- ✅ Updated existing user data
-- 
-- Ready for user creation and RBAC implementation!
-- =====================================================
