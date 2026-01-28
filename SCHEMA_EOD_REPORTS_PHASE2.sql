-- =====================================================
-- EOD REPORTS - PHASE 2: PRODUCTION CHECKLIST INTEGRATION
-- Purpose: Add status-based workflow and checklist tracking
-- =====================================================

-- ============================
-- ADD NEW COLUMNS TO report_task_updates
-- ============================

-- Add task status column
ALTER TABLE report_task_updates
  ADD COLUMN IF NOT EXISTS task_status VARCHAR(50) DEFAULT 'START WORK';

-- Add product type to link with job_checklists
ALTER TABLE report_task_updates
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(100);

-- Add assignment tracking
ALTER TABLE report_task_updates
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE report_task_updates
  ADD COLUMN IF NOT EXISTS assignment_source VARCHAR(50); -- 'admin', 'teammate', 'extension'

-- Update checklist column comment to reflect new structure
COMMENT ON COLUMN report_task_updates.checklist IS 'Detailed checklist with completion status and comments: [{"item": "Bleed", "checked": true, "comment": "3mm added", "order": 1}]';

-- ============================
-- HELPER FUNCTION: Get Checklist by Product Type
-- ============================

CREATE OR REPLACE FUNCTION get_design_checklist_items(p_product_type TEXT)
RETURNS JSONB AS $$
DECLARE
  checklist_items JSONB;
BEGIN
  -- Fetch checklist items from job_checklists table
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'item', item_value,
        'checked', false,
        'comment', '',
        'order', row_num
      ) ORDER BY row_num
    ),
    '[]'::jsonb
  )
  INTO checklist_items
  FROM (
    SELECT 
      unnest(items) as item_value,
      row_number() OVER () as row_num
    FROM job_checklists
    WHERE job_type = p_product_type
    AND category = 'design'
    LIMIT 1
  ) AS items_table;
  
  RETURN checklist_items;
END;
$$ LANGUAGE plpgsql;

-- ============================
-- INDICES FOR PERFORMANCE
-- ============================

CREATE INDEX IF NOT EXISTS idx_task_updates_status ON report_task_updates(task_status);
CREATE INDEX IF NOT EXISTS idx_task_updates_product_type ON report_task_updates(product_type);
CREATE INDEX IF NOT EXISTS idx_task_updates_assigned_by ON report_task_updates(assigned_by);

-- ============================
-- UPDATE EXISTING RECORDS (if any)
-- ============================

-- Set default product_type from jobs table (if job_id exists)
UPDATE report_task_updates rtu
SET product_type = j.job_type
FROM jobs j
WHERE rtu.job_id = j.id
AND rtu.product_type IS NULL;

-- ============================
-- COMMENTS FOR DOCUMENTATION
-- ============================

COMMENT ON COLUMN report_task_updates.task_status IS 'Current status: NOT START, START WORK, COMPLETE';
COMMENT ON COLUMN report_task_updates.product_type IS 'Product type copied from jobs.job_type for checklist lookup';
COMMENT ON COLUMN report_task_updates.assigned_by IS 'User who assigned this task';
COMMENT ON COLUMN report_task_updates.assignment_source IS 'How task was assigned: admin, teammate, extension';

-- ============================
-- SUCCESS MESSAGE
-- ============================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 2 Schema Updates Applied Successfully!';
  RAISE NOTICE '📋 Added columns: task_status, product_type, assigned_by, assignment_source';
  RAISE NOTICE '🔍 Created helper function: get_design_checklist_items()';
  RAISE NOTICE '⚡ Added performance indices';
END $$;
