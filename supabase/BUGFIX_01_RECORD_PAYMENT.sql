-- ============================================================
-- BUG-01 FIX: Add p_cash_account_id to record_payment_received
-- E2E Test Report: March 2026
-- ============================================================
-- STEP 1: Drop ALL existing overloaded versions of this function.
-- This is required because Postgres won't let you CREATE OR REPLACE
-- when multiple overloads exist with different argument lists.
-- ============================================================

-- Drop all known overloads (IF EXISTS prevents error if one doesn't exist)
DROP FUNCTION IF EXISTS public.record_payment_received(
    uuid, numeric, text, date, uuid, text, text, text, uuid, text
) CASCADE;

DROP FUNCTION IF EXISTS public.record_payment_received(
    uuid, numeric, text, date, uuid, uuid, text, text, uuid, text
) CASCADE;

DROP FUNCTION IF EXISTS public.record_payment_received(
    uuid, numeric, text, date
) CASCADE;

DROP FUNCTION IF EXISTS public.record_payment_received(
    p_client_id uuid, p_amount numeric, p_payment_mode text, p_payment_date date,
    p_bank_account_id uuid, p_reference text, p_notes text, p_invoice_id uuid, p_attachment_url text
) CASCADE;

DROP FUNCTION IF EXISTS public.record_payment_received(
    p_client_id uuid, p_amount numeric, p_payment_mode text, p_payment_date date,
    p_bank_account_id uuid, p_notes text, p_invoice_id uuid
) CASCADE;

-- Nuclear option: drop all overloads by name regardless of args
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

-- ============================================================
-- STEP 2: Create the new unified function with p_cash_account_id
-- ============================================================

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

    -- Update bank account balance if bank payment
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.record_payment_received TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_received TO anon;

-- ============================================================
-- VERIFY: Check function was created with correct signature
-- ============================================================
SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'record_payment_received';
