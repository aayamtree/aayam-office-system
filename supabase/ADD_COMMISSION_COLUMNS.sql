-- ============================================================
-- COMMISSION SYSTEM — Streamlined (no new table!)
-- Commission data lives directly on the jobs table.
-- Run this once in Supabase SQL Editor.
-- ============================================================

-- 1. Default commission rate per marketing person (on their profile)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 5.0;
COMMENT ON COLUMN profiles.commission_rate IS 'Default commission % for this marketing person. Admin sets per person.';

-- 2. Commission columns on jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS commission_user_id UUID REFERENCES profiles(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'none'
  CHECK (commission_status IN ('none', 'eligible', 'approved', 'paid'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMP;

COMMENT ON COLUMN jobs.commission_user_id IS 'Marketing person who earns commission on this job';
COMMENT ON COLUMN jobs.commission_percentage IS 'Commission % applied (copied from profiles.commission_rate at time of eligibility)';
COMMENT ON COLUMN jobs.commission_amount IS 'Final commission amount = base_amount × commission_percentage / 100';
COMMENT ON COLUMN jobs.commission_status IS 'none → eligible → approved → paid';
COMMENT ON COLUMN jobs.commission_paid_at IS 'When admin physically paid out the commission';

-- 3. Index for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_jobs_commission_user ON jobs(commission_user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_commission_status ON jobs(commission_status);

-- ============================================================
-- HOW IT WORKS:
-- 1. When a lead is converted to client → job, commission_user_id is set
--    to the marketing person linked to that client.
-- 2. When admin records full payment (amount_received >= total_amount),
--    the app sets commission_status = 'eligible' and calculates commission_amount
--    using: (total_amount - GST) × commission_percentage / 100
-- 3. Admin reviews eligible commissions → clicks Approve → status = 'approved'
-- 4. Admin pays the marketing person → clicks Mark Paid → status = 'paid'
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Commission columns added to jobs and profiles tables successfully!';
  RAISE NOTICE 'No new tables created — commission data lives on the jobs table.';
END $$;
