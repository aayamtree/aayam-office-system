-- Add title field to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Note';

-- Update existing notes to have a title from first line of content
UPDATE notes 
SET title = CASE 
    WHEN content IS NOT NULL AND LENGTH(content) > 0 
    THEN LEFT(content, 50) 
    ELSE 'Untitled Note' 
END
WHERE title IS NULL OR title = 'Untitled Note';
