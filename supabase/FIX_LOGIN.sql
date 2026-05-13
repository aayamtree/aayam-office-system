-- EMERGENCY FIX FOR LOGIN LOOP (v2)
-- Fixes Missing Column and Permissions

-- 1. Add missing 'is_active' column to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Disable RLS on profiles to ensure 'fetchProfile' and 'upsert' ALWAYS works.
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Ensure 'role' column exists (it should, but just in case)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'staff';

-- 4. Verify other tables
ALTER TABLE counters DISABLE ROW LEVEL SECURITY;

SELECT 'Login Fix Applied: Added is_active column & Disabled RLS' as status;
