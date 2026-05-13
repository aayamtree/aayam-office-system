-- ============================================================
-- FIX_FINANCE_SYNC.sql
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/wrvbodgsykesbaphpbzs/sql/new
--
-- WHAT THIS FIXES:
--   Expenses and payments were recording to vendor_payments /
--   payments_received tables but NOT inserting into
--   cash_transactions / bank_transactions. The Account Statement
--   page reads from those transaction tables → always showed empty.
--
-- THIS SQL:
--   1. Adds cash_account_id column to vendor_payments (if missing)
--   2. Upgrades record_vendor_payment to write transaction logs
--   3. Upgrades record_payment_received to write transaction logs
--   4. Upgrades record_account_transfer to write transaction logs
--   5. Backfills historical data so past records appear in statements
--   6. Recalculates running balance_after on all transaction rows
-- ============================================================

-- ============================================================
-- STEP 1: Add cash_account_id to vendor_payments (if missing)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_payments' AND column_name = 'cash_account_id'
  ) THEN
    ALTER TABLE vendor_payments
      ADD COLUMN cash_account_id UUID REFERENCES cash_accounts(id);
  END IF;
END $$;

-- Also add cash_account_id to payments_received (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments_received' AND column_name = 'cash_account_id'
  ) THEN
    ALTER TABLE payments_received
      ADD COLUMN cash_account_id UUID REFERENCES cash_accounts(id);
  END IF;
END $$;


-- ============================================================
-- STEP 2: Upgrade record_vendor_payment
--         Now updates cash/bank balance + writes transaction log
-- ============================================================
CREATE OR REPLACE FUNCTION record_vendor_payment(
  p_vendor_id         UUID,
  p_amount            NUMERIC,
  p_payment_mode      TEXT,
  p_payment_date      DATE,
  p_bank_account_id   UUID    DEFAULT NULL,
  p_cash_account_id   UUID    DEFAULT NULL,
  p_reference         TEXT    DEFAULT NULL,
  p_notes             TEXT    DEFAULT NULL,
  p_purchase_bill_id  UUID    DEFAULT NULL,
  p_attachment_url    TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_number TEXT;
  v_new_payment    vendor_payments;
  v_new_balance    NUMERIC;
BEGIN
  -- Get next payment number
  SELECT get_next_number('vendor_payment') INTO v_payment_number;

  -- Insert vendor payment record
  INSERT INTO vendor_payments (
    payment_number, vendor_id, purchase_bill_id, amount,
    payment_mode, payment_date, bank_account_id, cash_account_id,
    reference_number, notes, attachment_url, paid_by
  ) VALUES (
    v_payment_number, p_vendor_id, p_purchase_bill_id, p_amount,
    p_payment_mode, p_payment_date, p_bank_account_id, p_cash_account_id,
    p_reference, p_notes, p_attachment_url, auth.uid()
  )
  RETURNING * INTO v_new_payment;

  -- Update purchase bill status if linked
  IF p_purchase_bill_id IS NOT NULL THEN
    UPDATE purchase_bills
    SET
      amount_paid    = COALESCE(amount_paid, 0) + p_amount,
      payment_status = CASE
        WHEN (COALESCE(amount_paid, 0) + p_amount) >= total_amount THEN 'paid'
        WHEN (COALESCE(amount_paid, 0) + p_amount) > 0             THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE id = p_purchase_bill_id;
  END IF;

  -- ── Cash payment ──────────────────────────────────────────
  IF p_cash_account_id IS NOT NULL THEN
    -- Deduct from cash account balance
    UPDATE cash_accounts
    SET current_balance = current_balance - p_amount,
        updated_at      = NOW()
    WHERE id = p_cash_account_id
    RETURNING current_balance INTO v_new_balance;

    -- Write cash transaction log
    INSERT INTO cash_transactions (
      cash_account_id, transaction_type, amount, description,
      reference, reference_type, reference_id,
      transaction_date, balance_after, created_by
    ) VALUES (
      p_cash_account_id, 'out', p_amount,
      COALESCE(p_notes, p_reference, 'Vendor Payment'),
      v_new_payment.payment_number,
      'vendor_payment', v_new_payment.id,
      p_payment_date, v_new_balance, auth.uid()
    );

  -- ── Bank payment ──────────────────────────────────────────
  ELSIF p_bank_account_id IS NOT NULL THEN
    -- Deduct from bank account balance
    UPDATE bank_accounts
    SET current_balance = current_balance - p_amount,
        updated_at      = NOW()
    WHERE id = p_bank_account_id
    RETURNING current_balance INTO v_new_balance;

    -- Write bank transaction log
    INSERT INTO bank_transactions (
      bank_account_id, transaction_date, transaction_type, amount,
      description, reference_number, reference_type, reference_id,
      balance_after
    ) VALUES (
      p_bank_account_id, p_payment_date, 'outflow', p_amount,
      COALESCE(p_notes, p_reference, 'Vendor Payment'),
      v_new_payment.payment_number,
      'vendor_payment', v_new_payment.id,
      v_new_balance
    );
  END IF;

  RETURN row_to_json(v_new_payment);
END;
$$;


-- ============================================================
-- STEP 3: Upgrade record_payment_received
--         Now updates cash/bank balance + writes transaction log
-- ============================================================
CREATE OR REPLACE FUNCTION record_payment_received(
  p_client_id       UUID,
  p_amount          NUMERIC,
  p_payment_mode    TEXT,
  p_payment_date    DATE,
  p_bank_account_id UUID    DEFAULT NULL,
  p_cash_account_id UUID    DEFAULT NULL,
  p_reference       TEXT    DEFAULT NULL,
  p_notes           TEXT    DEFAULT NULL,
  p_invoice_id      UUID    DEFAULT NULL,
  p_attachment_url  TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_number TEXT;
  v_new_payment    payments_received;
  v_new_balance    NUMERIC;
BEGIN
  -- Get next payment number
  SELECT get_next_number('payment_received') INTO v_payment_number;

  -- Insert payment record
  INSERT INTO payments_received (
    payment_number, client_id, invoice_id, amount,
    payment_mode, payment_date, bank_account_id, cash_account_id,
    reference_number, notes, attachment_url, received_by
  ) VALUES (
    v_payment_number, p_client_id, p_invoice_id, p_amount,
    p_payment_mode, p_payment_date, p_bank_account_id, p_cash_account_id,
    p_reference, p_notes, p_attachment_url, auth.uid()
  )
  RETURNING * INTO v_new_payment;

  -- Update invoice status if linked
  IF p_invoice_id IS NOT NULL THEN
    UPDATE invoices
    SET
      amount_received = COALESCE(amount_received, 0) + p_amount,
      balance_due     = total_amount - (COALESCE(amount_received, 0) + p_amount),
      payment_status  = CASE
        WHEN (total_amount - (COALESCE(amount_received, 0) + p_amount)) <= 0 THEN 'paid'
        WHEN (COALESCE(amount_received, 0) + p_amount) > 0                   THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE id = p_invoice_id;
  END IF;

  -- ── Cash payment ──────────────────────────────────────────
  IF p_cash_account_id IS NOT NULL THEN
    UPDATE cash_accounts
    SET current_balance = current_balance + p_amount,
        updated_at      = NOW()
    WHERE id = p_cash_account_id
    RETURNING current_balance INTO v_new_balance;

    INSERT INTO cash_transactions (
      cash_account_id, transaction_type, amount, description,
      reference, reference_type, reference_id,
      transaction_date, balance_after, created_by
    ) VALUES (
      p_cash_account_id, 'in', p_amount,
      COALESCE(p_notes, p_reference, 'Payment Received'),
      v_new_payment.payment_number,
      'payment_received', v_new_payment.id,
      p_payment_date, v_new_balance, auth.uid()
    );

  -- ── Bank payment ──────────────────────────────────────────
  ELSIF p_bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts
    SET current_balance = current_balance + p_amount,
        updated_at      = NOW()
    WHERE id = p_bank_account_id
    RETURNING current_balance INTO v_new_balance;

    INSERT INTO bank_transactions (
      bank_account_id, transaction_date, transaction_type, amount,
      description, reference_number, reference_type, reference_id,
      balance_after
    ) VALUES (
      p_bank_account_id, p_payment_date, 'inflow', p_amount,
      COALESCE(p_notes, p_reference, 'Payment Received'),
      v_new_payment.payment_number,
      'payment_received', v_new_payment.id,
      v_new_balance
    );
  END IF;

  RETURN row_to_json(v_new_payment);
END;
$$;


-- ============================================================
-- STEP 4: Upgrade record_account_transfer
--         Now also writes to cash_transactions / bank_transactions
-- ============================================================
CREATE OR REPLACE FUNCTION record_account_transfer(
  p_transfer_type      TEXT,
  p_from_account_type  TEXT    DEFAULT NULL,
  p_from_account_id    UUID    DEFAULT NULL,
  p_to_account_type    TEXT    DEFAULT NULL,
  p_to_account_id      UUID    DEFAULT NULL,
  p_amount             NUMERIC DEFAULT 0,
  p_transfer_date      DATE    DEFAULT CURRENT_DATE,
  p_notes              TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer_id  UUID;
  v_from_balance NUMERIC;
  v_to_balance   NUMERIC;
  v_description  TEXT;
BEGIN
  v_description := COALESCE(p_notes,
    CASE p_transfer_type
      WHEN 'adjust_balance' THEN 'Balance Adjustment'
      ELSE 'Internal Transfer'
    END
  );

  -- Insert transfer record
  INSERT INTO account_transfers (
    transfer_type, from_account_type, from_account_id,
    to_account_type, to_account_id, amount, transfer_date, notes
  ) VALUES (
    p_transfer_type, p_from_account_type, p_from_account_id,
    p_to_account_type, p_to_account_id, p_amount, p_transfer_date, p_notes
  ) RETURNING id INTO v_transfer_id;

  -- ── Adjust Balance (single account) ──────────────────────
  IF p_transfer_type = 'adjust_balance' THEN
    IF p_from_account_type = 'cash' THEN
      UPDATE cash_accounts
      SET current_balance = current_balance + p_amount,
          updated_at      = NOW()
      WHERE id = p_from_account_id
      RETURNING current_balance INTO v_from_balance;

      INSERT INTO cash_transactions (
        cash_account_id, transaction_type, amount, description,
        reference, reference_type, reference_id,
        transaction_date, balance_after
      ) VALUES (
        p_from_account_id,
        CASE WHEN p_amount >= 0 THEN 'in' ELSE 'out' END,
        ABS(p_amount), v_description,
        'ADJ-' || v_transfer_id::TEXT,
        'adjustment', v_transfer_id,
        p_transfer_date, v_from_balance
      );
    ELSE
      UPDATE bank_accounts
      SET current_balance = current_balance + p_amount,
          updated_at      = NOW()
      WHERE id = p_from_account_id
      RETURNING current_balance INTO v_from_balance;

      INSERT INTO bank_transactions (
        bank_account_id, transaction_date, transaction_type, amount,
        description, reference_number, reference_type, reference_id,
        balance_after
      ) VALUES (
        p_from_account_id, p_transfer_date,
        CASE WHEN p_amount >= 0 THEN 'inflow' ELSE 'outflow' END,
        ABS(p_amount), v_description,
        'ADJ-' || v_transfer_id::TEXT,
        'adjustment', v_transfer_id,
        v_from_balance
      );
    END IF;

  -- ── Transfer between two accounts ────────────────────────
  ELSE
    -- Debit FROM account
    IF p_from_account_type = 'cash' THEN
      UPDATE cash_accounts
      SET current_balance = current_balance - p_amount,
          updated_at      = NOW()
      WHERE id = p_from_account_id
      RETURNING current_balance INTO v_from_balance;

      INSERT INTO cash_transactions (
        cash_account_id, transaction_type, amount, description,
        reference, reference_type, reference_id,
        transaction_date, balance_after
      ) VALUES (
        p_from_account_id, 'out', p_amount, v_description,
        'TRF-' || v_transfer_id::TEXT,
        'transfer', v_transfer_id,
        p_transfer_date, v_from_balance
      );
    ELSE
      UPDATE bank_accounts
      SET current_balance = current_balance - p_amount,
          updated_at      = NOW()
      WHERE id = p_from_account_id
      RETURNING current_balance INTO v_from_balance;

      INSERT INTO bank_transactions (
        bank_account_id, transaction_date, transaction_type, amount,
        description, reference_number, reference_type, reference_id,
        balance_after
      ) VALUES (
        p_from_account_id, p_transfer_date, 'outflow', p_amount,
        v_description, 'TRF-' || v_transfer_id::TEXT,
        'transfer', v_transfer_id,
        v_from_balance
      );
    END IF;

    -- Credit TO account
    IF p_to_account_type = 'cash' THEN
      UPDATE cash_accounts
      SET current_balance = current_balance + p_amount,
          updated_at      = NOW()
      WHERE id = p_to_account_id
      RETURNING current_balance INTO v_to_balance;

      INSERT INTO cash_transactions (
        cash_account_id, transaction_type, amount, description,
        reference, reference_type, reference_id,
        transaction_date, balance_after
      ) VALUES (
        p_to_account_id, 'in', p_amount, v_description,
        'TRF-' || v_transfer_id::TEXT,
        'transfer', v_transfer_id,
        p_transfer_date, v_to_balance
      );
    ELSE
      UPDATE bank_accounts
      SET current_balance = current_balance + p_amount,
          updated_at      = NOW()
      WHERE id = p_to_account_id
      RETURNING current_balance INTO v_to_balance;

      INSERT INTO bank_transactions (
        bank_account_id, transaction_date, transaction_type, amount,
        description, reference_number, reference_type, reference_id,
        balance_after
      ) VALUES (
        p_to_account_id, p_transfer_date, 'inflow', p_amount,
        v_description, 'TRF-' || v_transfer_id::TEXT,
        'transfer', v_transfer_id,
        v_to_balance
      );
    END IF;
  END IF;

  RETURN v_transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_account_transfer TO authenticated;


-- ============================================================
-- STEP 5: Backfill — create cash_transactions from past vendor_payments
-- ============================================================
INSERT INTO cash_transactions (
  cash_account_id, transaction_type, amount, description,
  reference, reference_type, reference_id,
  transaction_date, balance_after, created_at
)
SELECT
  vp.cash_account_id,
  'out',
  vp.amount,
  COALESCE(vp.notes, vp.reference_number, 'Vendor Payment'),
  vp.payment_number,
  'vendor_payment',
  vp.id,
  vp.payment_date,
  0,   -- balance_after recalculated in Step 7
  vp.created_at
FROM vendor_payments vp
WHERE vp.cash_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cash_transactions ct
    WHERE ct.reference_type = 'vendor_payment' AND ct.reference_id = vp.id
  );


-- ============================================================
-- STEP 6: Backfill — create cash_transactions from past payments_received
-- ============================================================
INSERT INTO cash_transactions (
  cash_account_id, transaction_type, amount, description,
  reference, reference_type, reference_id,
  transaction_date, balance_after, created_at
)
SELECT
  pr.cash_account_id,
  'in',
  pr.amount,
  COALESCE(pr.notes, pr.reference_number, 'Payment Received'),
  pr.payment_number,
  'payment_received',
  pr.id,
  pr.payment_date,
  0,
  pr.created_at
FROM payments_received pr
WHERE pr.cash_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cash_transactions ct
    WHERE ct.reference_type = 'payment_received' AND ct.reference_id = pr.id
  );


-- ============================================================
-- STEP 6b: Backfill — bank_transactions from past vendor_payments (bank)
-- ============================================================
INSERT INTO bank_transactions (
  bank_account_id, transaction_date, transaction_type, amount,
  description, reference_number, reference_type, reference_id,
  balance_after, created_at
)
SELECT
  vp.bank_account_id,
  vp.payment_date,
  'outflow',
  vp.amount,
  COALESCE(vp.notes, vp.reference_number, 'Vendor Payment'),
  vp.payment_number,
  'vendor_payment',
  vp.id,
  0,
  vp.created_at
FROM vendor_payments vp
WHERE vp.bank_account_id IS NOT NULL
  AND vp.payment_mode != 'cash'
  AND NOT EXISTS (
    SELECT 1 FROM bank_transactions bt
    WHERE bt.reference_type = 'vendor_payment' AND bt.reference_id = vp.id
  );


-- ============================================================
-- STEP 6c: Backfill — bank_transactions from past payments_received (bank)
-- ============================================================
INSERT INTO bank_transactions (
  bank_account_id, transaction_date, transaction_type, amount,
  description, reference_number, reference_type, reference_id,
  balance_after, created_at
)
SELECT
  pr.bank_account_id,
  pr.payment_date,
  'inflow',
  pr.amount,
  COALESCE(pr.notes, pr.reference_number, 'Payment Received'),
  pr.payment_number,
  'payment_received',
  pr.id,
  0,
  pr.created_at
FROM payments_received pr
WHERE pr.bank_account_id IS NOT NULL
  AND pr.payment_mode != 'cash'
  AND NOT EXISTS (
    SELECT 1 FROM bank_transactions bt
    WHERE bt.reference_type = 'payment_received' AND bt.reference_id = pr.id
  );


-- ============================================================
-- STEP 7: Recalculate balance_after for cash_transactions
--         Uses running sum from opening_balance per account
-- ============================================================
WITH running AS (
  SELECT
    ct.id,
    ca.opening_balance + SUM(
      CASE WHEN ct.transaction_type = 'in' THEN ct.amount ELSE -ct.amount END
    ) OVER (
      PARTITION BY ct.cash_account_id
      ORDER BY ct.transaction_date ASC, ct.created_at ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS balance_after
  FROM cash_transactions ct
  JOIN cash_accounts ca ON ca.id = ct.cash_account_id
)
UPDATE cash_transactions ct
SET balance_after = running.balance_after
FROM running
WHERE ct.id = running.id;


-- ============================================================
-- STEP 8: Recalculate balance_after for bank_transactions
-- ============================================================
WITH running AS (
  SELECT
    bt.id,
    ba.opening_balance + SUM(
      CASE WHEN bt.transaction_type = 'inflow' THEN bt.amount ELSE -bt.amount END
    ) OVER (
      PARTITION BY bt.bank_account_id
      ORDER BY bt.transaction_date ASC, bt.created_at ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS balance_after
  FROM bank_transactions bt
  JOIN bank_accounts ba ON ba.id = bt.bank_account_id
)
UPDATE bank_transactions bt
SET balance_after = running.balance_after
FROM running
WHERE bt.id = running.id;


-- ============================================================
-- STEP 9: Also sync current_balance on accounts to match reality
--         (in case balance drifted from the correct value)
-- ============================================================

-- Sync cash accounts: set current_balance = opening + net of all transactions
UPDATE cash_accounts ca
SET current_balance = ca.opening_balance + COALESCE((
  SELECT SUM(CASE WHEN transaction_type = 'in' THEN amount ELSE -amount END)
  FROM cash_transactions
  WHERE cash_account_id = ca.id
), 0),
updated_at = NOW();

-- Sync bank accounts similarly
UPDATE bank_accounts ba
SET current_balance = ba.opening_balance + COALESCE((
  SELECT SUM(CASE WHEN transaction_type = 'inflow' THEN amount ELSE -amount END)
  FROM bank_transactions
  WHERE bank_account_id = ba.id
), 0),
updated_at = NOW();


-- ============================================================
-- DONE! Verify:
-- ============================================================
SELECT 'Cash transactions:' AS label, COUNT(*) AS count FROM cash_transactions
UNION ALL
SELECT 'Bank transactions:', COUNT(*) FROM bank_transactions
UNION ALL
SELECT 'Cash accounts synced:', COUNT(*) FROM cash_accounts
UNION ALL
SELECT 'Bank accounts synced:', COUNT(*) FROM bank_accounts;
