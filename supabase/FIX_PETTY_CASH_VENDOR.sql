-- =============================================
-- FIX: Remove Petty Expenses from Vendors
-- Petty cash is NOT a vendor — it should have
-- no vendor link in vendor_payments.
--
-- STEP 1: Run this file in Supabase SQL Editor
-- STEP 2: Then safely delete "Petty Expenses" vendor
-- =============================================

-- Step 1: Update record_vendor_payment RPC to accept NULL vendor_id
CREATE OR REPLACE FUNCTION record_vendor_payment(
  p_vendor_id UUID DEFAULT NULL,  -- optional: null for petty/internal expenses
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
  -- Generate unique payment number
  SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(payment_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1
  INTO v_seq FROM vendor_payments;
  v_payment_number := 'VP-' || to_char(NOW(), 'YYMM') || '-' || lpad(v_seq::TEXT, 4, '0');

  -- Insert vendor payment (vendor_id can be NULL for internal/petty expenses)
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

  -- Only update vendor balance if a real vendor is linked
  IF p_vendor_id IS NOT NULL THEN
    UPDATE vendors
    SET outstanding_balance = COALESCE(outstanding_balance, 0) - p_amount
    WHERE id = p_vendor_id;
  END IF;

  -- Update cash account balance
  IF p_payment_mode = 'cash' AND p_cash_account_id IS NOT NULL THEN
    UPDATE cash_accounts
    SET current_balance = COALESCE(current_balance, 0) - p_amount
    WHERE id = p_cash_account_id;
  END IF;

  -- Update bank account balance
  IF p_payment_mode != 'cash' AND p_bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts
    SET current_balance = COALESCE(current_balance, 0) - p_amount
    WHERE id = p_bank_account_id;
  END IF;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_vendor_payment TO authenticated;

-- Step 2: Detach existing "Petty Expenses" vendor from any payments
-- (sets vendor_id to NULL on those rows, keeping the payment records intact)
UPDATE vendor_payments
SET vendor_id = NULL
WHERE vendor_id = (
  SELECT id FROM vendors WHERE name = 'Petty Expenses' LIMIT 1
);

-- Step 3: Delete the fake "Petty Expenses" vendor
DELETE FROM vendors WHERE name = 'Petty Expenses';

SELECT 'Done! Petty Expenses vendor removed. RPC now accepts null vendor_id.' AS status;
