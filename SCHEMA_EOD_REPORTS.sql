-- =====================================================
-- DAILY WORK STATUS REPORT SYSTEM - DATABASE SCHEMA
-- Purpose: End-of-Day accountability and work tracking
-- =====================================================

-- ============================
-- TABLE: daily_work_reports
-- Main EOD report submission
-- ============================
CREATE TABLE IF NOT EXISTS daily_work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Overall day summary
  overall_notes TEXT,
  blockers TEXT, -- What prevented progress
  tomorrow_plan TEXT, -- What they'll work on tomorrow
  work_hours DECIMAL(4,2), -- Total hours worked
  
  -- Metadata
  tags TEXT[] DEFAULT '{}', -- Extracted hashtags for search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one report per user per day
  UNIQUE(user_id, report_date)
);

-- ============================
-- TABLE: report_task_updates
-- Individual task updates within each report
-- ============================
CREATE TABLE IF NOT EXISTS report_task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_work_reports(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Task status update
  status_update TEXT NOT NULL,
  completion_percentage INTEGER DEFAULT 0, -- 0-100
  time_spent DECIMAL(4,2), -- Hours spent on this task
  
  -- Checklists (JSON for flexibility)
  checklist JSONB DEFAULT '{}', -- {design_done: true, approval_received: false, ...}
  
  -- Client interactions
  client_comments TEXT,
  client_approval_received BOOLEAN DEFAULT false,
  approval_file_url TEXT, -- Link to approved file
  
  -- File status
  print_file_ready BOOLEAN DEFAULT false,
  print_checklist_done BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- INDEXES for Performance
-- ============================
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON daily_work_reports(user_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_work_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_tags ON daily_work_reports USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_task_updates_report ON report_task_updates(report_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_job ON report_task_updates(job_id);

-- ============================
-- RLS POLICIES
-- ============================

-- Enable RLS (safe to run multiple times)
ALTER TABLE daily_work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_task_updates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe - IF EXISTS handles non-existent policies)
DROP POLICY IF EXISTS "Users can view own reports" ON daily_work_reports;
DROP POLICY IF EXISTS "Users can create own reports" ON daily_work_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON daily_work_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON daily_work_reports;

DROP POLICY IF EXISTS "Users can view own task updates" ON report_task_updates;
DROP POLICY IF EXISTS "Users can create own task updates" ON report_task_updates;
DROP POLICY IF EXISTS "Users can update own task updates" ON report_task_updates;
DROP POLICY IF EXISTS "Admins can view all task updates" ON report_task_updates;

-- Daily Work Reports Policies
CREATE POLICY "Users can view own reports"
  ON daily_work_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reports"
  ON daily_work_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON daily_work_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reports"
  ON daily_work_reports FOR SELECT
  USING (
    -- Check if user has admin role in JWT metadata
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Report Task Updates Policies
CREATE POLICY "Users can view own task updates"
  ON report_task_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM daily_work_reports
      WHERE daily_work_reports.id = report_task_updates.report_id
      AND daily_work_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own task updates"
  ON report_task_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_work_reports
      WHERE daily_work_reports.id = report_task_updates.report_id
      AND daily_work_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own task updates"
  ON report_task_updates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM daily_work_reports
      WHERE daily_work_reports.id = report_task_updates.report_id
      AND daily_work_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all task updates"
  ON report_task_updates FOR SELECT
  USING (
    -- Check if user has admin role in JWT metadata
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================
-- HELPER FUNCTION: Extract Hashtags
-- Automatically extract hashtags from text
-- ============================
CREATE OR REPLACE FUNCTION extract_hashtags(text_input TEXT)
RETURNS TEXT[] AS $$
DECLARE
  hashtags TEXT[];
BEGIN
  -- Extract all words starting with # using regex
  SELECT ARRAY_AGG(DISTINCT match)
  INTO hashtags
  FROM regexp_matches(text_input, '#[\w-]+', 'g') AS match;
  
  RETURN COALESCE(hashtags, '{}');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================
-- TRIGGER: Auto-extract hashtags before insert/update
-- ============================
CREATE OR REPLACE FUNCTION auto_extract_hashtags()
RETURNS TRIGGER AS $$
BEGIN
  -- Combine all text fields for hashtag extraction
  NEW.tags := extract_hashtags(
    COALESCE(NEW.overall_notes, '') || ' ' ||
    COALESCE(NEW.blockers, '') || ' ' ||
    COALESCE(NEW.tomorrow_plan, '')
  );
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_extract_hashtags ON daily_work_reports;
CREATE TRIGGER trigger_extract_hashtags
  BEFORE INSERT OR UPDATE ON daily_work_reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_extract_hashtags();

-- ============================
-- COMMENTS FOR DOCUMENTATION
-- ============================
COMMENT ON TABLE daily_work_reports IS 'Daily EOD status reports submitted by employees';
COMMENT ON TABLE report_task_updates IS 'Individual task updates within each daily report';
COMMENT ON COLUMN daily_work_reports.tags IS 'Auto-extracted hashtags for search (#JOB-001, #ClientName, etc.)';
COMMENT ON COLUMN report_task_updates.checklist IS 'Dynamic checklist items in JSON format';

-- ============================
-- SUCCESS MESSAGE
-- ============================
DO $$
BEGIN
  RAISE NOTICE '✅ Daily Work Status Report Schema Created Successfully!';
  RAISE NOTICE '📋 Tables: daily_work_reports, report_task_updates';
  RAISE NOTICE '🔍 Hashtag auto-extraction enabled';
  RAISE NOTICE '🔒 RLS policies applied';
END $$;
