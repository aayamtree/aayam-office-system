-- Add client_id to follow_ups to allow tracking follow-ups for existing clients
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE CASCADE;

-- Ensure RLS is disabled for smooth operation
ALTER TABLE follow_ups DISABLE ROW LEVEL SECURITY;
