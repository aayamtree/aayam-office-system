-- =====================================================
-- STEP 2: Create User Role Enum
-- Run AFTER Step 1 completes successfully
-- =====================================================

-- Create user role enum (safe - won't error if exists)
DO $$ 
BEGIN
    CREATE TYPE user_role AS ENUM (
        'admin',
        'account',
        'designer',
        'marketing',
        'dispatch',
        'cmyk'
    );
    RAISE NOTICE 'Created user_role enum';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'user_role enum already exists - skipping';
END $$;

-- Add role column to profiles (if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'designer';
        RAISE NOTICE 'Added role column';
    ELSE
        RAISE NOTICE 'role column already exists';
    END IF;
END $$;

-- Set existing users as designers (safe - won't error if NULL doesn't exist)
UPDATE profiles
SET role = 'designer'
WHERE role IS NULL;

-- =====================================================
-- VERIFY STEP 2 COMPLETED
-- =====================================================

-- Check enum was created
SELECT enumlabel 
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role'
ORDER BY enumlabel;

-- Expected output: 6 rows
-- account
-- admin
-- cmyk
-- designer
-- dispatch
-- marketing

-- Check role column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'role';

-- Expected output: 1 row
-- role | USER-DEFINED

-- =====================================================
-- SUCCESS!
-- If you see 6 enum values and role column, Step 2 is complete.
-- Now go to STEP_3_CREATE_ACTIVITY_LOGS.sql
-- =====================================================
