-- ==========================================
-- FINANCE MODULE SETUP SCRIPT
-- RUN THIS TO FIX INVOICES, PAYMENTS & BANKS
-- ==========================================

-- 1. FIX INVOICES TABLE
ALTER TABLE invoices RENAME COLUMN invoice_no TO invoice_number;
ALTER TABLE invoices DROP COLUMN IF EXISTS amount;
ALTER TABLE invoices DROP COLUMN IF EXISTS tax_amount;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_tax NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE invoices DROP COLUMN IF EXISTS job_ids;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);

-- 2. CREATE INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  hsn_code TEXT,
  gst_rate NUMERIC DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  account_number TEXT,
  ifsc_code TEXT,
  branch TEXT,
  account_type TEXT DEFAULT 'current',
  opening_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE PAYMENTS RECEIVED
CREATE TABLE IF NOT EXISTS payments_received (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  payment_number TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  amount NUMERIC DEFAULT 0,
  payment_mode TEXT DEFAULT 'bank_transfer',
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SETUP COUNTERS
CREATE TABLE IF NOT EXISTS counters (
  id TEXT PRIMARY KEY,
  current_number INTEGER DEFAULT 0
);
INSERT INTO counters (id, current_number) VALUES 
('invoice', 0), 
('payment', 0), 
('purchase_bill', 0) 
ON CONFLICT DO NOTHING;

-- 6. ENABLE EXT SECURITY (Allow All for ease)
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_received ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all items" ON invoice_items;
CREATE POLICY "Allow all items" ON invoice_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all banks" ON bank_accounts;
CREATE POLICY "Allow all banks" ON bank_accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all payments" ON payments_received;
CREATE POLICY "Allow all payments" ON payments_received FOR ALL USING (true);

-- 7. FUNCTION FOR NEXT NUMBER (Reuse existing or create)
CREATE OR REPLACE FUNCTION get_next_number(counter_id TEXT)
RETURNS TEXT AS $$
DECLARE
  next_val INTEGER;
  year_suffix TEXT;
  prefix TEXT;
BEGIN
  -- Increment
  UPDATE counters SET current_number = current_number + 1 WHERE id = counter_id RETURNING current_number INTO next_val;
  
  -- Determine Prefix
  IF counter_id = 'invoice' THEN prefix := 'INV-';
  ELSIF counter_id = 'job' THEN prefix := 'AAY-';
  ELSIF counter_id = 'payment' THEN prefix := 'PAY-';
  ELSE prefix := 'GEN-';
  END IF;

  -- Format: PRE-24-001
  year_suffix := to_char(now(), 'YY');
  RETURN prefix || year_suffix || '-' || lpad(next_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

SELECT 'Finance Module Setup Complete!' as status;
