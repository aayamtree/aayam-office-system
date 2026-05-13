-- =====================================================
-- CLEANUP OLD ACCOUNTS & STANDARDIZE TO @aayam.internal
-- =====================================================

-- STEP 1: View all accounts that will be deleted
-- Run this first to verify what will be removed
SELECT 
    id,
    email,
    full_name,
    role,
    created_at,
    CASE 
        WHEN email IN ('info@aayam.com', 'meet@aayam.local', 'sunil@aayam.local') THEN '🗑️ WILL DELETE - Old account'
        WHEN email NOT LIKE '%@aayam.internal' THEN '⚠️ NON-STANDARD EMAIL'
        ELSE '✅ KEEP - Standard format'
    END as action
FROM profiles
ORDER BY 
    CASE 
        WHEN email LIKE '%@aayam.internal' THEN 1
        ELSE 2
    END,
    email;

-- =====================================================
-- STEP 2: DELETE OLD LEGACY ACCOUNTS
-- IMPORTANT: Review Step 1 results before running this!
-- =====================================================

-- Delete specific old accounts from profiles
DELETE FROM profiles 
WHERE email IN ('info@aayam.com', 'meet@aayam.local', 'sunil@aayam.local');

-- Delete from auth.users as well (if they exist)
-- Note: You may need to do this from Supabase Authentication UI
-- Or run: DELETE FROM auth.users WHERE email IN ('info@aayam.com', 'meet@aayam.local', 'sunil@aayam.local');

-- =====================================================
-- STEP 3: FIX ALL INVALID ROLES
-- =====================================================

-- Fix admin 2, admin 3 → admin
UPDATE profiles SET role = 'admin', is_active = true 
WHERE role LIKE 'admin%' AND email LIKE '%@aayam.internal';

-- Fix accounts → finance
UPDATE profiles SET role = 'finance', is_active = true 
WHERE role = 'accounts' AND email LIKE '%@aayam.internal';

-- Fix SATISH V → admin
UPDATE profiles SET role = 'admin', is_active = true 
WHERE role = 'SATISH V' AND email LIKE '%@aayam.internal';

-- Fix SUNIL → designer
UPDATE profiles SET role = 'designer', is_active = true 
WHERE role = 'SUNIL' AND email LIKE '%@aayam.internal';

-- Fix emci → Remove if it's not @aayam.internal
DELETE FROM profiles 
WHERE role = 'emci' AND email NOT LIKE '%@aayam.internal';

-- Fix any remaining "user" roles - change to marketing (you can adjust this)
UPDATE profiles SET role = 'marketing', is_active = true 
WHERE role = 'user' AND email LIKE '%@aayam.internal';

-- =====================================================
-- STEP 4: ACTIVATE ALL VALID USERS
-- =====================================================

UPDATE profiles 
SET is_active = true 
WHERE email LIKE '%@aayam.internal'
AND role IN ('admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk');

-- =====================================================
-- STEP 5: VERIFY CLEANUP
-- =====================================================

-- Check final user list - should only show @aayam.internal
SELECT 
    email,
    full_name,
    role,
    is_active,
    created_at,
    CASE 
        WHEN role NOT IN ('admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk') THEN '❌ INVALID ROLE'
        WHEN is_active = false THEN '⚠️ INACTIVE'
        ELSE '✅ OK'
    END as status
FROM profiles
WHERE email LIKE '%@aayam.internal'
ORDER BY role, email;

-- =====================================================
-- STEP 6: OPTIONAL - Delete ALL non-@aayam.internal accounts
-- Only run this if you want to remove ALL old format emails
-- =====================================================

-- DANGER: This will delete all accounts not using @aayam.internal!
-- Review carefully before uncommenting:

-- DELETE FROM profiles WHERE email NOT LIKE '%@aayam.internal';

-- =====================================================
-- SUMMARY
-- =====================================================

-- After running this script, you should have:
-- ✅ Only @aayam.internal email addresses
-- ✅ Only valid roles: admin, finance, designer, marketing, dispatch, cmyk
-- ✅ All users active
-- ✅ No "user", "sales", "emci", "SATISH V", "SUNIL", "accounts" roles

SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email LIKE '%@aayam.internal' THEN 1 END) as internal_users,
    COUNT(CASE WHEN role IN ('admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk') THEN 1 END) as valid_roles,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users
FROM profiles;
