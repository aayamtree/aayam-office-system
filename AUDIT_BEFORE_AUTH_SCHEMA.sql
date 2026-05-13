-- =====================================================
-- PRE-DEPLOYMENT SQL AUDIT & TEST
-- Run this BEFORE the main schema to check for issues
-- =====================================================

-- =====================================================
-- PART 1: Check Current Database State
-- =====================================================

-- Check if profiles table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
) AS profiles_table_exists;

-- Check current profiles columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Check if user_role enum already exists
SELECT EXISTS (
    SELECT FROM pg_type 
    WHERE typname = 'user_role'
) AS user_role_enum_exists;

-- =====================================================
-- PART 2: Check for Existing Policies (might conflict)
-- =====================================================

-- List all policies on activity_logs (if table exists)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('activity_logs', 'password_reset_tokens');

-- =====================================================
-- PART 3: Check for Existing Functions
-- =====================================================

-- List functions that might conflict
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('has_role', 'has_any_role', 'get_user_role');

-- =====================================================
-- PART 4: Safe Cleanup (if needed)
-- =====================================================

-- Drop existing policies if they exist (safe to re-create)
DROP POLICY IF EXISTS admin_view_all_activity ON activity_logs;
DROP POLICY IF EXISTS user_view_own_activity ON activity_logs;
DROP POLICY IF EXISTS system_insert_activity ON activity_logs;
DROP POLICY IF EXISTS user_own_reset_tokens ON password_reset_tokens;

-- Drop existing functions (safe to re-create)
DROP FUNCTION IF EXISTS has_role(user_role);
DROP FUNCTION IF EXISTS has_any_role(user_role[]);
DROP FUNCTION IF EXISTS get_user_role();

-- =====================================================
-- PART 5: Verification Queries (Post-Schema)
-- =====================================================
-- Run these AFTER running SCHEMA_MULTI_USER_AUTH.sql

-- Verify user_role enum created
-- SELECT enumlabel 
-- FROM pg_enum e
-- JOIN pg_type t ON e.enumtypid = t.oid
-- WHERE t.typname = 'user_role'
-- ORDER BY enumlabel;

-- Expected output:
-- account
-- admin
-- cmyk
-- designer
-- dispatch
-- marketing

-- Verify profiles columns added
-- SELECT column_name, data_type 
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- AND column_name IN ('username', 'role', 'is_active', 'last_login_at', 'force_password_change');

-- Expected: 5 rows

-- Verify activity_logs table created
-- SELECT column_name, data_type 
-- FROM information_schema.columns
-- WHERE table_name = 'activity_logs'
-- ORDER BY ordinal_position;

-- Expected: 9 columns (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)

-- Verify indexes created
-- SELECT indexname, tablename
-- FROM pg_indexes
-- WHERE tablename IN ('profiles', 'activity_logs', 'password_reset_tokens')
-- AND schemaname = 'public';

-- Verify RLS enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('activity_logs', 'password_reset_tokens')
-- AND schemaname = 'public';

-- Test helper functions
-- SELECT has_role('admin') AS is_admin;
-- SELECT has_any_role(ARRAY['admin', 'account']::user_role[]) AS has_admin_role;
-- SELECT get_user_role() AS current_role;

-- =====================================================
-- SUCCESS CRITERIA
-- =====================================================
-- ✅ user_role enum exists with 6 values
-- ✅ profiles table has 5 new columns
-- ✅ activity_logs table exists with 9 columns
-- ✅ password_reset_tokens table exists
-- ✅ All indexes created
-- ✅ RLS enabled on both tables
-- ✅ All 3 helper functions work
-- ✅ Policies created (4 total)
-- =====================================================
