-- =============================================
-- DESIGNER HOURS TABLE + RLS
-- Creates designer_hours table (if not exists)
-- and sets up RLS policies
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS designer_hours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id uuid NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    hours_worked numeric DEFAULT 0,
    overtime_hours numeric DEFAULT 0,
    notes text,
    task_id uuid REFERENCES design_tasks(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE designer_hours ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any (safe to re-run)
DROP POLICY IF EXISTS "Authenticated users can read designer_hours" ON designer_hours;
DROP POLICY IF EXISTS "Admin and designers can insert designer_hours" ON designer_hours;
DROP POLICY IF EXISTS "Admin and designers can update designer_hours" ON designer_hours;
DROP POLICY IF EXISTS "Admin and designers can delete designer_hours" ON designer_hours;

-- 4. Read: all authenticated users
CREATE POLICY "Authenticated users can read designer_hours"
ON designer_hours FOR SELECT
TO authenticated
USING (true);

-- 5. Insert: all authenticated users
CREATE POLICY "Admin and designers can insert designer_hours"
ON designer_hours FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Update: all authenticated users
CREATE POLICY "Admin and designers can update designer_hours"
ON designer_hours FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Delete: all authenticated users
CREATE POLICY "Admin and designers can delete designer_hours"
ON designer_hours FOR DELETE
TO authenticated
USING (true);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_designer_hours_designer_id ON designer_hours(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_hours_date ON designer_hours(date);
CREATE INDEX IF NOT EXISTS idx_designer_hours_task_id ON designer_hours(task_id);
