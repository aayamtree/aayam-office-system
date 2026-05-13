-- =====================================================
-- INTERNAL ACCOUNT TRANSFERS - Run this in Supabase SQL Editor
-- Dashboard → https://supabase.com/dashboard/project/wrvbodgsykesbaphpbzs/sql/new
-- =====================================================

-- 1. Create account_transfers table
CREATE TABLE IF NOT EXISTS account_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN (
    'bank_to_cash', 'cash_to_bank', 'bank_to_bank', 'cash_to_cash', 'adjust_balance'
  )),
  from_account_type TEXT CHECK (from_account_type IN ('bank', 'cash')),
  from_account_id   UUID,
  to_account_type   TEXT CHECK (to_account_type IN ('bank', 'cash')),
  to_account_id     UUID,
  amount            NUMERIC(12,2) NOT NULL,
  transfer_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (allow authenticated users to read/insert)
ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access" ON account_transfers
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. Create the atomic transfer function
CREATE OR REPLACE FUNCTION record_account_transfer(
  p_transfer_type    TEXT,
  p_from_account_type TEXT DEFAULT NULL,
  p_from_account_id  UUID DEFAULT NULL,
  p_to_account_type  TEXT DEFAULT NULL,
  p_to_account_id    UUID DEFAULT NULL,
  p_amount           NUMERIC DEFAULT 0,
  p_transfer_date    DATE DEFAULT CURRENT_DATE,
  p_notes            TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
BEGIN
  -- Log the transfer
  INSERT INTO account_transfers (
    transfer_type, from_account_type, from_account_id,
    to_account_type, to_account_id, amount, transfer_date, notes
  ) VALUES (
    p_transfer_type, p_from_account_type, p_from_account_id,
    p_to_account_type, p_to_account_id, p_amount, p_transfer_date, p_notes
  ) RETURNING id INTO v_transfer_id;

  -- Adjust Balance (single account, positive or negative amount)
  IF p_transfer_type = 'adjust_balance' THEN
    IF p_from_account_type = 'bank' THEN
      UPDATE bank_accounts SET current_balance = current_balance + p_amount WHERE id = p_from_account_id;
    ELSIF p_from_account_type = 'cash' THEN
      UPDATE cash_accounts SET current_balance = current_balance + p_amount WHERE id = p_from_account_id;
    END IF;

  -- Transfer (debit from → credit to)
  ELSE
    -- Debit source
    IF p_from_account_type = 'bank' THEN
      UPDATE bank_accounts SET current_balance = current_balance - p_amount WHERE id = p_from_account_id;
    ELSIF p_from_account_type = 'cash' THEN
      UPDATE cash_accounts SET current_balance = current_balance - p_amount WHERE id = p_from_account_id;
    END IF;
    -- Credit destination
    IF p_to_account_type = 'bank' THEN
      UPDATE bank_accounts SET current_balance = current_balance + p_amount WHERE id = p_to_account_id;
    ELSIF p_to_account_type = 'cash' THEN
      UPDATE cash_accounts SET current_balance = current_balance + p_amount WHERE id = p_to_account_id;
    END IF;
  END IF;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! ✓
