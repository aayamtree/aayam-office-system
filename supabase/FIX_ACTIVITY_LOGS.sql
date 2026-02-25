-- Fix activity_logs table — add missing columns and fix RLS
-- Run this in Supabase SQL Editor

-- Step 1: Add missing columns if they don't exist
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'System';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details JSONB;

-- Step 2: Backfill 'details' from existing 'metadata' if metadata column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'metadata'
  ) THEN
    UPDATE activity_logs SET details = metadata WHERE details IS NULL AND metadata IS NOT NULL;
  END IF;
END $$;

-- Step 3: Drop overly restrictive RLS and create permissive ones
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity" ON activity_logs;
DROP POLICY IF EXISTS "Admin can view all activity" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert activity" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated can read activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated can insert activity_logs" ON activity_logs;

-- All authenticated users can read all logs (admin page)
CREATE POLICY "Authenticated can read activity_logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert their own logs
CREATE POLICY "Authenticated can insert activity_logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Step 4: Add FK so Supabase can join profiles (enables user names in Activity Log)
-- Safe: only adds if constraint doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_logs_user_id_fkey'
    AND table_name = 'activity_logs'
  ) THEN
    ALTER TABLE activity_logs
      ADD CONSTRAINT activity_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 5: Verify result
SELECT 
  COUNT(*) as total_logs,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log
FROM activity_logs;
