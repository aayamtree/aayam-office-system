-- Add linked_job_id to notes
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS linked_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- Allow null due_date for reminders (optional)
ALTER TABLE reminders 
ALTER COLUMN due_date DROP NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_linked_job_id ON notes(linked_job_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
