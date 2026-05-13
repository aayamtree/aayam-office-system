-- Quick debug: Check what follow-ups exist for marketing1
SELECT 
  f.id,
  f.follow_up_date,
  f.notes,
  f.lead_id,
  f.done_by,
  l.name as lead_name,
  l.assigned_to as lead_owner,
  p.email as owner_email
FROM follow_ups f
LEFT JOIN leads l ON f.lead_id = l.id
LEFT JOIN profiles p ON l.assigned_to = p.id
ORDER BY f.created_at DESC;

-- Get marketing1 user ID
SELECT id, email FROM profiles WHERE email = 'marketing1@aayam.internal';
