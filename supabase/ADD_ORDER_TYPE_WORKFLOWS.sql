-- =============================================
-- ORDER TYPE WORKFLOWS & PRODUCT REQUIREMENTS
-- =============================================
-- This migration adds support for different order types and
-- product requirement collection for Design + Print orders

-- Add order_type to quotations table
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'print' CHECK (order_type IN ('print', 'design', 'design_print'));

-- Add product_category to quotations (for Design + Print)
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS product_category TEXT;

-- Create product_requirements table
CREATE TABLE IF NOT EXISTS product_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  
  -- Product Details
  product_category TEXT NOT NULL CHECK (product_category IN ('box', 'pouch', 'label', 'sticker', 'other')),
  product_name TEXT,
  
  -- Packaging-specific fields (JSONB for flexibility)
  -- Example: {dimensions: "10x5x3", material: "Cardboard", coating: "Glossy", quantity: 1000}
  specifications JSONB DEFAULT '{}'::jsonb,
  
  -- Workflow tracking
  collected_by UUID REFERENCES profiles(id),
  collected_at TIMESTAMPTZ,
  forwarded_to_design BOOLEAN DEFAULT FALSE,
  forwarded_at TIMESTAMPTZ,
  
  -- Reference files uploaded by marketing
  reference_files TEXT[] DEFAULT '{}',
  
  -- Notes from marketing team
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_product_requirements_job ON product_requirements(job_id);
CREATE INDEX IF NOT EXISTS idx_product_requirements_quotation ON product_requirements(quotation_id);
CREATE INDEX IF NOT EXISTS idx_product_requirements_category ON product_requirements(product_category);

-- Enable RLS
ALTER TABLE product_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_requirements
CREATE POLICY "Users can view product requirements"
  ON product_requirements FOR SELECT
  USING (true);

CREATE POLICY "Marketing and admin can insert product requirements"
  ON product_requirements FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'marketing', 'finance')
    )
  );

CREATE POLICY "Marketing and admin can update product requirements"
  ON product_requirements FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'marketing', 'finance')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE product_requirements IS 'Stores product specifications collected by marketing for Design + Print orders';
COMMENT ON COLUMN quotations.order_type IS 'Type of order: print (client provides design), design (design only), design_print (full service)';
COMMENT ON COLUMN product_requirements.specifications IS 'JSONB field storing product-specific details based on category';
