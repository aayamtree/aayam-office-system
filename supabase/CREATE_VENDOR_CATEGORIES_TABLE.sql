-- Create vendor_categories table for dynamic vendor categorization
-- Replaces hardcoded "Other" options with database-driven categories

-- Create table
CREATE TABLE IF NOT EXISTS vendor_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories (no "Other"!)
INSERT INTO vendor_categories (name, description) VALUES
  ('Paper', 'Paper suppliers and merchants'),
  ('Printing', 'Printing service providers'),
  ('Binding', 'Binding and finishing services'),
  ('Packaging', 'Packaging material suppliers'),
  ('Logistics', 'Transportation and logistics'),
  ('IT', 'IT services and software')
ON CONFLICT (name) DO NOTHING;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vendor_categories_active 
ON vendor_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_vendor_categories_name 
ON vendor_categories(name);

-- Update timestamp trigger
DROP TRIGGER IF EXISTS trigger_vendor_categories_updated_at ON vendor_categories;
DROP FUNCTION IF EXISTS update_vendor_categories_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_vendor_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vendor_categories_updated_at
  BEFORE UPDATE ON vendor_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_categories_updated_at();

-- Add comment
COMMENT ON TABLE vendor_categories IS 'Dynamic vendor categories - admin configurable via VendorCategoryQuickAdd modal';
