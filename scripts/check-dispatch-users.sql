-- ========================================
-- DISPATCH ROLE DIAGNOSTIC CHECK
-- ========================================
-- Safe to run - only SELECT queries to diagnose the issue

-- 1. CHECK ALL USER ROLES
SELECT 
  email,
  full_name,
  role,
  is_active,
  CASE 
    WHEN role IS NULL THEN '❌ NO ROLE - Will show error in sidebar'
    WHEN role = 'admin' THEN '🔴 ADMIN'
    WHEN role = 'dispatch' THEN '✅ DISPATCH (correct)'
    WHEN role = 'finance' THEN '💰 FINANCE'
    WHEN role = 'designer' THEN '🎨 DESIGNER'
    WHEN role = 'marketing' THEN '📢 MARKETING'
    WHEN role = 'cmyk' THEN '🖨️ CMYK'
    ELSE '⚡ ' || role
  END as role_status
FROM profiles
ORDER BY 
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'dispatch' THEN 2
    WHEN 'finance' THEN 3
    ELSE 4
  END,
  email;

-- 2. FIND USERS WITH NO ROLE (THE BUG WE FIXED)
SELECT 
  '⚠️ WARNING: Users without roles will see error screen' as message,
  COUNT(*) as users_affected
FROM profiles
WHERE role IS NULL OR role = '';

-- Show details if any found
SELECT 
  email,
  full_name,
  created_at
FROM profiles
WHERE role IS NULL OR role = ''
ORDER BY created_at DESC;

-- 3. CHECK SPECIFICALLY FOR DISPATCH USERS
SELECT 
  '✅ Dispatch Users Found' as status,
  email,
  full_name,
  is_active
FROM profiles
WHERE role = 'dispatch'
UNION ALL
SELECT 
  '❌ NO DISPATCH USERS FOUND' as status,
  '' as email,
  'Need to assign dispatch role to a user' as full_name,
  null as is_active
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'dispatch');
