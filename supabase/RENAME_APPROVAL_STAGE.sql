-- Rename 'approval' stage display name in job_stages table
-- The stage ID stays as 'approval' — only the display name changes
-- Run this in Supabase SQL Editor

UPDATE job_stages 
SET name = 'Awaiting Client Approval' 
WHERE id = 'approval';

-- Verify the change
SELECT id, name, order_index FROM job_stages ORDER BY order_index;
