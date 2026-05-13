-- ============================================================
-- ADD NEW JOB WORKFLOW STAGES
-- Run in Supabase SQL Editor
-- Adds: file_check, pre_print_qc
-- ============================================================

-- First check existing order_index values to avoid conflicts:
SELECT id, name, order_index FROM job_stages ORDER BY order_index;

-- Add file_check stage
INSERT INTO job_stages (id, name, color, bg_light, border, order_index, is_active)
VALUES ('file_check', 'File Check', 'bg-purple-500', 'bg-purple-50', 'border-purple-200', 25, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, color = EXCLUDED.color,
  bg_light = EXCLUDED.bg_light, border = EXCLUDED.border,
  order_index = EXCLUDED.order_index, is_active = EXCLUDED.is_active;

-- Add pre_print_qc stage (between approval and printing)
INSERT INTO job_stages (id, name, color, bg_light, border, order_index, is_active)
VALUES ('pre_print_qc', 'Pre Print QC', 'bg-cyan-500', 'bg-cyan-50', 'border-cyan-200', 55, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, color = EXCLUDED.color,
  bg_light = EXCLUDED.bg_light, border = EXCLUDED.border,
  order_index = EXCLUDED.order_index, is_active = EXCLUDED.is_active;

-- Verify
SELECT id, name, color, bg_light, border, order_index, is_active
FROM job_stages
ORDER BY order_index;
