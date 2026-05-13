-- ═══════════════════════════════════════════════════════════════
-- DESIGNER_MODULE_PATCH_001.sql
-- Fix: updated_at column missing from design_tasks trigger
-- Run this in Supabase SQL Editor to fix "Go LIVE" status update
-- ═══════════════════════════════════════════════════════════════

-- 1. Add updated_at column if missing
ALTER TABLE design_tasks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Update existing rows to have a valid updated_at
UPDATE design_tasks SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Recreate the trigger function to be safe (handles both old and new column names)
CREATE OR REPLACE FUNCTION update_design_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Ensure trigger exists
DROP TRIGGER IF EXISTS trg_design_tasks_updated_at ON design_tasks;
CREATE TRIGGER trg_design_tasks_updated_at
  BEFORE UPDATE ON design_tasks
  FOR EACH ROW EXECUTE FUNCTION update_design_tasks_updated_at();

-- 5. Verify the column now exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'design_tasks'
  AND column_name IN ('updated_at', 'current_status', 'task_code')
ORDER BY column_name;
