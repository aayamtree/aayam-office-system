-- ========================================
-- UPDATE USER TO DISPATCH ROLE
-- ========================================
-- INSTRUCTIONS:
-- 1. First run check-dispatch-users.sql to see all users
-- 2. Find the email of the user who should be dispatch
-- 3. Replace 'USER_EMAIL_HERE' below with their actual email
-- 4. Run this UPDATE query

-- Example: If the user's email is ramesh@aayam.com, change line below to:
-- WHERE email = 'ramesh@aayam.com';

UPDATE profiles
SET 
  role = 'dispatch',
  is_active = true
WHERE email = 'USER_EMAIL_HERE';  -- 👈 CHANGE THIS EMAIL

-- After running, verify the update:
SELECT 
  email,
  full_name,
  role,
  is_active,
  '✅ Updated successfully!' as status
FROM profiles
WHERE email = 'USER_EMAIL_HERE';  -- 👈 CHANGE THIS EMAIL TOO
