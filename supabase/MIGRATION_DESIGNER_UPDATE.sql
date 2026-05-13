-- Add missing columns to support the Designer Dashboard features
ALTER TABLE design_tasks 
ADD COLUMN IF NOT EXISTS drive_link text,
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS remarks jsonb DEFAULT '[]';

-- Ensure RLS allows updates
ALTER TABLE design_tasks ENABLE ROW LEVEL SECURITY;

-- Allow users to UPDATE tasks if they are assigned to it OR if they are admins
CREATE POLICY "Allow update own tasks" ON design_tasks
FOR UPDATE
USING (auth.uid() = assigned_to OR EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));
