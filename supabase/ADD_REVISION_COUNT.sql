-- Add revision_count column to jobs table
-- Tracks how many times a job has been sent back to designing stage
-- Count starts at 0, increments each time job moves back to 'designing' from review/waiting/done

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;

-- Set existing jobs to 0 revisions
UPDATE jobs SET revision_count = 0 WHERE revision_count IS NULL;
