-- =============================================
-- ADD design_charge TO jobs TABLE
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add design_charge column (flat fee for design work)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS design_charge NUMERIC(12, 2) DEFAULT 0;

-- 2. Update existing Design Only jobs: move their subtotal into design_charge
--    (optional — only if you want to backfill existing data)
-- UPDATE jobs
--   SET design_charge = subtotal
--   WHERE job_type = 'design_only' AND design_charge = 0;

-- 3. Verify
SELECT id, job_number, job_type, design_charge, quote_per_piece, subtotal, total_amount
FROM jobs
ORDER BY created_at DESC
LIMIT 10;
