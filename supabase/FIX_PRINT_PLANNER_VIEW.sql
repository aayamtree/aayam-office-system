-- =====================================================
-- FIX: Print Planner should auto-show printing jobs
-- =====================================================
-- The pending_print_jobs view was only checking print_ready = true,
-- but nothing sets that flag. Now it also includes jobs at 'printing' stage.
-- =====================================================

DROP VIEW IF EXISTS pending_print_jobs;

CREATE VIEW pending_print_jobs AS
SELECT 
    j.*,
    c.name as client_name
FROM jobs j
LEFT JOIN clients c ON j.client_id = c.id
LEFT JOIN print_run_jobs prj ON j.id = prj.job_id
WHERE 
    (j.print_ready = true OR j.current_stage = 'printing')
    AND j.status != 'delivered'
    AND prj.id IS NULL  -- Not in any print run yet
ORDER BY j.created_at ASC;

-- Grant permissions
GRANT SELECT ON pending_print_jobs TO authenticated;
