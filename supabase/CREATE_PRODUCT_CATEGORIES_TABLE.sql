-- Dynamic Product Categories Table
-- Allows admins to add new product categories on the fly
-- Each category links to production checklists

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add checklist_type column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_categories' 
    AND column_name = 'checklist_type'
  ) THEN
    ALTER TABLE product_categories ADD COLUMN checklist_type TEXT;
  END IF;
END $$;

-- Insert default categories (from existing hardcoded list)
INSERT INTO product_categories (name, checklist_type, is_active) VALUES
  ('Banner', 'Banner', true),
  ('Book', 'Book', true),
  ('Box', 'Box', true),
  ('Brochure', 'Brochure', true),
  ('Label', 'Label', true),
  ('Poster', 'Poster', true),
  ('Sticker', 'Label', true), -- Sticker uses Label checklist
  ('Other', NULL, true)
ON CONFLICT (name) DO NOTHING;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON product_categories(is_active);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_product_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_product_categories_updated_at();

-- Grant permissions
GRANT ALL ON product_categories TO authenticated;
GRANT ALL ON product_categories TO anon;

-- Disable RLS (or create appropriate policies)
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE product_categories IS 'Dynamic product categories with production checklist linkage';
