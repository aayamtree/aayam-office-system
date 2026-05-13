-- ============================================================
-- DESIGNER MODULE PATCH 002 — Audit Fix
-- Run in: Supabase SQL Editor
-- ============================================================

-- Fix 1: Update null full_name for 4 designer accounts
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"full_name":"Designer 7"}'
WHERE email = 'designer7@aayam.internal' AND (raw_user_meta_data->>'full_name' IS NULL OR raw_user_meta_data->>'full_name' = '');

UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"full_name":"Designer 5"}'
WHERE email = 'designer5@aayam.internal' AND (raw_user_meta_data->>'full_name' IS NULL OR raw_user_meta_data->>'full_name' = '');

UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"full_name":"Designer 6"}'
WHERE email = 'designer6@aayam.internal' AND (raw_user_meta_data->>'full_name' IS NULL OR raw_user_meta_data->>'full_name' = '');

UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"full_name":"Designer 8"}'
WHERE email = 'designer8@aayam.internal' AND (raw_user_meta_data->>'full_name' IS NULL OR raw_user_meta_data->>'full_name' = '');

-- Update profiles table (which syncs from auth.users)
UPDATE profiles SET full_name = 'Designer 7' WHERE email = 'designer7@aayam.internal' AND (full_name IS NULL OR full_name = '');
UPDATE profiles SET full_name = 'Designer 5' WHERE email = 'designer5@aayam.internal' AND (full_name IS NULL OR full_name = '');
UPDATE profiles SET full_name = 'Designer 6' WHERE email = 'designer6@aayam.internal' AND (full_name IS NULL OR full_name = '');
UPDATE profiles SET full_name = 'Designer 8' WHERE email = 'designer8@aayam.internal' AND (full_name IS NULL OR full_name = '');

-- Fix 2: Add performed_by_name column to dossier_entries if missing
ALTER TABLE dossier_entries ADD COLUMN IF NOT EXISTS performed_by_name TEXT;

-- Fix 3: Add session_type column to task_time_sessions if missing
ALTER TABLE task_time_sessions ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'design';

-- Backfill existing sessions: mark as 'rework' if the task had rework_count > 0 at time of session
-- (We can't know historical rework_count, so backfill based on current rework_count)
UPDATE task_time_sessions tts
SET session_type = 'rework'
FROM design_tasks dt
WHERE tts.task_id = dt.id
  AND dt.rework_count > 0
  AND tts.session_type IS NULL;

UPDATE task_time_sessions SET session_type = 'design' WHERE session_type IS NULL;

-- Verify
SELECT
  'profiles fixed' AS check,
  COUNT(*) FILTER (WHERE full_name IS NOT NULL AND full_name != '') AS with_name,
  COUNT(*) FILTER (WHERE full_name IS NULL OR full_name = '') AS null_name
FROM profiles WHERE role = 'designer';

SELECT 'dossier_entries columns' AS check, column_name
FROM information_schema.columns
WHERE table_name = 'dossier_entries'
  AND column_name IN ('performed_by_name', 'actor_id');

SELECT 'task_time_sessions columns' AS check, column_name
FROM information_schema.columns
WHERE table_name = 'task_time_sessions'
  AND column_name = 'session_type';
