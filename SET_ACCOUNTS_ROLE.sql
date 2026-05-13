-- Set accounts@aayam.internal to finance role with super rights
UPDATE profiles 
SET role = 'finance' 
WHERE email = 'accounts@aayam.internal';

-- Verify
SELECT email, full_name, role 
FROM profiles 
WHERE email = 'accounts@aayam.internal';
