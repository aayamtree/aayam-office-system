-- =============================================
-- FINANCE CORE OVERHAUL
-- =============================================

-- 1. UPDATE BANK ACCOUNT TYPES
-- Allow 'cash' as a valid account type
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_account_type_check;
ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_account_type_check 
  CHECK (account_type IN ('current', 'savings', 'od', 'cc', 'cash'));

-- 2. ENSURE CASH ACCOUNT EXISTS
-- Create a system-level 'Cash in Hand' account if it doesn't exist
INSERT INTO bank_accounts (name, account_number, account_type, opening_balance, current_balance, is_default, is_active)
SELECT 'Cash in Hand', 'CASH-001', 'cash', 0, 0, false, true
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts WHERE account_type = 'cash');


-- 3. CENTRALIZED TRANSACTION LOGIC (RPCs)

-- A. RECORD PAYMENT RECEIVED (Client Pay In)
CREATE OR REPLACE FUNCTION record_payment_received(
  p_client_id UUID,
  p_amount DECIMAL,
  p_payment_mode TEXT,
  p_payment_date DATE,
  p_bank_account_id UUID DEFAULT NULL, -- NULL if Cash (will use system cash account)
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_attachment_url TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_payment_id UUID;
  v_payment_number TEXT;
  v_target_account_id UUID;
  v_new_balance DECIMAL;
BEGIN
  -- 1. Get Payment Number
  SELECT prefix || '-' || next_val INTO v_payment_number 
  FROM counters WHERE id = 'payment_received';
  
  IF v_payment_number IS NULL THEN
      v_payment_number := 'PAY-' || extract(epoch from now());
  ELSE
      UPDATE counters SET next_val = next_val + 1 WHERE id = 'payment_received';
  END IF;

  -- 2. Determine Bank Account
  IF p_payment_mode = 'cash' THEN
    SELECT id INTO v_target_account_id FROM bank_accounts WHERE account_type = 'cash' LIMIT 1;
    IF v_target_account_id IS NULL THEN
       RAISE EXCEPTION 'System Cash Account not found!';
    END IF;
  ELSE
    v_target_account_id := p_bank_account_id;
    IF v_target_account_id IS NULL THEN
       RAISE EXCEPTION 'Bank Account must be selected for non-cash payments.';
    END IF;
  END IF;

  -- 3. Insert Payment Record
  INSERT INTO payments_received (
    payment_number, client_id, amount, payment_mode, payment_date, 
    bank_account_id, reference_number, notes, invoice_id, attachment_url
  ) VALUES (
    v_payment_number, p_client_id, p_amount, p_payment_mode, p_payment_date,
    v_target_account_id, p_reference, p_notes, p_invoice_id, p_attachment_url
  ) RETURNING id INTO v_payment_id;

  -- 4. Update Bank/Cash Balance (MONEY IN)
  UPDATE bank_accounts 
  SET current_balance = current_balance + p_amount 
  WHERE id = v_target_account_id
  RETURNING current_balance INTO v_new_balance;

  -- 5. Create Bank Transaction Record (Ledger)
  INSERT INTO bank_transactions (
    bank_account_id, transaction_type, amount, reference_type, reference_id, 
    description, reference_number, transaction_date, balance_after
  ) VALUES (
    v_target_account_id, 'inflow', p_amount, 'payment_received', v_payment_id,
    'Payment from ' || (SELECT name FROM clients WHERE id = p_client_id), 
    p_reference, p_payment_date, v_new_balance
  );

  -- 6. Update Client Outstanding Balance
  UPDATE clients 
  SET outstanding_balance = outstanding_balance - p_amount 
  WHERE id = p_client_id;

  -- 7. If Invoice Linked, Update Invoice
  IF p_invoice_id IS NOT NULL THEN
    UPDATE invoices
    SET 
      amount_paid = amount_paid + p_amount,
      balance_due = total_amount - (amount_paid + p_amount),
      payment_status = CASE 
        WHEN (total_amount - (amount_paid + p_amount)) <= 0 THEN 'paid'
        ELSE 'partial'
      END
    WHERE id = p_invoice_id;
  END IF;

  RETURN json_build_object('success', true, 'payment_id', v_payment_id, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. RECORD VENDOR PAYMENT (Company Pay Out)
CREATE OR REPLACE FUNCTION record_vendor_payment(
  p_vendor_id UUID,
  p_amount DECIMAL,
  p_payment_mode TEXT,
  p_payment_date DATE,
  p_bank_account_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_purchase_bill_id UUID DEFAULT NULL,
  p_attachment_url TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_payment_id UUID;
  v_payment_number TEXT;
  v_target_account_id UUID;
  v_new_balance DECIMAL;
BEGIN
  -- 1. Get Payment Number
  SELECT prefix || '-' || next_val INTO v_payment_number 
  FROM counters WHERE id = 'vendor_payment';

  IF v_payment_number IS NULL THEN
     v_payment_number := 'VP-' || extract(epoch from now());
  ELSE
     UPDATE counters SET next_val = next_val + 1 WHERE id = 'vendor_payment';
  END IF;

  -- 2. Determine Bank Account
  IF p_payment_mode = 'cash' THEN
    SELECT id INTO v_target_account_id FROM bank_accounts WHERE account_type = 'cash' LIMIT 1;
    IF v_target_account_id IS NULL THEN
       RAISE EXCEPTION 'System Cash Account not found!';
    END IF;
  ELSE
    v_target_account_id := p_bank_account_id;
    IF v_target_account_id IS NULL THEN
       RAISE EXCEPTION 'Bank Account must be selected for non-cash payments.';
    END IF;
  END IF;

  -- 3. Check Sufficient Funds
  IF NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = v_target_account_id AND current_balance >= p_amount) THEN
     -- Ideally warn, but for now allow (Overdraft) or Block? 
     -- User said "Track all cash out". Doesn't strictly blocking.
     -- We will ALLOW it but it might go negative.
  END IF;

  -- 4. Insert Payment Record
  INSERT INTO vendor_payments (
    payment_number, vendor_id, amount, payment_mode, payment_date, 
    bank_account_id, reference_number, notes, purchase_bill_id, attachment_url
  ) VALUES (
    v_payment_number, p_vendor_id, p_amount, p_payment_mode, p_payment_date,
    v_target_account_id, p_reference, p_notes, p_purchase_bill_id, p_attachment_url
  ) RETURNING id INTO v_payment_id;

  -- 5. Update Bank/Cash Balance (MONEY OUT)
  UPDATE bank_accounts 
  SET current_balance = current_balance - p_amount 
  WHERE id = v_target_account_id
  RETURNING current_balance INTO v_new_balance;

  -- 6. Create Bank Transaction Record (Ledger)
  INSERT INTO bank_transactions (
    bank_account_id, transaction_type, amount, reference_type, reference_id, 
    description, reference_number, transaction_date, balance_after
  ) VALUES (
    v_target_account_id, 'outflow', p_amount, 'vendor_payment', v_payment_id,
    'Payment to ' || (SELECT name FROM vendors WHERE id = p_vendor_id), 
    p_reference, p_payment_date, v_new_balance
  );

  -- 7. Update Vendor Outstanding
  UPDATE vendors 
  SET outstanding_balance = outstanding_balance - p_amount -- Assuming Vendor Outstanding is "Amount We Owe" (Positive). If it's negative, logic flips.
  WHERE id = p_vendor_id;
  
  -- NOTE: Usually "Outstanding" for Vendor means "We owe them". So paying reduces it.

  RETURN json_build_object('success', true, 'payment_id', v_payment_id, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
