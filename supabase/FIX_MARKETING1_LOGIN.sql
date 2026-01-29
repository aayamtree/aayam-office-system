-- =============================================
-- FIX LOGIN ISSUE FOR MARKETING1
-- =============================================

-- Step 1: Check if marketing1 user exists
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM profiles
WHERE email = 'marketing1@aayam.internal';

-- Step 2: Check auth.users table (Supabase Auth)
SELECT 
  id,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at
FROM auth.users
WHERE email = 'marketing1@aayam.internal';

-- =============================================
-- IF USER EXISTS BUT CAN'T LOGIN:
-- Run this to reset password
-- =============================================

-- Option 1: Set a new known password (replace 'newpassword123' with your desired password)
-- UPDATE auth.users 
-- SET encrypted_password = crypt('newpassword123', gen_salt('bf'))
-- WHERE email = 'marketing1@aayam.internal';

-- =============================================
-- IF USER DOESN'T EXIST:
-- Create the user (This creates ONLY in profiles, you need Supabase Auth UI for full user)
-- =============================================

-- INSERT INTO profiles (id, email, full_name, role, is_active)
-- VALUES (
--   gen_random_uuid(),
--   'marketing1@aayam.internal',
--   'Marketing User 1',
--   'marketing',
--   true
-- );

-- =============================================
-- RECOMMENDED: Use Supabase Dashboard
-- =============================================
-- 1. Go to: Supabase Dashboard > Authentication > Users
-- 2. Click "Add User"
-- 3. Enter:
--    Email: marketing1@aayam.internal
--    Password: [your choice]
--    Auto Confirm: YES
-- 4. After creating in Auth, the trigger should auto-create profile
-- 5. If not, manually update the profile role:

-- UPDATE profiles 
-- SET role = 'marketing', 
--     full_name = 'Marketing User 1',
--     is_active = true
-- WHERE email = 'marketing1@aayam.internal';
