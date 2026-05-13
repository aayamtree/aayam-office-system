-- =====================================================
-- JOB CONFIGURATION TABLES
-- =====================================================
-- Creates database-driven configuration tables to replace
-- hardcoded dropdowns in the job management system.
-- 
-- Tables Created:
--   1. job_types - Types of jobs (Design Only, Print Only, etc.)
--   2. product_types - Product types for print planner batching
--   3. priorities - Job priority levels with colors
--   4. job_stages - Job workflow stages with colors and order
--
-- Run this ONCE in Supabase SQL Editor
-- =====================================================

-- Drop existing if re-running (CASCADE to handle dependencies)
DROP TABLE IF EXISTS job_types CASCADE;
DROP TABLE IF EXISTS product_types CASCADE;
DROP TABLE IF EXISTS priorities CASCADE;
DROP TABLE IF EXISTS job_stages CASCADE;

-- =====================================================
-- 1. JOB TYPES TABLE
-- =====================================================
CREATE TABLE job_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT job_type_name_not_empty CHECK (trim(name) != '')
);

-- Create index for active lookups
CREATE INDEX idx_job_types_active ON job_types(is_active) WHERE is_active = true;

-- Insert default job types (NO "Other"!)
INSERT INTO job_types (name, description) VALUES
  ('Design Only', 'Design work without print production'),
  ('Print Only', 'Printing without design work'),
  ('Design + Print', 'Complete service including design and print'),
  ('Packaging', 'Packaging and finishing work'),
  ('Branding', 'Brand identity and marketing materials');

-- =====================================================
-- 2. PRODUCT TYPES TABLE (for Print Planner)
-- =====================================================
CREATE TABLE product_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT product_type_name_not_empty CHECK (trim(name) != ''),
  CONSTRAINT product_type_name_uppercase CHECK (name = UPPER(name))  -- Force uppercase
);

-- Create index for active lookups
CREATE INDEX idx_product_types_active ON product_types(is_active) WHERE is_active = true;

-- Insert default product types (NO "OTHER"!)
INSERT INTO product_types (name, description) VALUES
  ('STICKER', 'Vinyl and paper stickers'),
  ('POUCH', 'Pouches and bags'),
  ('BOX', 'Boxes and cartons'),
  ('BANNER', 'Banners and signage'),
  ('FLEX', 'Flex printing'),
  ('VINYL', 'Vinyl printing'),
  ('LABEL', 'Labels and tags'),
  ('BOOK', 'Books and booklets'),
  ('BROCHURE', 'Brochures and catalogs');

-- =====================================================
-- 3. PRIORITIES TABLE
-- =====================================================
CREATE TABLE priorities (
  id TEXT PRIMARY KEY,  -- TEXT for backward compatibility: 'low', 'normal', 'high', 'urgent'
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,  -- Tailwind classes: 'bg-gray-100 text-gray-600'
  order_index INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT priority_id_lowercase CHECK (id = LOWER(id)),
  CONSTRAINT priority_name_not_empty CHECK (trim(name) != ''),
  CONSTRAINT priority_color_not_empty CHECK (trim(color) != ''),
  CONSTRAINT priority_order_positive CHECK (order_index > 0)
);

-- Create indexes
CREATE INDEX idx_priorities_active ON priorities(is_active) WHERE is_active = true;
CREATE INDEX idx_priorities_order ON priorities(order_index);

-- Insert default priorities
INSERT INTO priorities (id, name, color, order_index) VALUES
  ('low', 'Low', 'bg-gray-100 text-gray-600', 1),
  ('normal', 'Normal', 'bg-blue-100 text-blue-600', 2),
  ('high', 'High', 'bg-orange-100 text-orange-600', 3),
  ('urgent', 'Urgent', 'bg-red-100 text-red-600', 4);

-- =====================================================
-- 4. JOB STAGES TABLE
-- =====================================================
CREATE TABLE job_stages (
  id TEXT PRIMARY KEY,  -- TEXT for backward compatibility: 'new', 'designing', etc.
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,         -- Main color: 'bg-gray-500'
  bg_light TEXT NOT NULL,      -- Light background: 'bg-gray-50'
  border TEXT NOT NULL,        -- Border color: 'border-gray-200'
  order_index INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT stage_id_lowercase CHECK (id = LOWER(id)),
  CONSTRAINT stage_name_not_empty CHECK (trim(name) != ''),
  CONSTRAINT stage_color_not_empty CHECK (trim(color) != ''),
  CONSTRAINT stage_bg_light_not_empty CHECK (trim(bg_light) != ''),
  CONSTRAINT stage_border_not_empty CHECK (trim(border) != ''),
  CONSTRAINT stage_order_positive CHECK (order_index > 0)
);

-- Create indexes
CREATE INDEX idx_job_stages_active ON job_stages(is_active) WHERE is_active = true;
CREATE INDEX idx_job_stages_order ON job_stages(order_index);

-- Insert default job stages (matching current Kanban workflow)
INSERT INTO job_stages (id, name, color, bg_light, border, order_index) VALUES
  ('new', 'New', 'bg-gray-500', 'bg-gray-50', 'border-gray-200', 1),
  ('designing', 'Design', 'bg-purple-500', 'bg-purple-50', 'border-purple-200', 2),
  ('approval', 'Approval', 'bg-yellow-500', 'bg-yellow-50', 'border-yellow-200', 3),
  ('printing', 'Print', 'bg-blue-500', 'bg-blue-50', 'border-blue-200', 4),
  ('finishing', 'Post Print', 'bg-cyan-500', 'bg-cyan-50', 'border-cyan-200', 5),
  ('quality_check', 'QC Check', 'bg-emerald-500', 'bg-emerald-50', 'border-emerald-200', 6),
  ('ready', 'Ready', 'bg-indigo-500', 'bg-indigo-50', 'border-indigo-200', 7),
  ('dispatched', 'Dispatched', 'bg-orange-500', 'bg-orange-50', 'border-orange-200', 8),
  ('delivered', 'Delivered', 'bg-green-500', 'bg-green-50', 'border-green-200', 9);

-- =====================================================
-- AUTO-UPDATE TRIGGERS
-- =====================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all config tables
CREATE TRIGGER job_types_updated_at
  BEFORE UPDATE ON job_types
  FOR EACH ROW EXECUTE FUNCTION update_config_updated_at();

CREATE TRIGGER product_types_updated_at
  BEFORE UPDATE ON product_types
  FOR EACH ROW EXECUTE FUNCTION update_config_updated_at();

CREATE TRIGGER priorities_updated_at
  BEFORE UPDATE ON priorities
  FOR EACH ROW EXECUTE FUNCTION update_config_updated_at();

CREATE TRIGGER job_stages_updated_at
  BEFORE UPDATE ON job_stages
  FOR EACH ROW EXECUTE FUNCTION update_config_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE job_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_stages ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read configuration (needed for dropdowns)
CREATE POLICY "Anyone can view job types"
  ON job_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view product types"
  ON product_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view priorities"
  ON priorities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view job stages"
  ON job_stages FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can insert/update/delete
-- (Adjust based on your role system if needed)
CREATE POLICY "Authenticated users can manage job types"
  ON job_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage product types"
  ON product_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage priorities"
  ON priorities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage job stages"
  ON job_stages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify data was inserted correctly:

-- SELECT * FROM job_types ORDER BY name;
-- SELECT * FROM product_types ORDER BY name;
-- SELECT * FROM priorities ORDER BY order_index;
-- SELECT * FROM job_stages ORDER BY order_index;

-- =====================================================
-- MIGRATION COMPLETE! ✅
-- =====================================================
-- Next Steps:
-- 1. Create Quick-Add modal components for each table
-- 2. Update job form to load from these tables
-- 3. Add +Add buttons next to each dropdown
-- 4. Remove hardcoded arrays from code
-- =====================================================
