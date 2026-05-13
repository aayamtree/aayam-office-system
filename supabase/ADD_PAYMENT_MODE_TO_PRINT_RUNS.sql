-- Add payment mode column to print_runs for paper supply payments
-- Run this in Supabase SQL Editor

ALTER TABLE print_runs
ADD COLUMN IF NOT EXISTS paper_payment_mode TEXT DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN print_runs.paper_payment_mode IS 'Payment mode when paper is paid: cash, bank_transfer, upi, card';

DO $$ BEGIN RAISE NOTICE '✅ Added paper_payment_mode column to print_runs'; END $$;
