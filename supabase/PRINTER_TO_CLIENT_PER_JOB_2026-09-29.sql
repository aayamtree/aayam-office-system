-- Print run hand-over no longer decides warehouse vs direct-to-client.
-- That is now chosen PER JOB on the Dispatch board ("Received -> QC" or "Printer -> Client").
-- Only change: a run in `handed_over` implies material_received (was quality_check),
-- so its jobs wait on the Dispatch board for the dispatch team's decision.
-- Safe for old runs: fn_sync_print_run_to_jobs never moves a job backwards
-- (rank guard), so jobs already at quality_check / ready / dispatched stay put.
CREATE OR REPLACE FUNCTION public.fn_print_run_implied_stage(p_status text, p_mode text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select case p_status
    when 'at_printer' then 'printing'
    when 'printing_done' then case when p_mode = 'warehouse' then 'quality_check' else 'material_received' end
    when 'qc' then 'quality_check'
    when 'handed_over' then 'material_received'
    when 'dispatched' then 'dispatched'
    else null end;
$function$;
