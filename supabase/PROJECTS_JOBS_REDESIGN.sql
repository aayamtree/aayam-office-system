-- =============================================
-- PROJECTS & JOBS REDESIGN - DATABASE MIGRATION
-- =============================================
-- Purpose: Implement centralized data management, Print Planner container architecture
-- Date: January 29, 2026
-- Related: implementation_plan.md

-- =============================================
-- PART 1: CENTRALIZED CONFIGURATION TABLES
-- =============================================

-- Machines (Offset, Digital, Flex, etc.)
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Initial data
INSERT INTO machines (name, description) VALUES
  ('Offset', 'Offset printing machine'),
  ('Digital', 'Digital printing machine'),
  ('Flex', 'Flex printing machine')
ON CONFLICT (name) DO NOTHING;

-- Sheet Sizes
CREATE TABLE IF NOT EXISTS sheet_sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  size TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Initial data
INSERT INTO sheet_sizes (size, description) VALUES
  ('23x36', 'Standard large sheet'),
  ('20x30', 'Medium sheet'),
  ('18x24', 'Small sheet'),
  ('Custom', 'Custom size - specify in notes')
ON CONFLICT (size) DO NOTHING;

-- Materials
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Initial data
INSERT INTO materials (name, description) VALUES
  ('Art Card 300 GSM', 'Premium card stock'),
  ('Art Paper 170 GSM', 'Standard art paper'),
  ('Maplitho', 'Maplitho paper'),
  ('Vinyl', 'Vinyl material for flex'),
  ('Board', 'Cardboard material'),
  ('Sticker Paper', 'Self-adhesive paper')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- PART 2: PRODUCT CATEGORIES
-- =============================================

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  production_checklist_id UUID, -- Will link to production checklists when available
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initial data
INSERT INTO product_categories (name, description) VALUES
  ('Box', 'Packaging boxes'),
  ('Pouch', 'Pouches and bags'),
  ('Brochure', 'Brochures and catalogs'),
  ('Label', 'Product labels'),
  ('Sticker', 'Stickers and decals'),
  ('Visiting Card', 'Business cards'),
  ('Flyer', 'Promotional flyers'),
  ('Banner', 'Banners and signage'),
  ('Letterhead', 'Company letterheads'),
  ('Envelope', 'Envelopes'),
  ('Invitation Card', 'Invitation cards'),
  ('Other', 'Other printing products')
ON CONFLICT (name) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_product_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_product_categories_updated_at();

-- =============================================
-- PART 3: PRINT PLANNER SYSTEM
-- =============================================

-- Print Runs (Master/Container)
CREATE TABLE IF NOT EXISTS print_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  print_run_number TEXT UNIQUE NOT NULL,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  sheet_size_id UUID REFERENCES sheet_sizes(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'printed', 'delivered')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Print Run auto-number function
CREATE OR REPLACE FUNCTION generate_print_run_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Get the highest number
  SELECT COALESCE(MAX(CAST(SUBSTRING(print_run_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM print_runs;
  
  -- Format as PP-00001
  new_number := 'PP-' || LPAD(next_number::TEXT, 5, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate print run number
CREATE OR REPLACE FUNCTION set_print_run_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.print_run_number IS NULL OR NEW.print_run_number = '' THEN
    NEW.print_run_number := generate_print_run_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER print_runs_set_number
  BEFORE INSERT ON print_runs
  FOR EACH ROW
  EXECUTE FUNCTION set_print_run_number();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_print_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER print_runs_updated_at
  BEFORE UPDATE ON print_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_print_runs_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_print_runs_status ON print_runs(status);
CREATE INDEX IF NOT EXISTS idx_print_runs_created_by ON print_runs(created_by);
CREATE INDEX IF NOT EXISTS idx_print_runs_created_at ON print_runs(created_at);

-- =============================================
-- PART 4: PRINT RUN JOBS (MAPPING TABLE)
-- =============================================

CREATE TABLE IF NOT EXISTS print_run_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  print_run_id UUID REFERENCES print_runs(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  -- Denormalized fields for fast search/display
  client_name TEXT,
  item_name TEXT,
  qty_on_sheet INTEGER,
  file_version TEXT DEFAULT 'v1',
  notes TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(print_run_id, job_id)
);

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_print_run_jobs_print_run ON print_run_jobs(print_run_id);
CREATE INDEX IF NOT EXISTS idx_print_run_jobs_job ON print_run_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_print_run_jobs_client ON print_run_jobs(client_name);
CREATE INDEX IF NOT EXISTS idx_print_run_jobs_item ON print_run_jobs(item_name);

-- =============================================
-- PART 5: UPDATE JOBS TABLE
-- =============================================

-- Add new columns to jobs table
DO $$ 
BEGIN
  -- Job type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'job_type') THEN
    ALTER TABLE jobs ADD COLUMN job_type TEXT CHECK (job_type IN ('print_only', 'design_only', 'design_print'));
  END IF;

  -- Product category
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'product_category_id') THEN
    ALTER TABLE jobs ADD COLUMN product_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;
  END IF;

  -- Client approval
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'client_approval') THEN
    ALTER TABLE jobs ADD COLUMN client_approval BOOLEAN DEFAULT FALSE;
  END IF;

  -- Approval date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'approval_date') THEN
    ALTER TABLE jobs ADD COLUMN approval_date TIMESTAMP;
  END IF;

  -- Print ready status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'print_ready') THEN
    ALTER TABLE jobs ADD COLUMN print_ready BOOLEAN DEFAULT FALSE;
  END IF;

  -- File version
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'file_version') THEN
    ALTER TABLE jobs ADD COLUMN file_version TEXT DEFAULT 'v1';
  END IF;

  -- GST percentage for financial calculations
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'gst_percentage') THEN
    ALTER TABLE jobs ADD COLUMN gst_percentage DECIMAL(5,2) DEFAULT 18.00;
  END IF;

  -- Base price (without GST)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'base_price') THEN
    ALTER TABLE jobs ADD COLUMN base_price DECIMAL(12,2);
  END IF;

  -- Total amount (with GST)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'total_amount') THEN
    ALTER TABLE jobs ADD COLUMN total_amount DECIMAL(12,2);
  END IF;
END $$;

-- Create index on product_category_id
CREATE INDEX IF NOT EXISTS idx_jobs_product_category ON jobs(product_category_id);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_print_ready ON jobs(print_ready);
CREATE INDEX IF NOT EXISTS idx_jobs_client_approval ON jobs(client_approval);

-- =============================================
-- PART 6: RLS POLICIES
-- =============================================

-- Enable RLS on new tables
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_run_jobs ENABLE ROW LEVEL SECURITY;

-- Configuration tables: Read for all authenticated, Write for admin only
CREATE POLICY "Anyone can view machines" ON machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage machines" ON machines FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Anyone can view sheet_sizes" ON sheet_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage sheet_sizes" ON sheet_sizes FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Anyone can view materials" ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage materials" ON materials FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Anyone can view product_categories" ON product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage product_categories" ON product_categories FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Print Runs: Read for all, Write for admin/production
CREATE POLICY "Anyone can view print_runs" ON print_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage print_runs" ON print_runs FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'production')));

-- Print Run Jobs: Read for all, Write for admin/production
CREATE POLICY "Anyone can view print_run_jobs" ON print_run_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage print_run_jobs" ON print_run_jobs FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'production')));

-- =============================================
-- PART 7: HELPER FUNCTIONS
-- =============================================

-- Function to get production summary (for live updates)
CREATE OR REPLACE FUNCTION get_production_summary()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'design_stage', (SELECT COUNT(*) FROM jobs WHERE current_stage = 'design' AND status != 'completed'),
    'print_ready', (SELECT COUNT(*) FROM jobs WHERE print_ready = true AND client_approval = true),
    'awaiting_approval', (SELECT COUNT(*) FROM jobs WHERE client_approval = false AND current_stage IN ('design', 'revision')),
    'high_priority', (SELECT COUNT(*) FROM jobs WHERE priority = 'high' AND status != 'completed'),
    'in_production', (SELECT COUNT(*) FROM jobs WHERE current_stage = 'production'),
    'total_active', (SELECT COUNT(*) FROM jobs WHERE status = 'active')
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get jobs eligible for Print Planner
CREATE OR REPLACE FUNCTION get_print_planner_eligible_jobs()
RETURNS TABLE (
  job_id UUID,
  client_name TEXT,
  project_name TEXT,
  product_category TEXT,
  quantity INTEGER,
  file_version TEXT,
  approval_date TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    c.name,
    j.project_name,
    pc.name,
    j.quantity,
    j.file_version,
    j.approval_date
  FROM jobs j
  LEFT JOIN clients c ON j.client_id = c.id
  LEFT JOIN product_categories pc ON j.product_category_id = pc.id
  WHERE j.print_ready = true 
    AND j.client_approval = true
    AND j.job_type IN ('print_only', 'design_print')
    AND j.id NOT IN (SELECT job_id FROM print_run_jobs)
  ORDER BY j.approval_date DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- Run this script in Supabase SQL Editor
-- Then verify:
-- 1. All tables created successfully
-- 2. Initial data populated
-- 3. Triggers working (try inserting a print_run without number)
-- 4. RLS policies active
