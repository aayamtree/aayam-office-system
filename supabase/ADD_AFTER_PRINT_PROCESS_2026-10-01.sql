-- New print-run stage: After Print Process (between Printing Done and In QC).
-- Cutting, creasing, pinning, lamination etc. done by outside vendors after printing.
-- Run this ONCE in the Supabase SQL editor, before using the new stage.
-- Jobs are not moved by this stage (fn_print_run_implied_stage returns null for unknown
-- statuses), so they stay where Printing Done left them.
ALTER TABLE print_runs DROP CONSTRAINT IF EXISTS print_runs_status_check;
ALTER TABLE print_runs ADD CONSTRAINT print_runs_status_check
  CHECK (status IN ('planned', 'at_printer', 'printing_done', 'after_print', 'qc', 'handed_over', 'dispatched'));
