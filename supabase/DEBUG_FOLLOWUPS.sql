-- =============================================
-- DEBUG: Check Follow-ups Data
-- Run this in Supabase SQL Editor to see what's in your follow_ups table
-- =============================================

-- 1. Show all follow-ups
SELECT 
  id,
  lead_id,
  client_id,
  follow_up_date,
  notes,
  done_by,
  created_at
FROM follow_ups
ORDER BY created_at DESC
LIMIT 20;

-- 2. Check follow-ups with lead names
SELECT 
  f.id,
  f.follow_up_date,
  f.notes,
  l.name as lead_name,
  l.company as lead_company,
  l.assigned_to as lead_owner
FROM follow_ups f
LEFT JOIN leads l ON f.lead_id = l.id
ORDER BY f.created_at DESC
LIMIT 20;

-- 3. Count total follow-ups
SELECT COUNT(*) as total_followups FROM follow_ups;

-- 4. Count follow-ups due today or earlier
SELECT COUNT(*) as followups_due 
FROM follow_ups 
WHERE follow_up_date <= NOW();

-- 5. Show leads with next_follow_up set
SELECT 
  lead_number,
  name,
  company,
  next_follow_up,
  status,
  assigned_to
FROM leads
WHERE next_follow_up IS NOT NULL
ORDER BY next_follow_up;
