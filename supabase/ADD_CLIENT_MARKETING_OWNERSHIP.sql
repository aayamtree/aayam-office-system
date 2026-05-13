-- ============================================================
-- ADD MARKETING OWNERSHIP COLUMNS TO CLIENTS TABLE
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add assigned_marketing_user_id column
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS assigned_marketing_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Add source_lead_id for traceability
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

-- 3. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_clients_marketing_user ON clients(assigned_marketing_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_source ON clients(source);
CREATE INDEX IF NOT EXISTS idx_clients_source_lead ON clients(source_lead_id);

-- 4. Fix existing clients: if created_by is a marketing user, set source = 'marketing'
UPDATE clients c
SET 
  source = 'marketing',
  assigned_marketing_user_id = c.created_by
WHERE c.created_by IN (
  SELECT id FROM profiles WHERE role = 'marketing'
)
AND (c.source IS NULL OR c.source = 'direct');

-- 5. Fix existing clients converted from leads: link source_lead_id
UPDATE clients c
SET 
  source = 'marketing',
  source_lead_id = l.id,
  assigned_marketing_user_id = COALESCE(l.assigned_to, l.created_by)
FROM leads l
WHERE l.converted_to_client_id = c.id
AND (c.source IS NULL OR c.source = 'direct');

-- Verify
SELECT 
  c.name,
  c.source,
  p.full_name AS marketing_person,
  c.source_lead_id
FROM clients c
LEFT JOIN profiles p ON c.assigned_marketing_user_id = p.id
ORDER BY c.source, c.name;
