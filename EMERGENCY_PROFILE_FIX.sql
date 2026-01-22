-- =====================================================
-- EMERGENCY: Fix Missing/Broken User Profile
-- =====================================================
-- Run this in Supabase SQL Editor if your profile is broken

-- Step 1: Check if your profile exists
SELECT * FROM profiles WHERE email = 'admin@aayam.internal';
-- Replace 'admin@aayam.internal' with YOUR email

-- Step 2: If profile doesn't exist, create it
-- First, get your user ID from auth.users
SELECT id, email FROM auth.users WHERE email = 'admin@aayam.internal';
-- Copy the ID from above

-- Step 3: Insert/Update your profile
INSERT INTO profiles (id, email, full_name, role, is_active, created_at)
VALUES (
  'YOUR-USER-ID-HERE',  -- Replace with ID from Step 2
  'admin@aayam.internal',  -- Your email
  'SATISH V',  -- Your name
  'admin',  -- Your role
  true,
  NOW()
)
ON CONFLICT (id) 
DO UPDATE SET
  full_name = 'SATISH V',
  role = 'admin',
  is_active = true;

-- Step 4: Verify it worked
SELECT * FROM profiles WHERE email = 'admin@aayam.internal';

-- Step 5: Clear browser cache and login again
-- Run in browser console (F12):
-- localStorage.clear();
-- location.reload();
