-- Fix Role Naming Issues
-- The system uses 'finance' but you call it 'account'
-- This query standardizes everything to 'finance'

-- Step 1: Check what roles currently exist
SELECT DISTINCT role, COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY count DESC;

-- Step 2: If you see 'account', change to 'finance'
-- UPDATE profiles SET role = 'finance' WHERE role = 'account';

-- Step 3: If you see 'user', change to appropriate role
-- UPDATE profiles SET role = 'designer' WHERE email = 'someuser@example.com';

-- Step 4: Verify all roles are valid
-- Valid roles: admin, manager, sales, designer, dispatch, marketing, finance, cmyk
SELECT 
    email,
    full_name,
    role,
    CASE 
        WHEN role IN ('admin', 'manager', 'sales', 'designer', 'dispatch', 'marketing', 'finance', 'cmyk') 
        THEN '✅ Valid'
        ELSE '❌ INVALID - Fix needed'
    END as status
FROM profiles
ORDER BY role, email;
