-- Add shared_with column to designer_notes for @mention note sharing
-- Run this in Supabase SQL Editor

ALTER TABLE designer_notes ADD COLUMN IF NOT EXISTS shared_with uuid[] DEFAULT '{}';

-- Create index for efficient shared note lookups
CREATE INDEX IF NOT EXISTS idx_designer_notes_shared_with ON designer_notes USING GIN (shared_with);

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'designer_notes';
