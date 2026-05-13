-- =====================================================
-- STEP 4: Add Row Level Security Policies
-- Run AFTER Step 3 completes successfully
-- =====================================================

-- Enable RLS on activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS admin_view_all_activity ON activity_logs;
DROP POLICY IF EXISTS user_view_own_activity ON activity_logs;
DROP POLICY IF EXISTS system_insert_activity ON activity_logs;

-- Policy: Admins can see all activity logs
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

-- Policy: Users can see their own activity
CREATE POLICY user_view_own_activity ON activity_logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: System can insert activity logs
CREATE POLICY system_insert_activity ON activity_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =====================================================
-- VERIFY STEP 4 COMPLETED
-- =====================================================

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'activity_logs';

-- Expected: activity_logs | t (true)

-- Check policies exist
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'activity_logs';

-- Expected: 3 rows (our 3 policies)

-- =====================================================
-- SUCCESS!
-- If RLS is enabled and 3 policies exist, Step 4 is complete.
-- Now go to STEP_5_CREATE_HELPER_FUNCTIONS.sql
-- =====================================================
