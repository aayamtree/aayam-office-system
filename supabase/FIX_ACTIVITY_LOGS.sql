-- Clean Activity Logs Migration
-- Run in Supabase SQL Editor

-- Step 1: Add new columns to existing table (keeps all existing data)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_name TEXT;

-- Step 2: Make sure module column exists
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS module TEXT;

-- Step 3: Fix RLS — allow all authenticated users to read and insert
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read activity_logs" ON activity_logs;
CREATE POLICY "Authenticated can read activity_logs"
  ON activity_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert activity_logs" ON activity_logs;
CREATE POLICY "Authenticated can insert activity_logs"
  ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Step 4: Verify
SELECT id, user_name, action, module, entity_name, description, created_at
FROM activity_logs
ORDER BY created_at DESC
LIMIT 10;
