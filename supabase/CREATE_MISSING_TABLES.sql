-- =============================================
-- COMPLETE MARKETING & SYSTEM TABLES SCHEMA
-- =============================================
-- This creates all missing tables to match TypeScript types
-- Run this to fix schema mismatches causing silent failures

-- =============================================
-- 1. LEADS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_number TEXT UNIQUE NOT NULL,
  
  -- Contact Info
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  
  -- Lead Details
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  
  -- Marketing Workflow Fields
  lead_type TEXT CHECK (lead_type IN ('printing_only', 'designing_only', 'design_printing')),
  billing_preference TEXT CHECK (billing_preference IN ('gst', 'non_gst', 'both')),
  lost_reason TEXT,
  
  requirement TEXT,
  expected_value DECIMAL(12, 2) DEFAULT 0,
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  
  -- Follow-up Tracking
  next_follow_up TIMESTAMP,
  last_contacted TIMESTAMP,
  
  notes TEXT,
  
  -- Conversion
  converted_to_client_id UUID REFERENCES clients(id),
  
  -- Enhanced fields
  project_type TEXT,
  quantity INTEGER,
  estimated_amount DECIMAL(12, 2),
  deadline DATE,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_next_follow_up ON leads(next_follow_up);

-- =============================================
-- 2. FOLLOW-UPS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Link to lead or job
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  
  -- Follow-up Details
  follow_up_date TIMESTAMP NOT NULL,
  description TEXT,
  notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at TIMESTAMP,
  
  -- Contact Info
  contact_person TEXT,
  contact_method TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: Must link to either lead or job
  CONSTRAINT follow_up_link CHECK (
    (lead_id IS NOT NULL AND job_id IS NULL) OR
    (lead_id IS NULL AND job_id IS NOT NULL) OR
    (lead_id IS NULL AND job_id IS NULL AND quotation_id IS NOT NULL)
  )
);

CREATE INDEX idx_follow_ups_lead ON follow_ups(lead_id);
CREATE INDEX idx_follow_ups_job ON follow_ups(job_id);
CREATE INDEX idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX idx_follow_ups_assigned_to ON follow_ups(assigned_to);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);

-- =============================================
-- 3. QUOTATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_number TEXT UNIQUE NOT NULL,
  
  -- Links
  lead_id UUID REFERENCES leads(id),
  client_id UUID REFERENCES clients(id),
  
  -- Quotation Details
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  
  -- Line Items (JSONB)
  items JSONB DEFAULT '[]'::jsonb,
  
  -- Calculations
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_percentage DECIMAL(5, 2) DEFAULT 18.00,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  
  -- Terms & Conditions
  terms TEXT,
  notes TEXT,
  internal_notes TEXT,
  
  -- Conversion
  converted_to_job_id UUID REFERENCES jobs(id),
  converted_at TIMESTAMP,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quotations_lead ON quotations(lead_id);
CREATE INDEX idx_quotations_client ON quotations(client_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_date ON quotations(quotation_date);

-- =============================================
-- 4. DESIGN TASKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS design_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Links
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES design_projects(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id),
  
  -- Task Details
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'rework', 'completed')),
  
  -- Dates
  start_date DATE,
  due_date DATE,
  completed_date DATE,
  
  -- Time Tracking
  estimated_hours DECIMAL(5, 2),
  actual_hours DECIMAL(5, 2),
  
  -- Files
  files JSONB DEFAULT '[]'::jsonb,
  
  -- Remarks
  remarks JSONB DEFAULT '[]'::jsonb,
  
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_design_tasks_job ON design_tasks(job_id);
CREATE INDEX idx_design_tasks_assigned_to ON design_tasks(assigned_to);
CREATE INDEX idx_design_tasks_status ON design_tasks(status);
CREATE INDEX idx_design_tasks_due_date ON design_tasks(due_date);

-- =============================================
-- 5. DESIGN PROJECTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS design_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Project Details
  project_name TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  
  -- Status
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'review', 'on_hold', 'completed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Dates
  start_date DATE,
  deadline DATE,
  completed_date DATE,
  
  -- Assignment
  lead_designer UUID REFERENCES profiles(id),
  team_members UUID[],
  
  -- Budget
  estimated_hours DECIMAL(8, 2),
  actual_hours DECIMAL(8, 2),
  budget_amount DECIMAL(12, 2),
  
  -- Files & Assets
  files JSONB DEFAULT '[]'::jsonb,
  
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_design_projects_status ON design_projects(status);
CREATE INDEX idx_design_projects_lead_designer ON design_projects(lead_designer);

-- =============================================
-- 6. OTHER MISSING TABLES
-- =============================================

-- PURCHASE BILLS
CREATE TABLE IF NOT EXISTS purchase_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_number TEXT UNIQUE NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  bill_date DATE NOT NULL,
  due_date DATE,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  balance_due DECIMAL(12, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- BANK TRANSACTIONS
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT,
  transaction_type TEXT CHECK (transaction_type IN ('debit', 'credit')),
  amount DECIMAL(12, 2) NOT NULL,
  balance DECIMAL(12, 2),
  category TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- SALES ORDERS
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  order_date DATE NOT NULL,
  delivery_date DATE,
  items JSONB DEFAULT '[]'::jsonb,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- PAPER STOCK
CREATE TABLE IF NOT EXISTS paper_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_type TEXT NOT NULL,
  size TEXT NOT NULL,
  gsm INTEGER NOT NULL,
  quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'sheets',
  unit_price DECIMAL(10, 2),
  location TEXT,
  minimum_stock INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- JOB CHECKLISTS
CREATE TABLE IF NOT EXISTS job_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL,
  category TEXT CHECK (category IN ('design', 'dispatch')),
  items TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- USER CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS user_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK (event_type IN ('meeting', 'task', 'reminder', 'deadline', 'other')),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  all_day BOOLEAN DEFAULT FALSE,
  location TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'scheduled',
  color TEXT,
  recurrence_rule TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_user ON user_calendar_events(user_id);
CREATE INDEX idx_calendar_start ON user_calendar_events(start_time);

-- =============================================
-- AUTO-UPDATE TRIGGERS
-- =============================================

-- Leads
CREATE OR REPLACE FUNCTION update_leads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_update_timestamp
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_timestamp();

-- Follow-ups
CREATE TRIGGER follow_ups_update_timestamp
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_timestamp();

-- Quotations
CREATE TRIGGER quotations_update_timestamp
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_timestamp();

-- Design Tasks
CREATE TRIGGER design_tasks_update_timestamp
  BEFORE UPDATE ON design_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_timestamp();

-- Design Projects
CREATE TRIGGER design_projects_update_timestamp
  BEFORE UPDATE ON design_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_timestamp();

-- =============================================
-- RLS POLICIES
-- =============================================

-- LEADS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Marketing users can view their assigned leads"
  ON leads FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Admins can manage all leads"
  ON leads FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Marketing users can manage their assigned leads"
  ON leads FOR ALL
  TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- FOLLOW-UPS
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their follow-ups"
  ON follow_ups FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR 
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can manage their follow-ups"
  ON follow_ups FOR ALL
  TO authenticated
  USING (
    assigned_to = auth.uid() OR 
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- QUOTATIONS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view quotations"
  ON quotations FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins and marketing can manage quotations"
  ON quotations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'marketing')
    )
  );

-- DESIGN TASKS
ALTER TABLE design_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their design tasks"
  ON design_tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins and designers can manage tasks"
  ON design_tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'designer')
    )
  );

-- DESIGN PROJECTS
ALTER TABLE design_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view design projects"
  ON design_projects FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins and designers can manage projects"
  ON design_projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'designer')
    )
  );

-- SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE 'All marketing and system tables created successfully!';
  RAISE NOTICE 'Tables created: leads, follow_ups, quotations, design_tasks, design_projects, and more';
  RAISE NOTICE 'RLS policies applied for role-based access';
END $$;
