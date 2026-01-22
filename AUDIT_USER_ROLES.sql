-- System Audit: Check All User Profiles
-- Run this in Supabase SQL Editor to see all users and their roles

SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM profiles
ORDER BY created_at DESC;

-- Look for any issues:
-- 1. Users with role = 'user' who should be staff
-- 2. Role names that don't match: admin, designer, dispatch, finance, marketing
-- 3. Inactive users who should be active

-- To fix a user's role:
-- UPDATE profiles SET role = 'designer' WHERE email = 'user@example.com';
