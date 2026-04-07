-- ============================================================
-- FIX: Marketing Orders Sync Issue
-- Date: 2026-04-07
-- Problem: Orders created from quotations against existing clients
--          were not appearing in Marketing > Orders because the
--          client.source was not set to 'marketing'.
--
-- Root Cause: handleConvertToOrder() only runs convertToClient()
--             (which sets source='marketing') when a Lead is being
--             converted. If the quotation already had a client_id,
--             that path was skipped — leaving source as 'direct'/null.
--             Marketing Orders filter: job.client?.source = 'marketing'
--             → those orders became invisible.
--
-- This script fixes existing data. The code fix in
-- app/admin/sales/quotations/page.tsx prevents future occurrences.
-- ============================================================

-- STEP 1: Audit — see which accepted quotations have an order created
--         but the client is NOT tagged as marketing-sourced.
--         Run this first to understand the scope of the problem.

SELECT
  q.quote_number,
  q.status,
  q.converted_to_job_id,
  c.name AS client_name,
  c.company AS client_company,
  c.source AS client_source,
  j.job_number,
  p.full_name AS created_by_user,
  p.role AS creator_role
FROM quotations q
JOIN clients c ON c.id = q.client_id
LEFT JOIN jobs j ON j.id = q.converted_to_job_id
LEFT JOIN profiles p ON p.id = q.created_by
WHERE q.status = 'accepted'
  AND q.converted_to_job_id IS NOT NULL
  AND (c.source IS NULL OR c.source != 'marketing')
ORDER BY q.created_at DESC;


-- STEP 2: Fix — tag these clients as marketing-sourced.
--         Only run after reviewing STEP 1 output above.
--         We only fix clients whose orders were created by a marketing-role user.

UPDATE clients
SET
  source = 'marketing',
  updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT q.client_id
  FROM quotations q
  JOIN profiles p ON p.id = q.created_by
  WHERE q.status = 'accepted'
    AND q.converted_to_job_id IS NOT NULL
    AND (clients.source IS NULL OR clients.source != 'marketing')
    AND p.role = 'marketing'
);


-- STEP 3: Verify fix worked — this should return 0 rows after the update.

SELECT
  q.quote_number,
  c.name AS client_name,
  c.source AS client_source,
  j.job_number
FROM quotations q
JOIN clients c ON c.id = q.client_id
LEFT JOIN jobs j ON j.id = q.converted_to_job_id
WHERE q.status = 'accepted'
  AND q.converted_to_job_id IS NOT NULL
  AND (c.source IS NULL OR c.source != 'marketing')
  AND q.created_by IN (SELECT id FROM profiles WHERE role = 'marketing');


-- STEP 4 (optional): If you want to specifically fix LEVINA LEXUS and are
--                    sure of the company name, use this targeted fix instead of STEP 2:
--
-- UPDATE clients
-- SET source = 'marketing', updated_at = NOW()
-- WHERE company = 'LEVINA LEXUS FROM ODISHA'
--    OR name = 'LEVINA LEXUS FROM ODISHA';
