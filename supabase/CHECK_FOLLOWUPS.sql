-- Quick check: Do you have ANY follow-ups in database?
SELECT COUNT(*) as total_follow_ups FROM follow_ups;

-- Check follow-ups with lead info
SELECT 
  f.id,
  f.follow_up_date,
  f.notes,
  l.name as lead_name,
  l.assigned_to as lead_owner_id,
  p.email as owner_email,
  f.done_by,
  f.created_at
FROM follow_ups f
LEFT JOIN leads l ON f.lead_id = l.id
LEFT JOIN profiles p ON l.assigned_to = p.id
ORDER BY f.created_at DESC
LIMIT 10;
