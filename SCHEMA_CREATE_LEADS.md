-- =========================================================
-- COMPLETE LEADS TABLE SETUP (CORRECTED)
-- =========================================================

-- 1. Create Leads Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_number text UNIQUE,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  source text DEFAULT 'website',
  status text DEFAULT 'new',
  
  -- Marketing Module Fields
  lead_type text,
  billing_preference text,
  lost_reason text,
  
  requirement text,
  expected_value numeric DEFAULT 0,
  
  assigned_to uuid REFERENCES profiles(id),
  
  next_follow_up timestamptz,
  last_contacted timestamptz,
  
  notes text,
  
  converted_to_client_id uuid REFERENCES clients(id),
  
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create Follow Ups Table (History)
CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  follow_up_date timestamptz DEFAULT now(),
  follow_up_type text,
  notes text,
  outcome text,
  next_follow_up timestamptz,
  done_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 3. Enable Security Policies (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- 4. Create Access Policies

-- Drop existing policies to prevent errors if re-running
DROP POLICY IF EXISTS "Admin All Access" ON leads;
DROP POLICY IF EXISTS "Marketer Own Access" ON leads;
DROP POLICY IF EXISTS "FollowUps All Access" ON follow_ups;
DROP POLICY IF EXISTS "Users see own or assigned leads" ON leads;

-- Admin/Manager: Full Access
CREATE POLICY "Admin All Access" ON leads FOR ALL USING (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);

-- Marketing: View/Edit Own Leads
CREATE POLICY "Marketer Own Access" ON leads FOR ALL USING (
  created_by = auth.uid() OR assigned_to = auth.uid() OR 
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales'))
);

-- FollowUps: Allow access
CREATE POLICY "FollowUps All Access" ON follow_ups FOR ALL USING (true);

-- 5. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);

-- 6. Initialize Counter for Lead Numbers (CORRECTED COLUMN NAME)
INSERT INTO counters (id, current_number, prefix) VALUES ('lead', 0, 'LD') ON CONFLICT (id) DO NOTHING;
