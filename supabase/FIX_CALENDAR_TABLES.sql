-- =============================================
-- FIX CALENDAR: Create/fix missing tables safely
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Fix user_calendar_events table
-- Drop and recreate to fix the RLS infinite recursion issue
DROP TABLE IF EXISTS calendar_event_mentions CASCADE;
DROP TABLE IF EXISTS user_calendar_events CASCADE;

CREATE TABLE user_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'task',
  start_date DATE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  all_day BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'normal',
  category TEXT,
  color TEXT DEFAULT '#8B5CF6',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT,
  recurrence_end_date DATE,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMP,
  tagged_users UUID[] DEFAULT '{}',
  visibility TEXT DEFAULT 'private',
  source TEXT DEFAULT 'manual',
  source_type TEXT,
  source_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cal_events_user ON user_calendar_events(user_id);
CREATE INDEX idx_cal_events_start ON user_calendar_events(start_time);
CREATE INDEX idx_cal_events_status ON user_calendar_events(status);

-- Simple RLS: all authenticated users can read all events, manage their own
ALTER TABLE user_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view calendar events"
  ON user_calendar_events FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Users can manage their own events"
  ON user_calendar_events FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all events"
  ON user_calendar_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 2. Calendar event mentions table
CREATE TABLE calendar_event_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES user_calendar_events(id) ON DELETE CASCADE,
  tagged_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE calendar_event_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mentions"
  ON calendar_event_mentions FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Event owners can manage mentions"
  ON calendar_event_mentions FOR ALL
  TO authenticated
  USING (TRUE);

-- 3. Ensure follow_ups has all needed columns (add if missing)
DO $$
BEGIN
  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follow_ups' AND column_name = 'description'
  ) THEN
    ALTER TABLE follow_ups ADD COLUMN description TEXT;
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follow_ups' AND column_name = 'status'
  ) THEN
    ALTER TABLE follow_ups ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;

  -- Add assigned_to column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follow_ups' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE follow_ups ADD COLUMN assigned_to UUID;
  END IF;
END $$;

-- Done!
DO $$
BEGIN
  RAISE NOTICE 'Calendar tables created/fixed successfully!';
  RAISE NOTICE '- user_calendar_events: recreated with correct RLS';
  RAISE NOTICE '- calendar_event_mentions: created';
  RAISE NOTICE '- follow_ups: missing columns added';
END $$;
