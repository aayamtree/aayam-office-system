-- =============================================
-- SIMPLE MARKETING TABLES - CRITICAL ONLY
-- =============================================
-- Creates only the essential tables needed for marketing system
-- No complex dependencies or foreign keys to non-existent tables

-- 1. LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  requirement TEXT,
  expected_value DECIMAL(12, 2) DEFAULT 0,
  assigned_to UUID,
  next_follow_up TIMESTAMP,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. FOLLOW-UPS TABLE  
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID,
  follow_up_date TIMESTAMP NOT NULL,
  description TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_number TEXT UNIQUE NOT NULL,
  lead_id UUID,
  client_id UUID,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft',
  items JSONB DEFAULT '[]'::jsonb,
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_percentage DECIMAL(5, 2) DEFAULT 18.00,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations(lead_id);

-- Simple RLS - everyone can access for now
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_leads" ON leads FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "allow_all_followups" ON follow_ups FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "allow_all_quotations" ON quotations FOR ALL TO authenticated USING (TRUE);

-- Success
SELECT 'Marketing table created successfully!' AS status;
