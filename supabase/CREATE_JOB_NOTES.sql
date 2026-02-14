-- =============================================
-- JOB NOTES TABLE
-- Structured feedback/notes log per project
-- Replaces the mock chat UI
-- =============================================

CREATE TABLE IF NOT EXISTS job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'design_note'
    CHECK (tag IN ('correction', 'update', 'client_says', 'approved', 'design_note')),
  source TEXT NOT NULL DEFAULT 'self'
    CHECK (source IN ('call', 'whatsapp', 'in_person', 'self')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by job
CREATE INDEX IF NOT EXISTS idx_job_notes_job_id ON job_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_user_id ON job_notes(user_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: Any authenticated user can read notes
CREATE POLICY "job_notes_select"
  ON job_notes FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only admin/manager OR the assigned designer for that job
CREATE POLICY "job_notes_insert"
  ON job_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow admin and manager roles
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
    OR
    -- Allow the assigned designer (check via designers table)
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN designers d ON d.id = j.designer_id
      WHERE j.id = job_notes.job_id
      AND d.user_id = auth.uid()
    )
  );

-- DELETE: Only the note author or admin
CREATE POLICY "job_notes_delete"
  ON job_notes FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- =============================================
-- ENABLE REALTIME for live updates
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE job_notes;
