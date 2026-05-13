-- Add checklist_progress column to jobs table to store the state of the checklist
-- It will store a JSON object like { "Bleed": true, "Colors": true }

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '{}'::jsonb;
