-- =============================================
-- FIX: Payment Recording RPCs
-- Run this in Supabase SQL Editor to fix the
-- "ON CONFLICT" error when recording payments
-- =============================================

-- Step 1: Make sure vendor_payments table exists
CREATE TABLE IF NOT EXISTS vendor_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  payment_number TEXT,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  purchase_bill_id UUID REFERENCES purchase_bills(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  cash_account_id UUID,  -- soft reference to cash_accounts
  amount NUMERIC DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash',
  payment_date DATE DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for vendor_payments
ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated can manage vendor_payments" ON vendor_payments;
CREATE POLICY "All authenticated can manage vendor_payments"
  ON vendor_payments FOR ALL USING (auth.role() = 'authenticated');

-- Add cash_account_id to payments_received if missing
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS cash_account_id UUID;

-- Step 2: Fix the record_vendor_payment RPC (replace broken version)
CREATE OR REPLACE FUNCTION record_vendor_payment(
  p_vendor_id UUID,
  p_amount NUMERIC,
  p_payment_mode TEXT,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_bank_account_id UUID DEFAULT NULL,
  p_cash_account_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_purchase_bill_id UUID DEFAULT NULL,
  p_attachment_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_seq INTEGER;
  v_payment_number TEXT;
BEGIN
  -- Generate unique payment number without ON CONFLICT
  SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(payment_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1
  INTO v_seq FROM vendor_payments;
  v_payment_number := 'VP-' || to_char(NOW(), 'YYMM') || '-' || lpad(v_seq::TEXT, 4, '0');

  -- Insert vendor payment
  INSERT INTO vendor_payments (
    payment_number, vendor_id, purchase_bill_id,
    bank_account_id, cash_account_id,
    amount, payment_mode, payment_date,
    reference_number, notes, attachment_url
  ) VALUES (
    v_payment_number, p_vendor_id, p_purchase_bill_id,
    CASE WHEN p_payment_mode = 'cash' THEN NULL ELSE p_bank_account_id END,
    CASE WHEN p_payment_mode = 'cash' THEN p_cash_account_id ELSE NULL END,
    p_amount, p_payment_mode, p_payment_date,
    p_reference, p_notes, p_attachment_url
  ) RETURNING id INTO v_payment_id;

  -- Update vendor outstanding balance
  UPDATE vendors
  SET outstanding_balance = COALESCE(outstanding_balance, 0) - p_amount
  WHERE id = p_vendor_id;

  -- Update cash account balance (debit for vendor payment)
  IF p_payment_mode = 'cash' AND p_cash_account_id IS NOT NULL THEN
    UPDATE cash_accounts
    SET current_balance = COALESCE(current_balance, 0) - p_amount
    WHERE id = p_cash_account_id;
  END IF;

  -- Update bank account balance (debit for vendor payment)
  IF p_payment_mode != 'cash' AND p_bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts
    SET current_balance = COALESCE(current_balance, 0) - p_amount
    WHERE id = p_bank_account_id;
  END IF;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Fix the record_payment_received RPC
CREATE OR REPLACE FUNCTION record_payment_received(
  p_client_id UUID,
  p_amount NUMERIC,
  p_payment_mode TEXT,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_bank_account_id UUID DEFAULT NULL,
  p_cash_account_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_attachment_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_seq INTEGER;
  v_payment_number TEXT;
BEGIN
  -- Generate unique payment number without ON CONFLICT
  SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(payment_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1
  INTO v_seq FROM payments_received;
  v_payment_number := 'PR-' || to_char(NOW(), 'YYMM') || '-' || lpad(v_seq::TEXT, 4, '0');

  -- Insert payment record
  INSERT INTO payments_received (
    payment_number, client_id, invoice_id,
    bank_account_id, cash_account_id,
    amount, payment_mode, payment_date,
    reference_number, notes
  ) VALUES (
    v_payment_number, p_client_id, p_invoice_id,
    CASE WHEN p_payment_mode = 'cash' THEN NULL ELSE p_bank_account_id END,
    CASE WHEN p_payment_mode = 'cash' THEN p_cash_account_id ELSE NULL END,
    p_amount, p_payment_mode, p_payment_date,
    p_reference, p_notes
  ) RETURNING id INTO v_payment_id;

  -- Update client outstanding balance
  UPDATE clients
  SET outstanding_balance = COALESCE(outstanding_balance, 0) - p_amount
  WHERE id = p_client_id;

  -- Update cash account balance (credit for payment received)
  IF p_payment_mode = 'cash' AND p_cash_account_id IS NOT NULL THEN
    UPDATE cash_accounts
    SET current_balance = COALESCE(current_balance, 0) + p_amount
    WHERE id = p_cash_account_id;
  END IF;

  -- Update bank account balance (credit for payment received)
  IF p_payment_mode != 'cash' AND p_bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts
    SET current_balance = COALESCE(current_balance, 0) + p_amount
    WHERE id = p_bank_account_id;
  END IF;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Fix get_all_vendor_payments RPC
CREATE OR REPLACE FUNCTION get_all_vendor_payments()
RETURNS TABLE (
  id UUID,
  payment_number TEXT,
  vendor_id UUID,
  vendor_name TEXT,
  vendor_company TEXT,
  amount NUMERIC,
  payment_mode TEXT,
  payment_date DATE,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vp.id, vp.payment_number, vp.vendor_id,
    v.name AS vendor_name, v.company AS vendor_company,
    vp.amount, vp.payment_mode,
    vp.payment_date::DATE, vp.reference_number, vp.notes, vp.created_at
  FROM vendor_payments vp
  LEFT JOIN vendors v ON vp.vendor_id = v.id
  ORDER BY vp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Fix get_all_payments_received RPC
CREATE OR REPLACE FUNCTION get_all_payments_received()
RETURNS TABLE (
  id UUID,
  payment_number TEXT,
  client_id UUID,
  client_name TEXT,
  client_company TEXT,
  amount NUMERIC,
  payment_mode TEXT,
  payment_date DATE,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id, pr.payment_number, pr.client_id,
    c.name AS client_name, c.company AS client_company,
    pr.amount, pr.payment_mode,
    pr.payment_date::DATE, pr.reference_number, pr.notes, pr.created_at
  FROM payments_received pr
  LEFT JOIN clients c ON pr.client_id = c.id
  ORDER BY pr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Payment RPCs fixed successfully!' AS status;
