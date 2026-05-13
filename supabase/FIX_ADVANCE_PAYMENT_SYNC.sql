-- =============================================
-- FIX: Advance Payment Sync to Finance System
-- Run this ONCE in Supabase SQL Editor
-- =============================================

-- STEP 1: Add missing columns to payments_received table
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- STEP 2: Add advance_payment_mode column to jobs table
-- (stores how the advance was collected: cash, upi, bank_transfer, cheque)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS advance_payment_mode TEXT DEFAULT 'cash';
COMMENT ON COLUMN jobs.advance_payment_mode IS 'Payment mode for advance: cash, upi, bank_transfer, cheque, neft, rtgs';

-- STEP 3: Backfill existing job advances into payments_received
-- Safe: only inserts for jobs whose advance is NOT already recorded
INSERT INTO payments_received (
  job_id,
  client_id,
  amount,
  payment_mode,
  payment_date,
  notes,
  created_at,
  updated_at
)
SELECT
  j.id                                                            AS job_id,
  j.client_id                                                     AS client_id,
  j.advance_amount                                                AS amount,
  COALESCE(NULLIF(j.advance_payment_mode, ''), 'cash')           AS payment_mode,
  COALESCE(
    (j.order_date AT TIME ZONE 'UTC')::date,
    j.created_at::date
  )                                                               AS payment_date,
  format(
    'Advance payment - %s (backfilled from job record)',
    UPPER(COALESCE(NULLIF(j.advance_payment_mode, ''), 'cash'))
  )                                                               AS notes,
  NOW()                                                           AS created_at,
  NOW()                                                           AS updated_at
FROM jobs j
WHERE j.advance_amount > 0
  AND j.advance_collected = true
  AND NOT EXISTS (
    SELECT 1
    FROM payments_received pr
    WHERE pr.job_id = j.id
  );

-- STEP 4: Verify — see what was inserted
SELECT
  pr.id,
  j.job_number,
  j.project_name,
  c.name   AS client_name,
  pr.amount,
  pr.payment_mode,
  pr.payment_date,
  pr.notes
FROM payments_received pr
JOIN jobs j        ON j.id = pr.job_id
LEFT JOIN clients c ON c.id = pr.client_id
ORDER BY pr.payment_date DESC;
