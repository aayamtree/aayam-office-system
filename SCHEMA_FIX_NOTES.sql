-- 1. Ensure 'is_pinned' column exists (Pinning Feature)
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 2. Ensure 'linked_job_id' column exists (Likning Feature)
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS linked_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- 3. Ensure 'color' column exists
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow';

-- 4. Ensure reminders have optional due_date
ALTER TABLE reminders 
ALTER COLUMN due_date DROP NOT NULL;

-- 5. Force refresh schema cache (sometimes needed for Supabase to pick up new columns)
NOTIFY pgrst, 'reload schema';
