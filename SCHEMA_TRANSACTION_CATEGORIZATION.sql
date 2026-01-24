-- =====================================================
-- TRANSACTION CATEGORIZATION FEATURE
-- Database Schema for Expense/Income Categories
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. EXPENSE CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. INCOME CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS income_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES income_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. UPDATE BANK_TRANSACTIONS TABLE
-- Add categorization fields
-- =====================================================
ALTER TABLE bank_transactions 
  ADD COLUMN IF NOT EXISTS transaction_type TEXT CHECK (transaction_type IN ('expense', 'income')),
  ADD COLUMN IF NOT EXISTS expense_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS income_category_id UUID REFERENCES income_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expense_type TEXT CHECK (expense_type IN ('goods', 'services')),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS categorization_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- =====================================================
-- 4. INSERT DEFAULT EXPENSE CATEGORIES
-- =====================================================
INSERT INTO expense_categories (name, description) VALUES
  ('Office Expenses', 'General office operational costs'),
  ('Utilities', 'Electricity, water, internet, phone bills'),
  ('Travel & Transport', 'Business travel, fuel, vehicle maintenance'),
  ('Printing & Stationery', 'Paper, ink, office supplies'),
  ('IT & Software', 'Software licenses, hosting, internet services'),
  ('Rent & Lease', 'Office rent, equipment lease'),
  ('Salaries & Wages', 'Employee compensation'),
  ('Professional Fees', 'Consultant, legal, accounting fees'),
  ('Marketing & Advertising', 'Promotional expenses'),
  ('Maintenance & Repairs', 'Equipment and facility maintenance'),
  ('Insurance', 'Business insurance premiums'),
  ('Bank Charges', 'Transaction fees, bank charges'),
  ('Depreciation', 'Asset depreciation'),
  ('Miscellaneous', 'Other business expenses')
ON CONFLICT (name) DO NOTHING;

-- Insert Subcategories for Utilities
INSERT INTO expense_categories (name, parent_id, description) VALUES
  ('Electricity Bill', (SELECT id FROM expense_categories WHERE name = 'Utilities'), 'Monthly electricity charges'),
  ('Internet Bill', (SELECT id FROM expense_categories WHERE name = 'Utilities'), 'Internet and broadband'),
  ('Phone Bill', (SELECT id FROM expense_categories WHERE name = 'Utilities'), 'Telephone and mobile charges')
ON CONFLICT (name) DO NOTHING;

-- Insert Subcategories for Office Expenses
INSERT INTO expense_categories (name, parent_id, description) VALUES
  ('Depreciation Expense', (SELECT id FROM expense_categories WHERE name = 'Office Expenses'), 'Asset depreciation'),
  ('GST Payment', (SELECT id FROM expense_categories WHERE name = 'Office Expenses'), 'GST tax payments')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 5. INSERT DEFAULT INCOME CATEGORIES
-- =====================================================
INSERT INTO income_categories (name, description) VALUES
  ('Sales Revenue', 'Income from product/service sales'),
  ('Consulting Income', 'Professional consulting services'),
  ('Interest Income', 'Interest earned on deposits'),
  ('Commission Income', 'Commission and referral income'),
  ('Rental Income', 'Property or equipment rental'),
  ('Other Income', 'Miscellaneous income')
ON CONFLICT (name) DO NOTHING;

-- Insert Subcategories for Sales Revenue
INSERT INTO income_categories (name, parent_id, description) VALUES
  ('Client Payment', (SELECT id FROM income_categories WHERE name = 'Sales Revenue'), 'Direct payment from clients'),
  ('Project Revenue', (SELECT id FROM income_categories WHERE name = 'Sales Revenue'), 'Project-based income'),
  ('Advance Payment', (SELECT id FROM income_categories WHERE name = 'Sales Revenue'), 'Advance payments received')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Finance users can manage expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Anyone can read income categories" ON income_categories;
DROP POLICY IF EXISTS "Finance users can manage income categories" ON income_categories;

-- Read policies (everyone can see categories)
CREATE POLICY "Anyone can read expense categories" 
  ON expense_categories FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can read income categories" 
  ON income_categories FOR SELECT 
  USING (true);

-- Write policies (only admin/finance can create/update/delete)
CREATE POLICY "Finance users can manage expense categories" 
  ON expense_categories FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Finance users can manage income categories" 
  ON income_categories FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'finance')
    )
  );

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON expense_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_income_categories_parent ON income_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_expense_category ON bank_transactions(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_income_category ON bank_transactions(income_category_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_is_verified ON bank_transactions(is_verified);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_type ON bank_transactions(transaction_type);

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to get category with parent name
CREATE OR REPLACE FUNCTION get_category_full_name(category_id UUID, table_name TEXT)
RETURNS TEXT AS $$
DECLARE
  cat_name TEXT;
  parent_name TEXT;
BEGIN
  IF table_name = 'expense_categories' THEN
    SELECT name INTO cat_name FROM expense_categories WHERE id = category_id;
    SELECT ec2.name INTO parent_name 
    FROM expense_categories ec1
    JOIN expense_categories ec2 ON ec1.parent_id = ec2.id
    WHERE ec1.id = category_id;
  ELSIF table_name = 'income_categories' THEN
    SELECT name INTO cat_name FROM income_categories WHERE id = category_id;
    SELECT ic2.name INTO parent_name 
    FROM income_categories ic1
    JOIN income_categories ic2 ON ic1.parent_id = ic2.id
    WHERE ic1.id = category_id;
  END IF;
  
  IF parent_name IS NOT NULL THEN
    RETURN parent_name || ' > ' || cat_name;
  ELSE
    RETURN cat_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. UPDATED_AT TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_income_categories_updated_at ON income_categories;
CREATE TRIGGER update_income_categories_updated_at
  BEFORE UPDATE ON income_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- View expense categories with count
SELECT 
  ec.name,
  ec.description,
  COUNT(DISTINCT sub.id) as subcategory_count,
  ec.is_active
FROM expense_categories ec
LEFT JOIN expense_categories sub ON sub.parent_id = ec.id
WHERE ec.parent_id IS NULL
GROUP BY ec.id, ec.name, ec.description, ec.is_active
ORDER BY ec.name;

-- View income categories with count
SELECT 
  ic.name,
  ic.description,
  COUNT(DISTINCT sub.id) as subcategory_count,
  ic.is_active
FROM income_categories ic
LEFT JOIN income_categories sub ON sub.parent_id = ic.id
WHERE ic.parent_id IS NULL
GROUP BY ic.id, ic.name, ic.description, ic.is_active
ORDER BY ic.name;
