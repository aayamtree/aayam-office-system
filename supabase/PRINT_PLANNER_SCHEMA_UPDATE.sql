-- ============================================
-- PRINT PLANNER - MINIMAL SCHEMA ADDITIONS
-- ============================================
-- Adding minimal fields to existing tables for print planner

-- ============================================
-- 1. ADD JOB_TYPE TO JOBS TABLE
-- ============================================
-- This allows filtering and batching by job type (STICKER, POUCH, BOX, etc.)

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT;

COMMENT ON COLUMN jobs.job_type IS 'Type of job: STICKER, POUCH, BOX, BANNER, FLEX, VINYL, etc. Used to group jobs in print runs.';

-- ============================================
-- 2. ENHANCE PRINT_RUNS TABLE
-- ============================================
-- Add vendor tracking and deadline

ALTER TABLE print_runs ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);
ALTER TABLE print_runs ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE print_runs ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN print_runs.vendor_id IS 'Vendor/printer assigned to this print run';
COMMENT ON COLUMN print_runs.deadline IS 'Deadline for completing this print run';
COMMENT ON COLUMN print_runs.total_amount IS 'Total cost for this print run from vendor';

-- ============================================
-- 3. ADD JOB_TYPE TO PRINT_RUN_JOBS
-- ============================================
-- Cache job_type for easier querying without joining jobs table

ALTER TABLE print_run_jobs ADD COLUMN IF NOT EXISTS job_type TEXT;

COMMENT ON COLUMN print_run_jobs.job_type IS 'Cached job type from jobs table for faster filtering';

-- ============================================
-- 4. CREATE TRIGGER TO AUTO-POPULATE JOB_TYPE
-- ============================================
-- When adding job to print run, automatically copy job_type

CREATE OR REPLACE FUNCTION copy_job_type_to_print_run_job()
RETURNS TRIGGER AS $$
BEGIN
    -- Get job_type from jobs table and copy to print_run_jobs
    SELECT job_type INTO NEW.job_type
    FROM jobs
    WHERE id = NEW.job_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_copy_job_type ON print_run_jobs;
CREATE TRIGGER trigger_copy_job_type
    BEFORE INSERT ON print_run_jobs
    FOR EACH ROW
    EXECUTE FUNCTION copy_job_type_to_print_run_job();

-- ============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_print_runs_vendor_id ON print_runs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_print_run_jobs_job_type ON print_run_jobs(job_type);

-- ============================================
-- 6. CREATE VIEW: PENDING PRINT JOBS
-- ============================================
-- Jobs ready for print but not yet in any print run

CREATE OR REPLACE VIEW pending_print_jobs AS
SELECT 
    j.*,
    c.name as client_name
FROM jobs j
LEFT JOIN clients c ON j.client_id = c.id
LEFT JOIN print_run_jobs prj ON j.id = prj.job_id
WHERE 
    j.print_ready = true
    AND j.status != 'delivered'
    AND prj.id IS NULL  -- Not in any print run yet
ORDER BY j.created_at ASC;

-- ============================================
-- 7. CREATE VIEW: VENDOR SUMMARY
-- ============================================
-- Summary of work and payments per vendor

CREATE OR REPLACE VIEW vendor_print_summary AS
SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    COUNT(DISTINCT pr.id) as total_print_runs,
    COUNT(DISTINCT prj.job_id) as total_jobs,
    SUM(pr.total_amount) as total_amount,
    SUM(CASE WHEN pr.status = 'planned' THEN 1 ELSE 0 END) as planned_runs,
    SUM(CASE WHEN pr.status = 'printed' THEN 1 ELSE 0 END) as printed_runs,
    SUM(CASE WHEN pr.status = 'delivered' THEN 1 ELSE 0 END) as delivered_runs
FROM vendors v
LEFT JOIN print_runs pr ON v.id = pr.vendor_id
LEFT JOIN print_run_jobs prj ON pr.id = prj.print_run_id
GROUP BY v.id, v.name;

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT SELECT ON pending_print_jobs TO authenticated;
GRANT SELECT ON vendor_print_summary TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PRINT PLANNER SCHEMA UPDATED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New Fields:';
    RAISE NOTICE '  - jobs.job_type (STICKER/POUCH/BOX/etc)';
    RAISE NOTICE '  - print_runs.vendor_id';
    RAISE NOTICE '  - print_runs.deadline';
    RAISE NOTICE '  - print_runs.total_amount';
    RAISE NOTICE '';
    RAISE NOTICE 'New Views:';
    RAISE NOTICE '  - pending_print_jobs';
    RAISE NOTICE '  - vendor_print_summary';
    RAISE NOTICE '';
    RAISE NOTICE 'Triggers:';
    RAISE NOTICE '  - Auto-copy job_type to print_run_jobs';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Ready for print planner redesign!';
    RAISE NOTICE '========================================';
END $$;
