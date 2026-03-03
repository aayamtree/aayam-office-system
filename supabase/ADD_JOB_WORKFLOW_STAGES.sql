-- ============================================================
-- ADD NEW JOB WORKFLOW STAGES
-- Run in Supabase SQL Editor
-- Adds: file_check, pre_print_qc
-- ============================================================

-- Add file_check stage (order between new=1 and designing=3)
INSERT INTO job_stages (id, name, color, order_index, is_active, description)
VALUES (
  'file_check',
  'File Check',
  'purple',
  2,
  true,
  'Designer verifies client-supplied print file for resolution, CMYK, bleed etc.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  order_index = EXCLUDED.order_index,
  is_active = EXCLUDED.is_active;

-- Add pre_print_qc stage (order between approval=5 and printing=6)
INSERT INTO job_stages (id, name, color, order_index, is_active, description)
VALUES (
  'pre_print_qc',
  'Pre Print QC',
  'cyan',
  55,
  true,
  'Internal QC check before sending to press — file resolution, color, bleed marks verified.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  order_index = EXCLUDED.order_index,
  is_active = EXCLUDED.is_active;

-- Verify
SELECT id, name, color, order_index, is_active
FROM job_stages
ORDER BY order_index;
