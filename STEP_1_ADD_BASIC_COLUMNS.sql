-- =====================================================
-- STEP 1: Add Basic Columns to Profiles Only
-- This is the FIRST and SAFEST step
-- No dependencies, no complications
-- =====================================================

-- Add username column (if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'username'
    ) THEN
        ALTER TABLE profiles ADD COLUMN username VARCHAR(50) UNIQUE;
        RAISE NOTICE 'Added username column';
    ELSE
        RAISE NOTICE 'username column already exists';
    END IF;
END $$;

-- Add is_active column (if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_active column';
    ELSE
        RAISE NOTICE 'is_active column already exists';
    END IF;
END $$;

-- Add last_login_at column (if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'last_login_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMP;
        RAISE NOTICE 'Added last_login_at column';
    ELSE
        RAISE NOTICE 'last_login_at column already exists';
    END IF;
END $$;

-- =====================================================
-- VERIFY STEP 1 COMPLETED
-- =====================================================

SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('username', 'is_active', 'last_login_at')
ORDER BY column_name;

-- Expected output: 3 rows
-- is_active       | boolean
-- last_login_at   | timestamp without time zone
-- username        | character varying

-- =====================================================
-- SUCCESS!
-- If you see 3 rows above, Step 1 is complete.
-- Now go to STEP_2_ADD_ROLE_ENUM.sql
-- =====================================================
