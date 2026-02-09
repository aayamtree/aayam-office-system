-- =============================================
-- AAYAM OFFICE — PHASE 1 MIGRATION
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- =============================================

-- =============================================
-- 1A. Add job_id to expenses (optional job link)
-- =============================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);
COMMENT ON COLUMN expenses.job_id IS 'Optional link to a specific job for job-specific expenses';

-- =============================================
-- 1C. Add referred_by to clients
-- =============================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES clients(id);
COMMENT ON COLUMN clients.referred_by IS 'UUID of the client who referred this client';

-- =============================================
-- 1D. Add actual_quantity to jobs (overrun tracking)
-- =============================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_quantity INTEGER;
COMMENT ON COLUMN jobs.actual_quantity IS 'Actual produced quantity for overrun/underrun tracking';

-- =============================================
-- 1E. Payment Splits table (multi-mode payments)
-- =============================================
CREATE TABLE IF NOT EXISTS payment_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES payments_received(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  bank_account_id UUID REFERENCES bank_accounts(id),
  reference_number TEXT,
  has_gst BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE payment_splits IS 'Tracks split payments across multiple modes (cash, bank, UPI) for a single payment';

-- RLS for payment_splits
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users manage payment_splits" ON payment_splits;
CREATE POLICY "Authenticated users manage payment_splits" ON payment_splits
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- 3F. PrintRunJob UPS calculation columns
-- =============================================
ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS sheets_to_print INTEGER;
ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS expected_output INTEGER;
ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS actual_output INTEGER;

COMMENT ON COLUMN print_run_jobs.sheets_to_print IS 'How many sheets to print for this job';
COMMENT ON COLUMN print_run_jobs.expected_output IS 'Auto-calculated: ups_in_sheet × sheets_to_print';
COMMENT ON COLUMN print_run_jobs.actual_output IS 'Actual output produced (for overrun tracking)';

-- =============================================
-- 3G. Calendar event shared visibility columns
-- =============================================
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'team';
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE user_calendar_events ADD COLUMN IF NOT EXISTS source_id UUID;

COMMENT ON COLUMN user_calendar_events.visibility IS 'Who can see: private, team, all';
COMMENT ON COLUMN user_calendar_events.source IS 'manual = user created, auto = system generated';
COMMENT ON COLUMN user_calendar_events.source_type IS 'Origin entity: job, followup, dispatch, invoice, task';
COMMENT ON COLUMN user_calendar_events.source_id IS 'Link back to the source entity';

-- =============================================
-- 3H. User Notes table (dashboard sticky notes)
-- =============================================
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'personal',
  tagged_users UUID[] DEFAULT '{}',
  job_id UUID REFERENCES jobs(id),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE user_notes IS 'Dashboard sticky notes with cross-section @tagging support';

-- RLS for user_notes
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notes or tagged" ON user_notes;
CREATE POLICY "Users manage own notes or tagged" ON user_notes
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = ANY(tagged_users));

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_expenses_job_id ON expenses(job_id);
CREATE INDEX IF NOT EXISTS idx_clients_referred_by ON clients(referred_by);
CREATE INDEX IF NOT EXISTS idx_payment_splits_payment_id ON payment_splits(payment_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_tagged ON user_notes USING GIN(tagged_users);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON user_calendar_events(source_type, source_id);

-- =============================================
-- DONE! All Phase 1 + supporting changes applied.
-- =============================================
