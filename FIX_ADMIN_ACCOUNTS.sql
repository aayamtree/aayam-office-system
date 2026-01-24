-- =====================================================
-- FIX ADMIN ACCOUNTS - Clean Setup
-- Delete broken accounts and create clean admin users
-- =====================================================

-- STEP 1: VIEW ALL CURRENT ADMIN-LIKE ACCOUNTS
-- Run this first to see what will be deleted
SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM profiles
WHERE role LIKE '%admin%' OR role = 'accounts'
ORDER BY email;

-- =====================================================
-- STEP 2: DELETE BROKEN ADMIN ACCOUNTS
-- IMPORTANT: This will delete users from both profiles AND auth.users
-- =====================================================

-- First, get the IDs of users to delete
SELECT id, email, role 
FROM profiles 
WHERE role IN ('admin 2', 'admin 3', 'accounts', 'SATISH V')
AND email LIKE '%@aayam.internal';

-- Delete from profiles table
DELETE FROM profiles 
WHERE role IN ('admin 2', 'admin 3', 'accounts', 'SATISH V')
AND email LIKE '%@aayam.internal';

-- Note: To delete from auth.users, you need to do this in Supabase Authentication UI
-- Or run: DELETE FROM auth.users WHERE email IN ('admin2@aayam.internal', 'admin3@aayam.internal', 'accounts@aayam.internal');

-- =====================================================
-- STEP 3: VERIFY ADMIN1 CONFIGURATION
-- Check the working admin account to replicate
-- =====================================================

SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM profiles
WHERE email = 'admin@aayam.internal' 
   OR email = 'admin1@aayam.internal'
   OR email LIKE 'satish%@aayam.internal';

-- =====================================================
-- STEP 4: CREATE CLEAN ADMIN ACCOUNTS
-- Create admin2, admin3, admin4 with exact same setup as admin1
-- =====================================================

-- IMPORTANT: You need to create users in Supabase Authentication FIRST
-- Go to: Authentication → Users → Add User
-- Create with:
-- - Email: admin2@aayam.internal, Password: [your-password]
-- - Email: admin3@aayam.internal, Password: [your-password]  
-- - Email: admin4@aayam.internal, Password: [your-password]

-- After creating in Auth, insert profiles:
-- (Replace the UUIDs with actual user IDs from auth.users)

-- Method 1: If users already exist in auth.users, sync to profiles
INSERT INTO profiles (id, email, full_name, role, is_active)
SELECT 
    id,
    email,
    CASE 
        WHEN email = 'admin2@aayam.internal' THEN 'ADMIN 2'
        WHEN email = 'admin3@aayam.internal' THEN 'ADMIN 3'
        WHEN email = 'admin4@aayam.internal' THEN 'ADMIN 4'
    END as full_name,
    'admin' as role,  -- IMPORTANT: Exactly 'admin' - no spaces, no numbers
    true as is_active
FROM auth.users
WHERE email IN ('admin2@aayam.internal', 'admin3@aayam.internal', 'admin4@aayam.internal')
ON CONFLICT (id) DO UPDATE
SET 
    role = 'admin',
    full_name = EXCLUDED.full_name,
    is_active = true;

-- =====================================================
-- STEP 5: VERIFY ALL ADMIN ACCOUNTS
-- Check that all admin accounts are correctly configured
-- =====================================================

SELECT 
    email,
    full_name,
    role,
    is_active,
    CASE 
        WHEN role = 'admin' AND is_active = true THEN '✅ CORRECT'
        WHEN role != 'admin' THEN '❌ WRONG ROLE: ' || role
        WHEN is_active = false THEN '⚠️ INACTIVE'
        ELSE '❌ ERROR'
    END as status
FROM profiles
WHERE email LIKE 'admin%@aayam.internal'
   OR role = 'admin'
ORDER BY email;

-- =====================================================
-- STEP 6: SET ALL ADMIN ROLES TO EXACTLY 'admin'
-- Fix any remaining role issues
-- =====================================================

-- Fix any admin accounts that have wrong role format
UPDATE profiles 
SET 
    role = 'admin',
    is_active = true
WHERE email LIKE 'admin%@aayam.internal'
AND email LIKE '%@aayam.internal';

-- =====================================================
-- ALTERNATIVE: MANUAL CREATE (if above doesn't work)
-- Use this if you prefer to create accounts manually
-- =====================================================

/*
-- First create users in Supabase Authentication UI:
1. Go to Authentication → Users
2. Click "Add User"
3. For admin2@aayam.internal:
   - Email: admin2@aayam.internal
   - Password: [secure-password]
   - Auto Confirm User: YES
4. Repeat for admin3 and admin4

-- Then get their IDs and insert into profiles:
INSERT INTO profiles (id, email, full_name, role, is_active) VALUES
('UUID-FROM-AUTH-USERS', 'admin2@aayam.internal', 'ADMIN 2', 'admin', true),
('UUID-FROM-AUTH-USERS', 'admin3@aayam.internal', 'ADMIN 3', 'admin', true),
('UUID-FROM-AUTH-USERS', 'admin4@aayam.internal', 'ADMIN 4', 'admin', true);
*/

-- =====================================================
-- STEP 7: FINAL VERIFICATION
-- Ensure all admins work the same as admin1
-- =====================================================

SELECT 
    'Admin Accounts Summary' as report,
    COUNT(*) as total_admins,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_admins,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as correct_role
FROM profiles
WHERE email LIKE 'admin%@aayam.internal';

-- List all admin accounts
SELECT 
    email,
    full_name,
    role,
    is_active,
    created_at
FROM profiles
WHERE role = 'admin'
AND email LIKE '%@aayam.internal'
ORDER BY email;

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================

/*
CRITICAL RULES FOR ADMIN ACCOUNTS:

1. ✅ Role must be EXACTLY 'admin' (lowercase, no spaces, no numbers)
2. ✅ Email must be @aayam.internal
3. ✅ is_active must be true
4. ✅ Each admin needs entry in both auth.users AND profiles

HOW TO CREATE NEW ADMIN:
Step 1: Supabase Dashboard → Authentication → Users → Add User
Step 2: Set email (admin4@aayam.internal) and password
Step 3: Run STEP 4 query to create profile
Step 4: Verify with STEP 5 query

WHAT NOT TO DO:
❌ Don't use role 'admin 2' or 'admin 3' (with space/number)
❌ Don't use role 'accounts' for admin users
❌ Don't use @aayam.com or @aayam.local emails
❌ Don't create profile without auth.users entry first
*/
