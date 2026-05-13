-- 1. DISABLE RLS entirely for job_checklists temporarily (The "Nuclear" Option)
-- This is necessary because your "Speed Login" feature does not create a real database session, 
-- so you are technically an "Anonymous" user to the database, which RLS blocks by default.

ALTER TABLE job_checklists DISABLE ROW LEVEL SECURITY;

-- 2. ALTERNATIVELY: If you prefer keeping RLS enabled but open:
-- Enable RLS
ALTER TABLE job_checklists ENABLE ROW LEVEL SECURITY;

-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON job_checklists;
DROP POLICY IF EXISTS "Allow write access to admins" ON job_checklists;
DROP POLICY IF EXISTS "Allow write access to admins and managers" ON job_checklists;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles; -- Cleanup

-- CREATE PERMISSIVE POLICIES (Allow Anon/Public access)
CREATE POLICY "Allow public read access"
ON job_checklists FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public write access"
ON job_checklists FOR ALL
TO public
USING (true);

-- 3. ENSURE Category Column Exists (Safety Check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_checklists' AND column_name='category') THEN
        ALTER TABLE job_checklists ADD COLUMN category TEXT NOT NULL DEFAULT 'design';
    END IF;
END $$;
