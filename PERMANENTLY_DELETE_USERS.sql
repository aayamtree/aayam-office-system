-- =====================================================
-- PERMANENTLY DELETE SOFT-DELETED USERS
-- This allows you to reuse the email addresses
-- =====================================================

-- STEP 1: View all soft-deleted users
SELECT 
    id,
    email,
    created_at,
    deleted_at,
    CASE 
        WHEN deleted_at IS NOT NULL THEN '🗑️ SOFT DELETED'
        ELSE '✅ ACTIVE'
    END as status
FROM auth.users
WHERE email LIKE '%@aayam.internal'
ORDER BY email;

-- =====================================================
-- STEP 2: PERMANENTLY DELETE FROM AUTH.USERS
-- This removes soft-deleted users completely
-- =====================================================

-- Delete soft-deleted users with these specific emails
DELETE FROM auth.users 
WHERE email IN (
    'admin2@aayam.internal',
    'admin3@aayam.internal', 
    'accounts@aayam.internal'
)
AND deleted_at IS NOT NULL;

-- OR delete ALL soft-deleted users (be careful!)
-- DELETE FROM auth.users WHERE deleted_at IS NOT NULL;

-- =====================================================
-- STEP 3: ALSO DELETE FROM PROFILES (cleanup)
-- =====================================================

DELETE FROM profiles 
WHERE email IN (
    'admin2@aayam.internal',
    'admin3@aayam.internal',
    'accounts@aayam.internal'
);

-- =====================================================
-- STEP 4: VERIFY DELETION COMPLETE
-- =====================================================

-- Check if emails are now available
SELECT 
    email,
    deleted_at
FROM auth.users
WHERE email IN (
    'admin2@aayam.internal',
    'admin3@aayam.internal',
    'accounts@aayam.internal'
);
-- Should return 0 rows

-- =====================================================
-- SUCCESS!
-- Now you can create new users with these emails
-- =====================================================

/*
NEXT STEPS:

1. Go to Authentication → Users → Add User
2. Create admin2@aayam.internal (email now available!)
3. Create admin3@aayam.internal  
4. Create accounts@aayam.internal (or use finance@aayam.internal)
5. Run this to create profiles:

INSERT INTO profiles (id, email, full_name, role, is_active)
SELECT 
    id,
    email,
    CASE 
        WHEN email = 'admin2@aayam.internal' THEN 'Admin 2'
        WHEN email = 'admin3@aayam.internal' THEN 'Admin 3'
        WHEN email = 'accounts@aayam.internal' THEN 'Accounts Admin'
    END as full_name,
    'admin' as role,
    true as is_active
FROM auth.users
WHERE email IN (
    'admin2@aayam.internal',
    'admin3@aayam.internal', 
    'accounts@aayam.internal'
);
*/
