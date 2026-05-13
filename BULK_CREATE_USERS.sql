-- =====================================================
-- BULK CREATE USERS FOR SOFT TRIAL
-- 16 users across all roles
-- =====================================================

-- IMPORTANT: Run this AFTER creating users in Supabase Auth
-- This script sets usernames and roles for all users

-- =====================================================
-- STEP 1: Create Users in Supabase Dashboard First
-- =====================================================
-- Go to Supabase → Authentication → Users → Add User
-- Create these users with emails (will auto-generate passwords):
--
-- admin1@aayam.internal
-- admin2@aayam.internal  
-- admin3@aayam.internal
-- accounts@aayam.internal
-- designer1@aayam.internal
-- designer2@aayam.internal
-- designer3@aayam.internal
-- designer4@aayam.internal
-- designer5@aayam.internal
-- designer6@aayam.internal
-- designer7@aayam.internal
-- designer8@aayam.internal
-- marketing1@aayam.internal
-- marketing2@aayam.internal
-- dispatch1@aayam.internal
-- dispatch2@aayam.internal
-- cmyk1@aayam.internal
-- cmyk2@aayam.internal

-- =====================================================
-- STEP 2: Update Profiles with Usernames and Roles
-- =====================================================

-- ADMIN USERS  (3)
UPDATE profiles SET 
    username = 'admin1',
    name = 'Admin User 1',
    role = 'admin',
    is_active = true
WHERE email = 'admin1@aayam.internal';

UPDATE profiles SET 
    username = 'admin2',
    name = 'Admin User 2',
    role = 'admin',
    is_active = true
WHERE email = 'admin2@aayam.internal';

UPDATE profiles SET 
    username = 'admin3',
    name = 'Admin User 3',
    role = 'admin',
    is_active = true
WHERE email = 'admin3@aayam.internal';

-- ACCOUNT USER (1)
UPDATE profiles SET 
    username = 'accounts',
    name = 'Accounts Manager',
    role = 'account',
    is_active = true
WHERE email = 'accounts@aayam.internal';

-- DESIGNER USERS (8)
UPDATE profiles SET 
    username = 'designer1',
    name = 'Designer 1',
    role = 'designer',
    is_active = true
WHERE email = 'designer1@aayam.internal';

UPDATE profiles SET 
    username = 'designer2',
    name = 'Designer 2',
    role = 'designer',
    is_active = true
WHERE email = 'designer2@aayam.internal';

UPDATE profiles SET 
    username = 'designer3',
    name = 'Designer 3',
    role = 'designer',
    is_active = true
WHERE email = 'designer3@aayam.internal';

UPDATE profiles SET 
    username = 'designer4',
    name = 'Designer 4',
    role = 'designer',
    is_active = true
WHERE email = 'designer4@aayam.internal';

UPDATE profiles SET 
    username = 'designer5',
    name = 'Designer 5',
    role = 'designer',
    is_active = true
WHERE email = 'designer5@aayam.internal';

UPDATE profiles SET 
    username = 'designer6',
    name = 'Designer 6',
    role = 'designer',
    is_active = true
WHERE email = 'designer6@aayam.internal';

UPDATE profiles SET 
    username = 'designer7',
    name = 'Designer 7',
    role = 'designer',
    is_active = true
WHERE email = 'designer7@aayam.internal';

UPDATE profiles SET 
    username = 'designer8',
    name = 'Designer 8',
    role = 'designer',
    is_active = true
WHERE email = 'designer8@aayam.internal';

-- MARKETING USERS (2)
UPDATE profiles SET 
    username = 'marketing1',
    name = 'Marketing Executive 1',
    role = 'marketing',
    is_active = true
WHERE email = 'marketing1@aayam.internal';

UPDATE profiles SET 
    username = 'marketing2',
    name = 'Marketing Executive 2',
    role = 'marketing',
    is_active = true
WHERE email = 'marketing2@aayam.internal';

-- DISPATCH USERS (2)
UPDATE profiles SET 
    username = 'dispatch1',
    name = 'Dispatch Manager 1',
    role = 'dispatch',
    is_active = true
WHERE email = 'dispatch1@aayam.internal';

UPDATE profiles SET 
    username = 'dispatch2',
    name = 'Dispatch Manager 2',
    role = 'dispatch',
    is_active = true
WHERE email = 'dispatch2@aayam.internal';

-- CMYK USERS (2)
UPDATE profiles SET 
    username = 'cmyk1',
    name = 'CMYK Operator 1',
    role = 'cmyk',
    is_active = true
WHERE email = 'cmyk1@aayam.internal';

UPDATE profiles SET 
    username = 'cmyk2',
    name = 'CMYK Operator 2',
    role = 'cmyk',
    is_active = true
WHERE email = 'cmyk2@aayam.internal';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check all users were updated
SELECT 
    username,
    name,
    email,
    role,
    is_active,
    created_at
FROM profiles
WHERE email LIKE '%@aayam.internal'
ORDER BY role, username;

-- Count by role
SELECT 
    role,
    COUNT(*) as user_count
FROM profiles
WHERE email LIKE '%@aayam.internal'
GROUP BY role
ORDER BY role;

-- =====================================================
-- EXPECTED RESULTS:
-- =====================================================
-- admin     | 3
-- account   | 1
-- designer  | 8
-- marketing | 2
-- dispatch  | 2
-- cmyk      | 2
-- TOTAL: 16 users
-- =====================================================
