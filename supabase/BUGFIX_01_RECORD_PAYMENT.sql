-- ============================================================
-- BUG-01 FIX (COMPLETE): record_payment_received
-- Aayam Office System — E2E Test Report March 2026
-- ============================================================
-- PROBLEM: Two issues:
--   1. payments_received TABLE is missing cash_account_id column
--   2. record_payment_received FUNCTION had multiple overloads
--      and didn't accept p_cash_account_id parameter
-- SOLUTION: Fix the table schema FIRST, then recreate the function
-- ============================================================
-- Run this entire script in Supabase SQL Editor at once.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: Add missing column to payments_received TABLE
-- (IF NOT EXISTS = safe to run multiple times)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.payments_received
    ADD COLUMN IF NOT EXISTS cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE SET NULL;

-- Also ensure other columns exist that the function may reference
ALTER TABLE public.payments_received
    ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE public.payments_received
    ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- STEP 2: Drop ALL existing overloads of record_payment_received
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'record_payment_received'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.record_payment_received(' || r.args || ') CASCADE';
    END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- STEP 3: Create the unified function with all required params
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_payment_received(
    p_client_id       UUID,
    p_amount          NUMERIC,
    p_payment_mode    TEXT,
    p_payment_date    DATE,
    p_bank_account_id UUID DEFAULT NULL,
    p_cash_account_id UUID DEFAULT NULL,
    p_reference       TEXT DEFAULT NULL,
    p_notes           TEXT DEFAULT NULL,
    p_invoice_id      UUID DEFAULT NULL,
    p_attachment_url  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    -- Insert into payments_received table
    INSERT INTO payments_received (
        client_id,
        amount,
        payment_mode,
        payment_date,
        bank_account_id,
        cash_account_id,
        reference_number,
        notes,
        invoice_id,
        attachment_url
    ) VALUES (
        p_client_id,
        p_amount,
        p_payment_mode,
        p_payment_date,
        p_bank_account_id,
        p_cash_account_id,
        p_reference,
        p_notes,
        p_invoice_id,
        p_attachment_url
    )
    RETURNING id INTO v_payment_id;

    -- Update invoice payment status if invoice_id is provided
    IF p_invoice_id IS NOT NULL THEN
        UPDATE invoices
        SET
            amount_paid = COALESCE(amount_paid, 0) + p_amount,
            payment_status = CASE
                WHEN (COALESCE(amount_paid, 0) + p_amount) >= total_amount THEN 'paid'
                WHEN (COALESCE(amount_paid, 0) + p_amount) > 0 THEN 'partial'
                ELSE payment_status
            END,
            balance_due = GREATEST(0, total_amount - (COALESCE(amount_paid, 0) + p_amount))
        WHERE id = p_invoice_id;
    END IF;

    -- Update client outstanding balance
    UPDATE clients
    SET outstanding_balance = GREATEST(0, COALESCE(outstanding_balance, 0) - p_amount)
    WHERE id = p_client_id;

    -- Update bank account balance if bank/UPI payment
    IF p_bank_account_id IS NOT NULL AND p_payment_mode != 'cash' THEN
        UPDATE bank_accounts
        SET current_balance = COALESCE(current_balance, 0) + p_amount
        WHERE id = p_bank_account_id;
    END IF;

    -- Update cash account balance if cash payment
    IF p_cash_account_id IS NOT NULL AND p_payment_mode = 'cash' THEN
        UPDATE cash_accounts
        SET current_balance = COALESCE(current_balance, 0) + p_amount
        WHERE id = p_cash_account_id;
    END IF;

    RETURN v_payment_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.record_payment_received TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_received TO anon;

-- ────────────────────────────────────────────────────────────
-- STEP 4: Verify — run this to confirm it worked
-- ────────────────────────────────────────────────────────────
SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    'OK' AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'record_payment_received';

-- Also verify the column exists in the table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payments_received'
  AND column_name IN ('cash_account_id', 'invoice_id', 'attachment_url');
