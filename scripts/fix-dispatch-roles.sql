-- ========================================
-- DISPATCH ROLE FIX - DATABASE VERIFICATION
-- ========================================
-- Run these queries in Supabase SQL Editor to verify and fix dispatch users

-- 1. CHECK ALL USER ROLES
-- This shows every user and their current role
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 2. FIND DISPATCH USERS SPECIFICALLY
-- Check if dispatch users exist and have correct role
SELECT 
  id,
  email,
  full_name,
  role,
  is_active
FROM profiles
WHERE role = 'dispatch';

-- 3. FIND USERS WITH NO ROLE (THE BUG WE FIXED)
-- These users would have received admin access in the old code
SELECT 
  id,
  email,
  full_name,
  role,
  is_active
FROM profiles
WHERE role IS NULL OR role = '';

-- 4. FIX: ASSIGN DISPATCH ROLE TO A USER
-- Replace 'user@example.com' with the actual dispatch user email
UPDATE profiles
SET 
  role = 'dispatch',
  is_active = true
WHERE email = 'dispatch@aayam.com'; -- Change this email

-- 5. CREATE A NEW DISPATCH USER (IF NEEDED)
-- First create the auth user in Supabase Auth UI, then run:
INSERT INTO profiles (id, email, full_name, role, is_active, created_at)
VALUES (
  'PASTE_UUID_FROM_AUTH_USER_HERE',
  'dispatch@aayam.com',
  'Dispatch User',
  'dispatch',
  true,
  NOW()
);

-- 6. VERIFY THE FIX
-- After updating, check that dispatch users show correct role
SELECT 
  email,
  full_name,
  role,
  is_active,
  CASE 
    WHEN role = 'dispatch' THEN '✅ Correct'
    WHEN role = 'admin' THEN '⚠️ Should be dispatch'
    WHEN role IS NULL THEN '❌ No role assigned'
    ELSE '⚡ Other role: ' || role
  END as status
FROM profiles
WHERE email LIKE '%dispatch%' OR role = 'dispatch';

-- 7. SECURITY CHECK: Find any users with admin role who shouldn't have it
SELECT 
  email,
  full_name,
  role,
  created_at
FROM profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- ========================================
-- IMPORTANT NOTES:
-- ========================================
-- After the code fix:
-- - Users with missing roles will see "⚠️ No Role Assigned" error in sidebar
-- - They will NOT automatically get admin access (security fix)
-- - Admin must manually assign the correct role via this SQL or settings page
-- ========================================
