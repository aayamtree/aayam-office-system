-- =====================================================
-- STEP 5: Create Helper Functions (FINAL STEP)
-- Run AFTER Step 4 completes successfully
-- =====================================================

-- Drop existing functions if they exist (to avoid conflicts)
DROP FUNCTION IF EXISTS has_role(user_role);
DROP FUNCTION IF EXISTS has_any_role(user_role[]);
DROP FUNCTION IF EXISTS get_user_role();

-- Function 1: Check if user has specific role
CREATE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id::uuid = auth.uid()
        AND role::user_role = required_role
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Check if user has any of the specified roles
CREATE FUNCTION has_any_role(required_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id::uuid = auth.uid()
        AND role::user_role = ANY(required_roles)
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Get current user's role
CREATE FUNCTION get_user_role()
RETURNS user_role AS $$
DECLARE
    user_role_value user_role;
BEGIN
    SELECT role INTO user_role_value 
    FROM profiles 
    WHERE id::uuid = auth.uid();
    RETURN user_role_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFY STEP 5 COMPLETED (FINAL CHECK)
-- =====================================================

-- Check all functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('has_role', 'has_any_role', 'get_user_role');

-- Expected: 3 rows

-- Test functions (won't return meaningful data yet, but shouldn't error)
SELECT 
    has_role('admin') AS test1,
    has_any_role(ARRAY['admin', 'designer']::user_role[]) AS test2;

-- Expected: Should run without errors (returns false values)

-- =====================================================
-- 🎉 ALL STEPS COMPLETE!
-- =====================================================
-- ✅ Step 1: Basic columns added to profiles
-- ✅ Step 2: User role enum created
-- ✅ Step 3: Activity logs table created
-- ✅ Step 4: RLS policies added
-- ✅ Step 5: Helper functions created
--
-- FINAL VERIFICATION - Check everything together:
-- =====================================================

SELECT 
    'profiles columns' AS check_item,
    COUNT(*) AS count
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('username', 'role', 'is_active', 'last_login_at')

UNION ALL

SELECT 
    'user_role enum values',
    COUNT(*)
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role'

UNION ALL

SELECT 
    'activity_logs columns',
    COUNT(*)
FROM information_schema.columns
WHERE table_name = 'activity_logs'

UNION ALL

SELECT 
    'activity_logs policies',
    COUNT(*)
FROM pg_policies
WHERE tablename = 'activity_logs'

UNION ALL

SELECT 
    'helper functions',
    COUNT(*)
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('has_role', 'has_any_role', 'get_user_role');

-- Expected output:
-- profiles columns      | 4
-- user_role enum values | 6
-- activity_logs columns | 9
-- activity_logs policies| 3
-- helper functions      | 3

-- If all counts match, SCHEMA IS READY!
-- Next: Create users in Supabase Auth
-- =====================================================
