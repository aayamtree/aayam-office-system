-- Add 'source' column to clients table
-- Run this in Supabase SQL Editor

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'direct' 
CHECK (source IN ('direct', 'marketing', 'referral', 'walk_in', 'online'));

-- For existing clients: try to detect source from profiles table
-- If the creator is a marketing-role user, mark as 'marketing', else 'direct'
UPDATE clients c
SET source = 'marketing'
FROM profiles p
WHERE c.created_by = p.id
  AND p.role IN ('marketing', 'sales');

-- All others stay as 'direct' (the default)

-- Verify
SELECT source, COUNT(*) FROM clients GROUP BY source ORDER BY source;
