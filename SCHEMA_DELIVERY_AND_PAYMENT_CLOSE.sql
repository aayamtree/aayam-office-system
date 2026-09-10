-- Applied 2026-09-10 to aayam-fresh (wrvbodgsykesbaphpbzs).
-- Kept here as the record of what changed and why.
--
-- Problem: clicking "Mark Delivered" made the card vanish instead of moving it to
-- the Delivered column. Two causes:
--   1. Nothing ever wrote a dispatch or delivery date. dispatched_at existed but no
--      trigger filled it, and delivered_at did not exist. The board's 7-day window
--      fell back to updated_at, so a job delivered today but last edited nine days
--      ago was already "too old" and dropped straight into Closed.
--   2. The board read "balance is zero" as "paid". 348 finished jobs had no amount
--      entered at all, so they were archived as settled instead of flagged.

-- ── 1. columns + stamping trigger ────────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS delivered_at        timestamptz,
  ADD COLUMN IF NOT EXISTS closed_manually_at  timestamptz,
  ADD COLUMN IF NOT EXISTS close_reason        text;

CREATE OR REPLACE FUNCTION public.fn_stamp_job_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    IF NEW.current_stage = 'dispatched' AND NEW.dispatched_at IS NULL THEN
      NEW.dispatched_at := now();
    END IF;
    IF NEW.current_stage = 'delivered' THEN
      IF NEW.delivered_at  IS NULL THEN NEW.delivered_at  := now(); END IF;
      IF NEW.dispatched_at IS NULL THEN NEW.dispatched_at := now(); END IF;
    END IF;
    IF NEW.current_stage = 'file_sent_client' AND NEW.completed_date IS NULL THEN
      NEW.completed_date := now();
    END IF;
    -- A job pulled back into production must not stay invisible.
    IF NEW.current_stage NOT IN ('delivered', 'file_sent_client', 'cancelled') THEN
      NEW.closed_manually_at := NULL;
      NEW.close_reason       := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_job_milestones ON public.jobs;
CREATE TRIGGER trg_stamp_job_milestones
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_job_milestones();

CREATE INDEX IF NOT EXISTS idx_jobs_delivered_at ON public.jobs (delivered_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_jobs_stage_closed ON public.jobs (current_stage, closed_manually_at);

-- ── 2. backfill real dates from job_stage_history (226 of 275 recovered) ─────
-- trg_auto_log_jobs disabled around these so a data repair does not write 500
-- "updated job" rows into activity_logs.
UPDATE public.jobs j SET delivered_at = h.created_at
  FROM (SELECT DISTINCT ON (job_id) job_id, created_at FROM public.job_stage_history
         WHERE to_stage = 'delivered' ORDER BY job_id, created_at DESC) h
 WHERE h.job_id = j.id AND j.delivered_at IS NULL;

UPDATE public.jobs j SET dispatched_at = h.created_at
  FROM (SELECT DISTINCT ON (job_id) job_id, created_at FROM public.job_stage_history
         WHERE to_stage = 'dispatched' ORDER BY job_id, created_at DESC) h
 WHERE h.job_id = j.id AND j.dispatched_at IS NULL;

UPDATE public.jobs j SET completed_date = h.created_at
  FROM (SELECT DISTINCT ON (job_id) job_id, created_at FROM public.job_stage_history
         WHERE to_stage = 'file_sent_client' ORDER BY job_id, created_at DESC) h
 WHERE h.job_id = j.id AND j.completed_date IS NULL;

-- ── 3. one-time clean slate ──────────────────────────────────────────────────
-- 348 finished jobs with no amount ever entered. Under the new rule they would
-- all land on the board at once, so they are closed here explicitly, with a
-- reason, and the new rule starts from today.
UPDATE public.jobs
   SET closed_manually_at = now(),
       close_reason = 'Legacy cleanup 2026-09-10 — finished before amount tracking, no amount recorded'
 WHERE current_stage IN ('delivered', 'file_sent_client')
   AND COALESCE(total_amount, 0) = 0
   AND closed_manually_at IS NULL;
