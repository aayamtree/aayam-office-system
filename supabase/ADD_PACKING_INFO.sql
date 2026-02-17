-- Add packing_info JSONB column to jobs table
-- Stores: { verified_qty, package_type, package_count, approx_weight_kg, packing_notes }
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS packing_info JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN jobs.packing_info IS 'Packing details filled by dispatch after QC pass. Contains verified_qty, package_type (box/sack/bundle/other), package_count, approx_weight_kg, packing_notes';
