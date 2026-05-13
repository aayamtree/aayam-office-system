-- =====================================================
-- FIX: Show company name instead of contact person name
-- =====================================================
-- The clients table has:
--   name    = contact person name (e.g. "Pratik Ranpariya")
--   company = company/business name (e.g. "Safal Foods")
--
-- Everywhere a "client name" is shown in the UI, we should
-- prefer the company name (falling back to contact name only
-- if no company is set).
--
-- This SQL fixes the pending_print_jobs view so that
-- client_name always returns: company if set, else name.
-- =====================================================

DROP VIEW IF EXISTS pending_print_jobs;

CREATE VIEW pending_print_jobs AS
SELECT
    j.*,
    COALESCE(NULLIF(TRIM(c.company), ''), c.name) AS client_name
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
