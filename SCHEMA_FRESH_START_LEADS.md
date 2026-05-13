-- =======================================================
-- FRESH START: LEADS MODULE
-- Run this script to completely RESET the Leads database.
-- =======================================================

-- 1. CLEANUP (Drop existing tables to remove corruption/conflicts)
DROP TABLE IF EXISTS follow_ups CASCADE;
DROP TABLE IF EXISTS leads CASCADE;

-- 2. CREATE LEADS TABLE
CREATE TABLE leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_number text UNIQUE, -- e.g. LD-1
  
  -- Core Details
  name text NOT NULL,
  company text,
  email text,
  phone text,
  
  -- Status & Classification
  source text DEFAULT 'website',
  status text DEFAULT 'new', -- new, contacted, quotation_shared, converted, lost
  lead_type text,            -- printing_only, designing_only
  
  -- Commercials
  billing_preference text,   -- gst, non_gst
  expected_value numeric DEFAULT 0,
  
  -- Details
  requirement text,
  notes text,
  
  -- Logic Fields
  lost_reason text,
  next_follow_up timestamptz,
  last_contacted timestamptz,
  
  -- Links
  created_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  converted_to_client_id uuid REFERENCES clients(id),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. CREATE FOLLOW_UPS (History)
CREATE TABLE follow_ups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  follow_up_date timestamptz DEFAULT now(),
  notes text,
  done_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 4. PERMISSIONS (RLS)
-- We set this to "Authenticated" to ensure saving ALWAYS works for logged-in users.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable All Access for Users" ON leads 
  FOR ALL USING (auth.role() = 'authenticated');
  
CREATE POLICY "Enable All Access for FollowUps" ON follow_ups 
  FOR ALL USING (auth.role() = 'authenticated');


-- 5. COUNTERS (System ID Generation)
-- Ensure the counters table exists and has the LEAD counter (LD-...)
CREATE TABLE IF NOT EXISTS counters (
  id text PRIMARY KEY,
  current_number integer DEFAULT 0,
  prefix text,
  updated_at timestamptz DEFAULT now()
);

-- Reset/Ensure Lead Counter starts fresh or exists
INSERT INTO counters (id, current_number, prefix) 
VALUES ('lead', 0, 'LD')
ON CONFLICT (id) DO UPDATE SET prefix = 'LD';

-- Helper to get next number
CREATE OR REPLACE FUNCTION get_next_number(counter_id text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_val integer;
  code_prefix text;
BEGIN
  UPDATE counters 
  SET current_number = current_number + 1, updated_at = now()
  WHERE id = counter_id
  RETURNING current_number, prefix INTO next_val, code_prefix;
  
  RETURN code_prefix || '-' || next_val;
END;
$$;
