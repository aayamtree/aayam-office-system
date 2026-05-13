-- Add packing_info JSONB column to jobs table
-- Stores: { verified_qty, package_type, package_count, approx_weight_kg, packing_notes }
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS packing_info JSONB DEFAULT NULL;

-- Add invoice reference and e-way bill fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_reference TEXT DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eway_bill_number TEXT DEFAULT NULL;

-- Comments
COMMENT ON COLUMN jobs.packing_info IS 'Packing details filled by dispatch after QC pass. Contains verified_qty, package_type (box/sack/bundle/other), package_count, approx_weight_kg, packing_notes';
COMMENT ON COLUMN jobs.invoice_reference IS 'Invoice reference number added by admin';
COMMENT ON COLUMN jobs.eway_bill_number IS 'E-Way Bill number added by admin';
