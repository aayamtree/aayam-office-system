-- Fix: moving a run back from After Print Process failed with
-- "Cannot move a run in after_print back to printing_done".
-- fn_rollback_print_run did not know the after_print status.
-- ALREADY APPLIED to the live database on 2026-10-08 (migration rollback_print_run_after_print).
-- Kept here as a record only.
-- Steps back: after_print -> printing_done; qc -> after_print if the run came from there,
-- otherwise printing_done. fn_print_run_implied_stage is deliberately left returning null
-- for after_print (jobs stay where Printing Done left them), matching sync-stage/route.ts.
CREATE OR REPLACE FUNCTION public.fn_rollback_print_run(p_run_id uuid, p_to_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cur text; v_expected text; v_name text; v_hist uuid; v_prev text;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to move a run back';
  end if;

  select status into v_cur from print_runs where id = p_run_id for update;
  if v_cur is null then raise exception 'Print run not found'; end if;

  if v_cur = 'qc' then
    select from_status into v_prev from print_run_status_history
     where print_run_id = p_run_id and to_status = 'qc'
     order by created_at desc limit 1;
  end if;

  v_expected := case v_cur
    when 'at_printer' then 'planned'
    when 'printing_done' then 'at_printer'
    when 'after_print' then 'printing_done'
    when 'qc' then case when v_prev = 'after_print' then 'after_print' else 'printing_done' end
    when 'handed_over' then 'qc'
    when 'dispatched' then 'printing_done'
    else null end;
  if v_expected is null or v_expected is distinct from p_to_status then
    raise exception 'Cannot move a run in % back to %', v_cur, p_to_status;
  end if;

  select full_name into v_name from profiles where id = auth.uid();

  if v_cur = 'dispatched' then
    update print_runs set status = p_to_status, updated_at = now(),
           dispatch_date = null, delivery_mode = null, delivery_address = null,
           transporter_name = null, eway_bill_number = null, invoice_reference = null,
           invoice_doc_url = null, eway_doc_url = null
     where id = p_run_id;
  else
    update print_runs set status = p_to_status, updated_at = now() where id = p_run_id;
  end if;

  select id into v_hist from print_run_status_history
   where print_run_id = p_run_id order by created_at desc limit 1;
  update print_run_status_history
     set is_rollback = true, reason = btrim(p_reason), changed_by_name = v_name
   where id = v_hist;

  return p_to_status;
end; $function$;
