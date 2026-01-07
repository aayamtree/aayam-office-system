-- =========================================================
-- COMPLETE SYSTEM REPAIR SCRIPT
-- Fixes: Leads Table Missing AND Counters UUID/Text Mismatch
-- =========================================================

-- PART 1: LEADS & FOLLOW-UPS (If not exist)
CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_number text UNIQUE,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  source text DEFAULT 'website',
  status text DEFAULT 'new',
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

-- Access Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin All Access" ON leads;
DROP POLICY IF EXISTS "Marketer Own Access" ON leads;
DROP POLICY IF EXISTS "FollowUps All Access" ON follow_ups;

CREATE POLICY "Admin All Access" ON leads FOR ALL USING (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
CREATE POLICY "Marketer Own Access" ON leads FOR ALL USING (
  created_by = auth.uid() OR assigned_to = auth.uid() OR 
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales'))
);
CREATE POLICY "FollowUps All Access" ON follow_ups FOR ALL USING (true);


-- PART 2: COUNTERS REPAIR (The Fix for UUID Error)
-- The error "invalid input syntax for type uuid" happened because the 'counters' table
-- was created with 'id' as UUID, but the app uses text keys like 'job', 'lead'.

-- A. Drop the broken table and RPC
DROP TABLE IF EXISTS counters;
DROP FUNCTION IF EXISTS get_next_number;

-- B. Re-create Counters with Text ID
CREATE TABLE counters (
  id text PRIMARY KEY, -- 'job', 'lead', etc.
  current_number integer DEFAULT 0,
  prefix text,
  updated_at timestamptz DEFAULT now()
);

-- C. Insert Initial Values
INSERT INTO counters (id, current_number, prefix) VALUES 
('lead', 0, 'LD'),
('job', 0, 'AAY'),
('invoice', 0, 'INV'),
('quotation', 0, 'QT'),
('task', 0, 'TSK'),
('purchase_bill', 0, 'PB'),
('vendor_payment', 0, 'VP');

-- D. Re-create the Helper Function
CREATE OR REPLACE FUNCTION get_next_number(counter_id text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_val integer;
  code_prefix text;
BEGIN
  -- Increment count
  UPDATE counters 
  SET current_number = current_number + 1, updated_at = now()
  WHERE id = counter_id
  RETURNING current_number, prefix INTO next_val, code_prefix;
  
  -- Return Format: PREFIX-NUMBER (e.g. LD-1, AAY-105)
  IF next_val IS NULL THEN
     RETURN NULL; 
  END IF;
  
  RETURN code_prefix || '-' || next_val;
END;
$$;
