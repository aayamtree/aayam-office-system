-- ============================================================
-- ADD @MENTION SUPPORT TO broadcast_notifications
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add target_user_id for direct @mention DMs
ALTER TABLE broadcast_notifications
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_broadcast_target_user ON broadcast_notifications(target_user_id);

-- 2. Drop old restrictive policies
DROP POLICY IF EXISTS "Admin and finance can create broadcasts" ON broadcast_notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON broadcast_notifications;

-- 3. Any authenticated user can INSERT @mention notifications (direct DMs)
--    Admins/Finance can still send broadcasts to all/role audiences
CREATE POLICY "Users can insert notifications"
  ON broadcast_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Admin/Finance can broadcast to all/role
      (target_audience != 'direct' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'finance')
      ))
      OR
      -- Anyone can send a direct @mention to a specific user
      (target_audience = 'direct' AND target_user_id IS NOT NULL)
    )
  );

-- 4. Users can see:
--    a) broadcasts targeted to all
--    b) broadcasts targeted to their role
--    c) direct @mentions targeted to them
CREATE POLICY "Users can view their notifications"
  ON broadcast_notifications FOR SELECT
  TO authenticated
  USING (
    target_audience = 'all'
    OR target_audience = (SELECT role FROM profiles WHERE id = auth.uid())
    OR target_user_id = auth.uid()
  );

-- ============================================================
-- VERIFY: check table has new column
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'broadcast_notifications' AND column_name = 'target_user_id';
-- ============================================================
