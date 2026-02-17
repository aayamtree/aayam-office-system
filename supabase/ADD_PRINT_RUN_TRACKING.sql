-- Migration: Enhanced Print Run Tracking
-- Adds delivery mode, QC, dispatch, and expanded status lifecycle

-- 1. Add new tracking columns
ALTER TABLE print_runs
ADD COLUMN IF NOT EXISTS delivery_mode text,
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS transporter_name text,
ADD COLUMN IF NOT EXISTS eway_bill_number text,
ADD COLUMN IF NOT EXISTS dispatch_date date,
ADD COLUMN IF NOT EXISTS invoice_reference text,
ADD COLUMN IF NOT EXISTS qc_checklist jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS qc_notes text;

-- 2. Update status constraint — expand from 3 to 5 statuses
-- First drop the old constraint (may not exist, so use IF EXISTS)
ALTER TABLE print_runs DROP CONSTRAINT IF EXISTS print_runs_status_check;

-- Add the new constraint with all 5 statuses
-- Also keep old statuses ('printed', 'delivered') for backward compat with existing data
ALTER TABLE print_runs ADD CONSTRAINT print_runs_status_check 
  CHECK (status IN ('planned', 'at_printer', 'printing_done', 'qc', 'dispatched', 'printed', 'delivered'));

-- 3. Migrate existing data: map old statuses to new ones
UPDATE print_runs SET status = 'printing_done' WHERE status = 'printed';
UPDATE print_runs SET status = 'dispatched' WHERE status = 'delivered';

-- 4. Add received_qty to print_run_jobs for QC tracking
ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS received_qty integer;

-- 5. Add delivery_mode constraint
ALTER TABLE print_runs DROP CONSTRAINT IF EXISTS print_runs_delivery_mode_check;
ALTER TABLE print_runs ADD CONSTRAINT print_runs_delivery_mode_check
  CHECK (delivery_mode IS NULL OR delivery_mode IN ('warehouse', 'direct_to_client'));

-- Add comments
COMMENT ON COLUMN print_runs.delivery_mode IS 'warehouse = goes to QC, direct_to_client = shipped directly';
COMMENT ON COLUMN print_runs.qc_checklist IS 'JSON: {design_match, print_quality, sealing, color, qty_confirmed}';
COMMENT ON COLUMN print_run_jobs.received_qty IS 'Actual qty received from printer (for QC)';
