-- Fix all user roles based on their email prefix
-- This will automatically set correct roles based on usernames

-- CMYK users
UPDATE profiles 
SET role = 'cmyk' 
WHERE email LIKE 'cmyk%@aayam.internal';

-- Dispatch users
UPDATE profiles 
SET role = 'dispatch' 
WHERE email LIKE 'dispatch%@aayam.internal';

-- Marketing users
UPDATE profiles 
SET role = 'marketing' 
WHERE email LIKE 'marketing%@aayam.internal';

-- Designer users
UPDATE profiles 
SET role = 'designer' 
WHERE email LIKE 'designer%@aayam.internal';

-- Keep admin1 as admin (or set your main admin email)
UPDATE profiles 
SET role = 'admin' 
WHERE email IN ('admin@aayam.internal', 'admin1@aayam.internal');

-- Verify the fixes
SELECT email, role, is_active 
FROM profiles 
ORDER BY role, email;
