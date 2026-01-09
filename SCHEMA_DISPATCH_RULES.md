-- =============================================
-- DISPATCH RULES & GOVERNANCE
-- =============================================

-- 1. STRICT DISPATCH-INVOICE DEPENDENCY
-- Trigger to prevent creating a dispatch record if no invoice exists for the job.

CREATE OR REPLACE FUNCTION check_dispatch_invoice_dependency()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if an invoice exists for this job
  IF NOT EXISTS (
    SELECT 1 FROM invoices 
    WHERE job_id = NEW.job_id
  ) THEN
    RAISE EXCEPTION 'STRICT RULE: Cannot Dispatch without an Invoice. Please generate an invoice for Job % first.', NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_dispatch_invoice ON dispatches;
CREATE TRIGGER trigger_check_dispatch_invoice
  BEFORE INSERT ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION check_dispatch_invoice_dependency();

-- 2. UPDATE JOB STATUS ON DISPATCH (Ensure Linkage)
-- When dispatch is created, ensure Job updates to 'dispatched' (already might be handled, but reinforcing)

CREATE OR REPLACE FUNCTION auto_update_job_status_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
   UPDATE jobs SET current_stage = 'dispatched', payment_status = payment_status -- Keep payment status
   WHERE id = NEW.job_id;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_job_on_dispatch ON dispatches;
CREATE TRIGGER trigger_update_job_on_dispatch
  AFTER INSERT ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_job_status_on_dispatch();
