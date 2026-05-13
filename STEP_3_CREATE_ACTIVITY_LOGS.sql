-- =====================================================
-- STEP 3: Create Activity Logs Table
-- Run AFTER Step 2 completes successfully
-- =====================================================

-- Create activity_logs table (if doesn't exist)
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

-- Add comments
COMMENT ON TABLE activity_logs IS 'Tracks all user activities for audit trail';
COMMENT ON COLUMN activity_logs.action IS 'Action: login, logout, create, update, delete, view';
COMMENT ON COLUMN activity_logs.resource_type IS 'Resource type: job, invoice, client, etc.';

-- Create indexes (if don't exist)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- =====================================================
-- VERIFY STEP 3 COMPLETED
-- =====================================================

-- Check table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'activity_logs'
) AS activity_logs_exists;

-- Expected: true

-- Check columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'activity_logs'
ORDER BY ordinal_position;

-- Expected: 9 rows

-- Check indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'activity_logs';

-- Expected: 4 indexes (primary key + 3 we created)

-- =====================================================
-- SUCCESS!
-- If table exists with 9 columns, Step 3 is complete.
-- Now go to STEP_4_ADD_RLS_POLICIES.sql
-- =====================================================
