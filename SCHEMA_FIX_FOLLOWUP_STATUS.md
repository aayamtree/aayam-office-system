-- Fix Follow-up Schema
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Optional: Ensure lead_id FK is loose for Speed Mode if not already done
-- ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_lead_id_fkey; -- Only if needed
