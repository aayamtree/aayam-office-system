-- ============================================================
-- AUTO ACTIVITY LOGGING — Database Triggers
-- Run once in Supabase SQL Editor.
-- This auto-logs to activity_logs whenever key tables change,
-- so you don't need to call logActivity() from app code.
-- ============================================================

-- ── Helper: get user full name from profiles ────────────────
CREATE OR REPLACE FUNCTION get_user_display_name(uid UUID)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(full_name, email, uid::text)
  FROM profiles WHERE id = uid LIMIT 1;
$$;

-- ── Master trigger function ─────────────────────────────────
CREATE OR REPLACE FUNCTION auto_log_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor_id      UUID;
  actor_name    TEXT;
  log_desc      TEXT;
  log_action    TEXT;
  log_entity    TEXT;
  log_entity_id TEXT;
  log_meta      JSONB;
  job_number_v  TEXT;
  job_name_v    TEXT;
BEGIN
  -- Determine the actor
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    actor_id := CASE
      WHEN TG_TABLE_NAME = 'jobs'     THEN NEW.created_by
      WHEN TG_TABLE_NAME = 'payments' THEN NEW.received_by
      ELSE NULL
    END;
  END IF;

  actor_name := CASE
    WHEN actor_id IS NOT NULL THEN get_user_display_name(actor_id)
    ELSE 'System'
  END;

  log_entity := TG_TABLE_NAME;

  -- ── JOBS ──────────────────────────────────────────────────
  IF TG_TABLE_NAME = 'jobs' THEN
    log_entity_id := NEW.id::TEXT;

    IF TG_OP = 'INSERT' THEN
      log_action := 'create';
      log_desc   := actor_name || ' created job ' || COALESCE(NEW.job_number, '') || ' — ' || COALESCE(NEW.project_name, 'Untitled');
      log_meta   := jsonb_build_object('job_number', NEW.job_number, 'project_name', NEW.project_name);

    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
        log_action := 'stage_change';
        log_desc   := actor_name || ' moved "' || COALESCE(NEW.project_name, NEW.job_number, 'Job')
                      || '" from ' || COALESCE(OLD.current_stage, '?') || ' → ' || COALESCE(NEW.current_stage, '?');
        log_meta   := jsonb_build_object('from', OLD.current_stage, 'to', NEW.current_stage, 'job_number', NEW.job_number);

      ELSIF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        log_action := 'update';
        log_desc   := actor_name || ' updated payment status of "' || COALESCE(NEW.project_name, NEW.job_number)
                      || '" to ' || COALESCE(NEW.payment_status, '?');
        log_meta   := jsonb_build_object('payment_status', NEW.payment_status, 'job_number', NEW.job_number);

      ELSIF OLD.commission_status IS DISTINCT FROM NEW.commission_status THEN
        log_action := 'approve';
        log_desc   := actor_name || ' set commission for "' || COALESCE(NEW.project_name, NEW.job_number)
                      || '" to ' || COALESCE(NEW.commission_status, '?');
        log_meta   := jsonb_build_object('commission_status', NEW.commission_status, 'job_number', NEW.job_number);

      ELSE
        log_action := 'update';
        log_desc   := actor_name || ' updated job ' || COALESCE(NEW.job_number, '') || ' — ' || COALESCE(NEW.project_name, 'Job');
        log_meta   := jsonb_build_object('job_number', NEW.job_number);
      END IF;
    END IF;

  -- ── PAYMENTS RECEIVED ──────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'payments_received' THEN
    log_entity_id := NEW.id::TEXT;
    IF TG_OP = 'INSERT' THEN
      -- Get linked job info
      SELECT j.job_number, j.project_name
        INTO job_number_v, job_name_v
        FROM jobs j WHERE j.id = NEW.job_id LIMIT 1;

      log_action := 'payment';
      log_desc   := actor_name || ' recorded payment of ₹' || COALESCE(NEW.amount::TEXT, '0')
                    || ' for ' || COALESCE(job_name_v, job_number_v, 'a job')
                    || ' (mode: ' || COALESCE(NEW.payment_mode, '?') || ')';
      log_meta   := jsonb_build_object('amount', NEW.amount, 'mode', NEW.payment_mode,
                                        'job_number', job_number_v, 'job_id', NEW.job_id);
    END IF;

  -- ── VENDOR PAYMENTS ────────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'vendor_payments' THEN
    log_entity_id := NEW.id::TEXT;
    IF TG_OP = 'INSERT' THEN
      log_action := 'payment';
      log_desc   := actor_name || ' paid vendor ₹' || COALESCE(NEW.amount::TEXT, '0')
                    || ' (mode: ' || COALESCE(NEW.payment_mode, '?') || ')';
      log_meta   := jsonb_build_object('amount', NEW.amount, 'mode', NEW.payment_mode, 'vendor_id', NEW.vendor_id);
    END IF;

  -- ── LEADS ──────────────────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'leads' THEN
    log_entity_id := NEW.id::TEXT;
    IF TG_OP = 'INSERT' THEN
      log_action := 'create';
      log_desc   := actor_name || ' added new lead: ' || COALESCE(NEW.company, NEW.name, 'Unknown');
      log_meta   := jsonb_build_object('name', NEW.name, 'company', NEW.company, 'source', NEW.source);
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      log_action := 'update';
      log_desc   := actor_name || ' updated lead "' || COALESCE(NEW.company, NEW.name)
                    || '" status: ' || OLD.status || ' → ' || NEW.status;
      log_meta   := jsonb_build_object('from', OLD.status, 'to', NEW.status);
    ELSE
      RETURN NEW;
    END IF;

  -- ── QUOTATIONS ─────────────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'quotations' THEN
    log_entity_id := NEW.id::TEXT;
    IF TG_OP = 'INSERT' THEN
      log_action := 'create';
      log_desc   := actor_name || ' created quotation ' || COALESCE(NEW.quotation_number, '')
                    || ' for ₹' || COALESCE(NEW.total_amount::TEXT, '0');
      log_meta   := jsonb_build_object('quotation_number', NEW.quotation_number, 'total', NEW.total_amount);
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      log_action := 'update';
      log_desc   := actor_name || ' updated quotation ' || COALESCE(NEW.quotation_number, '')
                    || ' to ' || COALESCE(NEW.status, '?');
      log_meta   := jsonb_build_object('status', NEW.status, 'quotation_number', NEW.quotation_number);
    ELSE
      RETURN NEW;
    END IF;

  -- ── CLIENTS ────────────────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'clients' THEN
    log_entity_id := NEW.id::TEXT;
    IF TG_OP = 'INSERT' THEN
      log_action := 'create';
      log_desc   := actor_name || ' added new client: ' || COALESCE(NEW.company, NEW.name, 'Unknown');
      log_meta   := jsonb_build_object('name', NEW.name, 'company', NEW.company);
    ELSE
      RETURN NEW;
    END IF;

  -- ── FOLLOW-UPS ─────────────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'follow_ups' THEN
    log_entity_id := NEW.id::TEXT;
    IF TG_OP = 'UPDATE' AND OLD.completed IS DISTINCT FROM NEW.completed AND NEW.completed = TRUE THEN
      log_action := 'update';
      log_desc   := actor_name || ' completed a follow-up';
      log_meta   := jsonb_build_object('follow_up_id', NEW.id);
    ELSE
      RETURN NEW;
    END IF;

  ELSE
    RETURN NEW;
  END IF;

  -- ── Write to activity_logs ─────────────────────────────────
  INSERT INTO activity_logs (
    user_id, action, entity_type, entity_id,
    description, metadata, ip_address
  ) VALUES (
    actor_id, log_action, log_entity, log_entity_id,
    log_desc, log_meta, NULL
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- Never crash the main operation
END;
$$;

-- ── Attach triggers (safe — skips tables that don't exist) ──

-- JOBS
DROP TRIGGER IF EXISTS trg_auto_log_jobs ON jobs;
CREATE TRIGGER trg_auto_log_jobs
  AFTER INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION auto_log_activity();

-- PAYMENTS RECEIVED
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments_received' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auto_log_payments_received ON payments_received;
    CREATE TRIGGER trg_auto_log_payments_received
      AFTER INSERT ON payments_received
      FOR EACH ROW EXECUTE FUNCTION auto_log_activity();
    RAISE NOTICE 'payments_received trigger installed';
  ELSE
    RAISE NOTICE 'payments_received table not found — skipped';
  END IF;
END $$;

-- VENDOR PAYMENTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_payments' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auto_log_vendor_payments ON vendor_payments;
    CREATE TRIGGER trg_auto_log_vendor_payments
      AFTER INSERT ON vendor_payments
      FOR EACH ROW EXECUTE FUNCTION auto_log_activity();
    RAISE NOTICE 'vendor_payments trigger installed';
  ELSE
    RAISE NOTICE 'vendor_payments table not found — skipped';
  END IF;
END $$;

-- LEADS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auto_log_leads ON leads;
    CREATE TRIGGER trg_auto_log_leads
      AFTER INSERT OR UPDATE ON leads
      FOR EACH ROW EXECUTE FUNCTION auto_log_activity();
    RAISE NOTICE 'leads trigger installed';
  ELSE
    RAISE NOTICE 'leads table not found — skipped';
  END IF;
END $$;

-- QUOTATIONS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotations' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auto_log_quotations ON quotations;
    CREATE TRIGGER trg_auto_log_quotations
      AFTER INSERT OR UPDATE ON quotations
      FOR EACH ROW EXECUTE FUNCTION auto_log_activity();
    RAISE NOTICE 'quotations trigger installed';
  ELSE
    RAISE NOTICE 'quotations table not found — skipped';
  END IF;
END $$;

-- CLIENTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auto_log_clients ON clients;
    CREATE TRIGGER trg_auto_log_clients
      AFTER INSERT ON clients
      FOR EACH ROW EXECUTE FUNCTION auto_log_activity();
    RAISE NOTICE 'clients trigger installed';
  ELSE
    RAISE NOTICE 'clients table not found — skipped';
  END IF;
END $$;

-- FOLLOW-UPS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follow_ups' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auto_log_follow_ups ON follow_ups;
    CREATE TRIGGER trg_auto_log_follow_ups
      AFTER UPDATE ON follow_ups
      FOR EACH ROW EXECUTE FUNCTION auto_log_activity();
    RAISE NOTICE 'follow_ups trigger installed';
  ELSE
    RAISE NOTICE 'follow_ups table not found — skipped';
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE '✅ Activity trigger setup complete. Check messages above for which tables were installed.';
END $$;
