-- Force update 'sunil' to have 'designer' role
UPDATE profiles
SET role = 'designer'
WHERE username = 'sunil' OR email LIKE 'sunil%';

-- Verify the change
SELECT username, role, email FROM profiles WHERE username = 'sunil';
