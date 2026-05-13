-- DIAGNOSTIC: Check if RLS policies exist for print planner tables

-- Check if tables have RLS enabled
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED' 
        ELSE '❌ DISABLED' 
    END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.tablename IN ('machines', 'sheet_sizes', 'materials', 'print_runs', 'print_run_jobs')
AND t.schemaname = 'public';

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    roles
FROM pg_policies
WHERE tablename IN ('machines', 'sheet_sizes', 'materials', 'print_runs', 'print_run_jobs')
ORDER BY tablename, cmd;

-- Check table permissions
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('machines', 'sheet_sizes', 'materials', 'print_runs', 'print_run_jobs')
AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
