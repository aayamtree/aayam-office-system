-- =====================================================
-- USER ACCESS DIAGNOSTIC & FIX SCRIPT
-- Run this in Supabase SQL Editor to diagnose login issues
-- =====================================================

-- STEP 1: CHECK ALL USER PROFILES
-- This shows all users and their current status
SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    CASE 
        WHEN role IS NULL THEN '🚨 MISSING ROLE - FIX REQUIRED'
        WHEN role NOT IN ('admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk', 'sales') THEN '⚠️ INVALID ROLE'
        WHEN is_active = false THEN '⚠️ INACTIVE USER'
        ELSE '✅ OK'
    END as status
FROM profiles
ORDER BY created_at DESC;

-- =====================================================
-- STEP 2: FIX COMMON ISSUES
-- =====================================================

-- Fix users with NULL roles (assign default 'sales' role)
-- IMPORTANT: Review results from STEP 1 and uncomment LINE BELOW to fix
-- UPDATE profiles SET role = 'sales', is_active = true WHERE role IS NULL;

-- Fix users with 'user' role (legacy bug)
-- UNCOMMENT to fix:
-- UPDATE profiles SET role = 'sales' WHERE role = 'user';

-- Activate all users
-- UNCOMMENT to activate all staff:
-- UPDATE profiles SET is_active = true WHERE email LIKE '%@aayam.com';

-- =====================================================
-- STEP 3: SET SPECIFIC USER ROLES
-- Replace email addresses below with actual staff emails
-- =====================================================

-- EXAMPLE: Set specific roles for your team
-- UPDATE profiles SET role = 'admin', is_active = true WHERE email = 'satish@aayam.com';
-- UPDATE profiles SET role = 'finance', is_active = true WHERE email = 'accounts@aayam.com';
-- UPDATE profiles SET role = 'designer', is_active = true WHERE email = 'designer1@aayam.com';
-- UPDATE profiles SET role = 'marketing', is_active = true WHERE email = 'marketing@aayam.com';
-- UPDATE profiles SET role = 'dispatch', is_active = true WHERE email = 'dispatch@aayam.com';

-- =====================================================
-- STEP 4: VERIFY AUTHENTICATION SETUP
-- =====================================================

-- Check if users exist in auth.users but not in profiles
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created,
    p.id as profile_id,
    p.role,
    CASE 
        WHEN p.id IS NULL THEN '🚨 PROFILE MISSING'
        ELSE '✅ Profile exists'
    END as profile_status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY au.created_at DESC;

-- =====================================================
-- STEP 5: CREATE MISSING PROFILES
-- If users exist in auth but not profiles, uncomment below:
-- =====================================================

-- INSERT INTO profiles (id, email, full_name, role, is_active)
-- SELECT 
--     au.id,
--     au.email,
--     SPLIT_PART(au.email, '@', 1) as full_name,
--     'sales' as role,  -- Default role
--     true as is_active
-- FROM auth.users au
-- LEFT JOIN profiles p ON au.id = p.id
-- WHERE p.id IS NULL;

-- =====================================================
-- STEP 6: CHECK RLS POLICIES
-- Ensure profiles table has correct  RLS policies
-- =====================================================

-- View current RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- =====================================================
-- TROUBLESHOOTING GUIDE
-- =====================================================

-- Problem: "Some users can't login"
-- → Check if their email exists in auth.users:
--   SELECT * FROM auth.users WHERE email = 'user@example.com';
-- → Check if they have a profile:
--   SELECT * FROM profiles WHERE email = 'user@example.com';
-- → If profile missing, create it using STEP 5

-- Problem: "Some users see admin sidebar when they shouldn't"
-- → Check their role in profiles table (STEP 1)
-- → Update their role to correct value:
--   UPDATE profiles SET role = 'designer' WHERE email = 'user@example.com';

-- Problem: "Login works but no sidebar shows"
-- → User probably has NULL role. Fix with STEP 2.

-- Problem: "User was working yesterday, not today"
-- → Check if they were marked inactive:
--   SELECT * FROM profiles WHERE email = 'user@example.com';
-- → Reactivate:
--   UPDATE profiles SET is_active = true WHERE email = 'user@example.com';

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

-- After fixes, verify all users are good:
SELECT 
    email,
    full_name,
    role,
    is_active,
    CASE 
        WHEN role IS NOT NULL AND is_active = true THEN '✅ READY'
        ELSE '❌ NEEDS ATTENTION'
    END as final_status
FROM profiles
ORDER BY final_status, email;
