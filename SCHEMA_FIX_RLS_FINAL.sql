-- 1. FIX PROFILES RLS (Critical: This allows the system to check your role)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting restrictive policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Allow ALL authenticated users to read profiles (Required for role checks to work)
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- 2. ENSURE COLUMNS EXIST (In case previous migration failed)
CREATE TABLE IF NOT EXISTS job_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'design',
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add category if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_checklists' AND column_name='category') THEN
        ALTER TABLE job_checklists ADD COLUMN category TEXT NOT NULL DEFAULT 'design';
    END IF;
END $$;

-- 3. RESET JOB_CHECKLISTS POLICIES
ALTER TABLE job_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON job_checklists;
DROP POLICY IF EXISTS "Allow write access to admins" ON job_checklists;
DROP POLICY IF EXISTS "Allow write access to admins and managers" ON job_checklists;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON job_checklists;

-- Read Access: Open to all logged in users
CREATE POLICY "Allow read access to authenticated users" 
ON job_checklists FOR SELECT 
TO authenticated 
USING (true);

-- Write Access: Explicit check for admin/manager role
CREATE POLICY "Allow write access to admins and managers" 
ON job_checklists FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'manager')
  )
);

-- 4. FIX CONSTRAINTS (Prevent duplicate error masking as RLS)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_checklists_job_type_key') THEN
        ALTER TABLE job_checklists DROP CONSTRAINT job_checklists_job_type_key;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_checklists_unique_type_category') THEN
        ALTER TABLE job_checklists ADD CONSTRAINT job_checklists_unique_type_category UNIQUE (job_type, category);
    END IF;
END $$;
