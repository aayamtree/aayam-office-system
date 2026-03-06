-- =============================================
-- MIGRATE DESIGNERS TABLE INTO PROFILES
-- Run this in Supabase SQL Editor
-- Step 1: Run everything except the DROP TABLE
-- Step 2: Verify the SELECT looks correct
-- Step 3: Uncomment and run DROP TABLE
-- =============================================

-- 1. Add designer-specific columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full-time',
  ADD COLUMN IF NOT EXISTS joining_date DATE,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS document_url TEXT;

-- 2. Migrate designer data → profiles (for linked designers only)
UPDATE profiles p
SET
  full_name    = COALESCE(NULLIF(p.full_name, ''), d.name),
  phone        = COALESCE(p.phone, d.phone),
  skills       = COALESCE(p.skills, d.skills, '{}'),
  hourly_rate  = COALESCE(p.hourly_rate, d.hourly_rate, 0),
  monthly_salary = COALESCE(p.monthly_salary, d.monthly_salary, 0),
  employment_type = COALESCE(p.employment_type, d.employment_type, 'full-time'),
  joining_date = COALESCE(p.joining_date, d.joining_date),
  city         = COALESCE(p.city, d.city),
  state        = COALESCE(p.state, d.state),
  document_url = COALESCE(p.document_url, d.document_url)
FROM designers d
WHERE p.id = d.user_id
  AND d.user_id IS NOT NULL;

-- 3. Verify results (check all designer profiles look correct)
SELECT
  p.id,
  p.full_name,
  p.email,
  p.role,
  p.phone,
  p.skills,
  p.hourly_rate,
  p.employment_type
FROM profiles p
WHERE p.role = 'designer'
ORDER BY p.full_name;

-- 4. Update jobs.designer_id foreign key to point to profiles
--    (Only needed if it currently points to designers.id instead of profiles.id)
--    Check: SELECT DISTINCT designer_id FROM jobs LIMIT 5;
--    If those IDs exist in profiles table, nothing to do.

-- 5. DROP designers table (ONLY after verifying step 3 data looks correct)
-- DROP TABLE IF EXISTS designers CASCADE;
