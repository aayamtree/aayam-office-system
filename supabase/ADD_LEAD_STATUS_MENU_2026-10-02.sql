-- =====================================================================
-- LEAD STATUS DROPDOWN, SR. MENU, AND "PICK A LEAD IN QUOTATION"
-- Run ONCE in Supabase SQL Editor, at the same time the new app code goes live.
-- Safe to run twice (nothing is duplicated, nothing is deleted).
--
-- What it does
--   1. Converts old lead statuses to the 7 new ones
--   2. Adds lead_history (who / when / what for every lead change)
--   3. change_lead_status()    - status + note + date + history, all or nothing
--   4. add_lead_followup()     - follow-up + date + history, all or nothing
--   5. make_client_from_lead() - find-or-create the client, used by every button
--
-- Old -> new status:
--   new -> fresh_lead            contacted -> in_followup
--   quotation_shared -> in_review   follow_up -> in_followup
--   converted -> deal_done       lost -> cancelled
-- New keys: fresh_lead, in_followup, in_review, deal_done,
--           cancelled, not_interested, not_in_product
-- Closed ones: deal_done, cancelled, not_interested, not_in_product
-- =====================================================================

-- 1. STATUS CONVERSION --------------------------------------------------
UPDATE leads SET status = CASE status
    WHEN 'new'              THEN 'fresh_lead'
    WHEN 'contacted'        THEN 'in_followup'
    WHEN 'quotation_shared' THEN 'in_review'
    WHEN 'follow_up'        THEN 'in_followup'
    WHEN 'converted'        THEN 'deal_done'
    WHEN 'lost'             THEN 'cancelled'
    ELSE status END
WHERE status IN ('new','contacted','quotation_shared','follow_up','converted','lost');

ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'fresh_lead';

-- A closed lead must not keep a follow-up date.
UPDATE leads SET next_follow_up = NULL
WHERE status IN ('deal_done','cancelled','not_interested','not_in_product')
  AND next_follow_up IS NOT NULL;

-- 2. HISTORY TABLE ------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_history (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    kind             text NOT NULL,   -- status_change | follow_up | converted_to_client
    old_status       text,
    new_status       text,
    note             text,
    created_by       uuid,
    created_by_name  text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_history_lead ON lead_history(lead_id, created_at DESC);

ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_history_read ON lead_history;
CREATE POLICY lead_history_read ON lead_history FOR SELECT TO authenticated USING (true);
-- No insert/update/delete policy on purpose: history is written only by the functions below.

-- Shared permission check (admin = any lead; marketing = own leads only)
CREATE OR REPLACE FUNCTION _lead_actor(p_lead leads, OUT o_uid uuid, OUT o_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
    o_uid := auth.uid();
    IF o_uid IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;
    SELECT role, full_name INTO v_role, o_name FROM profiles WHERE id = o_uid;
    IF v_role = 'admin' THEN RETURN; END IF;
    IF v_role = 'marketing' AND (p_lead.assigned_to = o_uid OR p_lead.created_by = o_uid) THEN RETURN; END IF;
    RAISE EXCEPTION 'You do not have permission to change this lead.';
END $$;

-- 3. CHANGE STATUS ------------------------------------------------------
CREATE OR REPLACE FUNCTION change_lead_status(
    p_lead_id uuid, p_new_status text, p_note text, p_next_follow_up date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lead leads; v_uid uuid; v_name text; v_closed boolean; v_old text; v_row leads;
BEGIN
    IF p_new_status NOT IN ('fresh_lead','in_followup','in_review','deal_done','cancelled','not_interested','not_in_product') THEN
        RAISE EXCEPTION 'Unknown status: %', p_new_status;
    END IF;
    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION 'A note is required.';
    END IF;

    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found.'; END IF;
    SELECT o_uid, o_name INTO v_uid, v_name FROM _lead_actor(v_lead);

    v_old := v_lead.status;
    IF v_old = p_new_status THEN RAISE EXCEPTION 'The lead is already in this status.'; END IF;
    v_closed := p_new_status IN ('deal_done','cancelled','not_interested','not_in_product');

    UPDATE leads SET
        status         = p_new_status,
        next_follow_up = CASE WHEN v_closed THEN NULL
                              WHEN p_next_follow_up IS NOT NULL THEN p_next_follow_up::timestamptz
                              ELSE next_follow_up END,
        lost_reason    = CASE WHEN p_new_status IN ('cancelled','not_interested','not_in_product')
                              THEN btrim(p_note) ELSE lost_reason END,
        last_contacted = now(),
        updated_at     = now()
    WHERE id = p_lead_id RETURNING * INTO v_row;

    IF v_closed THEN
        UPDATE follow_ups SET status = 'closed' WHERE lead_id = p_lead_id AND status = 'pending';
    END IF;

    INSERT INTO lead_history(lead_id, kind, old_status, new_status, note, created_by, created_by_name)
    VALUES (p_lead_id, 'status_change', v_old, p_new_status, btrim(p_note), v_uid, v_name);

    RETURN to_jsonb(v_row);
END $$;

-- 4. ADD FOLLOW-UP ------------------------------------------------------
CREATE OR REPLACE FUNCTION add_lead_followup(
    p_lead_id uuid, p_note text, p_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lead leads; v_uid uuid; v_name text; v_when date; v_row leads; v_new text;
BEGIN
    IF p_note IS NULL OR btrim(p_note) = '' THEN RAISE EXCEPTION 'A note is required.'; END IF;
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found.'; END IF;
    IF v_lead.status IN ('deal_done','cancelled','not_interested','not_in_product') THEN
        RAISE EXCEPTION 'This lead is closed. Switch it to an open status first.';
    END IF;
    SELECT o_uid, o_name INTO v_uid, v_name FROM _lead_actor(v_lead);

    v_when := COALESCE(p_date, (now() AT TIME ZONE 'Asia/Kolkata')::date);
    v_new  := CASE WHEN v_lead.status = 'fresh_lead' THEN 'in_followup' ELSE v_lead.status END;

    INSERT INTO follow_ups(lead_id, follow_up_date, notes, status, done_by, assigned_to)
    VALUES (p_lead_id, v_when::timestamptz, btrim(p_note), 'pending', v_uid, v_lead.assigned_to);

    UPDATE leads SET status = v_new, next_follow_up = v_when::timestamptz,
                     last_contacted = now(), updated_at = now()
    WHERE id = p_lead_id RETURNING * INTO v_row;

    INSERT INTO lead_history(lead_id, kind, old_status, new_status, note, created_by, created_by_name)
    VALUES (p_lead_id, 'follow_up', v_lead.status, v_new,
            btrim(p_note) || ' (next follow-up ' || to_char(v_when,'DD Mon YYYY') || ')', v_uid, v_name);

    RETURN to_jsonb(v_row);
END $$;

-- 5. FIND-OR-CREATE CLIENT FROM A LEAD -----------------------------------
-- Same company name (ignoring capitals and spaces at the ends) -> reuse that client.
-- Otherwise create one. If the lead is already linked to a client, return that one,
-- so a retry can never create a second client.
CREATE OR REPLACE FUNCTION make_client_from_lead(
    p_lead_id uuid, p_mark_won boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lead leads; v_uid uuid; v_name text; v_company text;
    v_client clients; v_created boolean := false;
BEGIN
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found.'; END IF;
    SELECT o_uid, o_name INTO v_uid, v_name FROM _lead_actor(v_lead);

    -- Already linked? Return it.
    IF v_lead.converted_to_client_id IS NOT NULL THEN
        SELECT * INTO v_client FROM clients WHERE id = v_lead.converted_to_client_id;
    END IF;

    IF v_client.id IS NULL THEN
        v_company := COALESCE(NULLIF(btrim(v_lead.company),''), btrim(v_lead.name));
        PERFORM pg_advisory_xact_lock(hashtext(lower(v_company)));

        SELECT * INTO v_client FROM clients
        WHERE lower(btrim(company)) = lower(v_company)
        ORDER BY created_at LIMIT 1;

        IF v_client.id IS NULL THEN
            INSERT INTO clients(name, company, email, phone, notes, is_active, outstanding_balance,
                                client_type, credit_limit, assigned_to, created_by, source,
                                assigned_marketing_user_id, source_lead_id)
            VALUES (v_lead.name, v_company, v_lead.email, v_lead.phone, v_lead.notes, true, 0,
                    'regular', 0, COALESCE(v_lead.assigned_to, v_uid), v_uid, 'marketing',
                    COALESCE(v_lead.assigned_to, v_uid), v_lead.id)
            RETURNING * INTO v_client;
            v_created := true;
        END IF;

        INSERT INTO lead_history(lead_id, kind, old_status, new_status, note, created_by, created_by_name)
        VALUES (p_lead_id, 'converted_to_client', v_lead.status, v_lead.status,
                'Converted to client: ' || COALESCE(v_client.company, v_client.name) ||
                CASE WHEN v_created THEN ' (new client)' ELSE ' (linked to existing client)' END,
                v_uid, v_name);
    END IF;

    UPDATE leads SET
        converted_to_client_id = v_client.id,
        status         = CASE WHEN p_mark_won THEN 'deal_done' ELSE status END,
        next_follow_up = CASE WHEN p_mark_won THEN NULL ELSE next_follow_up END,
        updated_at     = now()
    WHERE id = p_lead_id;

    IF p_mark_won AND v_lead.status <> 'deal_done' THEN
        INSERT INTO lead_history(lead_id, kind, old_status, new_status, note, created_by, created_by_name)
        VALUES (p_lead_id, 'status_change', v_lead.status, 'deal_done', 'Converted to client', v_uid, v_name);
    END IF;

    RETURN jsonb_build_object('client', to_jsonb(v_client), 'created', v_created);
END $$;

-- Only signed-in staff may call these.
REVOKE ALL ON FUNCTION change_lead_status(uuid,text,text,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION add_lead_followup(uuid,text,date)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION make_client_from_lead(uuid,boolean)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION _lead_actor(leads)                      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION change_lead_status(uuid,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION add_lead_followup(uuid,text,date)       TO authenticated;
GRANT EXECUTE ON FUNCTION make_client_from_lead(uuid,boolean)     TO authenticated;
