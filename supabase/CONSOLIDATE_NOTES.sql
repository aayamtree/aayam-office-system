-- =============================================
-- CONSOLIDATE NOTES TABLES
-- Merges `designer_notes` into `notes` table
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add missing columns to `notes` table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS note_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS mentioned_users UUID[] DEFAULT '{}';

-- 2. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_notes_shared_with ON notes USING GIN (shared_with);
CREATE INDEX IF NOT EXISTS idx_notes_mentioned ON notes USING GIN (mentioned_users);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

-- 3. Migrate data from designer_notes → notes (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'designer_notes') THEN
        INSERT INTO notes (user_id, title, content, shared_with, note_date, created_at, updated_at)
        SELECT
            user_id,
            title,
            content,
            COALESCE(shared_with, '{}'),
            COALESCE(note_date, CURRENT_DATE),
            COALESCE(created_at, now()),
            COALESCE(created_at, now())
        FROM designer_notes;
        
        RAISE NOTICE '✅ Migrated designer_notes into notes table';
    ELSE
        RAISE NOTICE '⚠️ designer_notes table does not exist, skipping migration';
    END IF;
END $$;

-- 4. Disable RLS on notes (already disabled, ensuring it stays that way)
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;

-- 5. Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'notes' 
ORDER BY ordinal_position;
