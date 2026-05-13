-- ================================================
-- STEP 1: Find all your tables
-- ================================================
-- Run this FIRST to see what tables exist
-- Copy the table names, then use them in Step 2

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
