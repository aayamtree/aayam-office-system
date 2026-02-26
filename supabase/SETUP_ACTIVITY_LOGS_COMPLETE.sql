-- ═══════════════════════════════════════════════════════════
-- ACTIVITY LOGS — COMPLETE SETUP (SAFE TO RUN ANYTIME)
-- Fixes: "column does not exist" errors once and for all
-- Run in Supabase → SQL Editor → Paste and Run
-- ═══════════════════════════════════════════════════════════

-- Step 1: Create table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL DEFAULT 'unknown',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add ALL required columns (safe — IF NOT EXISTS never errors)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_name   TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS module      TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_id   UUID;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_name TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata    JSONB;

-- (Legacy columns from old schema — keep for backward compat)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address  TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent  TEXT;

-- Step 3: Indexes for fast reads (newest first, by user, by module)
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id    ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module     ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action     ON activity_logs(action);

-- Step 4: Row Level Security — all authenticated users can read + insert
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read activity_logs"   ON activity_logs;
DROP POLICY IF EXISTS "Authenticated can insert activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can delete activity_logs"        ON activity_logs;

CREATE POLICY "Authenticated can read activity_logs"
  ON activity_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert activity_logs"
  ON activity_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can delete activity_logs"
  ON activity_logs FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- Step 5: Safe verification — show column list + row count
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_logs'
ORDER BY ordinal_position;

-- Step 6: Row count check
SELECT COUNT(*) AS total_logs FROM activity_logs;

-- ═══════════════ DONE ═══════════════
-- After running this, all these columns exist:
--   id, user_id, user_name, action, module,
--   entity_id, entity_name, description,
--   metadata, entity_type, created_at
-- ═══════════════════════════════════
