-- ============================================
-- UPGRADE NOTES TABLE
-- ============================================
-- Adds title, tagged_users columns to support
-- dashboard Quick Notes with @mention tagging

-- Add title column
ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT;

-- Add tagged_users column (UUID array for @mentions)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS tagged_users UUID[] DEFAULT '{}';

-- Disable RLS for simplicity
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;

-- Verify
DO $$
BEGIN
    RAISE NOTICE '✅ Notes table upgraded:';
    RAISE NOTICE '   - title (TEXT)';
    RAISE NOTICE '   - tagged_users (UUID[])';
    RAISE NOTICE '   - RLS disabled';
END $$;
