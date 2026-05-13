-- Force update 'sunil' to have 'designer' role
-- Columns: id, email, full_name, role, is_active, created_at
-- (username column does not exist)

UPDATE profiles
SET role = 'designer'
WHERE email LIKE 'sunil%';

-- Verify the change
SELECT full_name, role, email FROM profiles WHERE email LIKE 'sunil%';
