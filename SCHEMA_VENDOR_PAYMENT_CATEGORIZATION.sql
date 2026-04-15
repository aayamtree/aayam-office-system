-- =============================================
-- VENDOR PAYMENT CATEGORIZATION
-- Minimal DB change — just 1 column + 2 categories
-- =============================================

-- 1. Add vendor_id to bank_transactions (mirrors client_id already there)
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_txns_vendor ON bank_transactions(vendor_id);

-- 2. Add Vendor Payment and Vendor Advance as expense categories
INSERT INTO expense_categories (name, description) VALUES
  ('Vendor Payment', 'Payment made to a vendor against purchase bills'),
  ('Vendor Advance', 'Advance payment to a vendor before bill is raised')
ON CONFLICT (name) DO NOTHING;

-- Verification
SELECT 'vendor_id column added to bank_transactions' as status;
SELECT name, description FROM expense_categories WHERE name IN ('Vendor Payment', 'Vendor Advance');
