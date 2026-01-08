-- 1. Create the Fake Speed Admin profile so Foreign Keys don't break
INSERT INTO profiles (id, email, full_name, role, is_active)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@aayam.com', 'Speed Admin', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure RLS is disabled for Leads (just to be safe)
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
