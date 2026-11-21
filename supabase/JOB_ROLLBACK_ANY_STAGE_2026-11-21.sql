-- Job rollback: allow ANY other stage of the job's flow (up to Ready for Dispatch), including "Pending QC".
-- Applied to the live database on 2026-11-21. Replaces fn_rollback_job from JOB_ROLLBACK_WITH_AUDIT_2026-10-12.sql.
-- Changes: (1) 'finishing' (shown as Pending QC / Post Print) is now a valid target, placed before quality_check;
--          (2) the "earlier stage only" rule is gone; going forward is allowed but never past 'ready'
--              (dispatch must go through the dispatch screen); (3) dispatch/package clean-up only on backward moves.
create or replace function public.fn_rollback_job(p_job_id uuid, p_to_stage text, p_reason text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_order text[] := array['new','designing','approval','pre_print_qc','print_file_ready','file_sent_client',
                          'file_received','file_check','ready_to_print','printing','material_received',
                          'finishing','quality_check','ready','dispatched','delivered'];
  v_flow text[];
  v record;
  v_uid uuid := auth.uid();
  v_name text; v_role text;
  v_from_i int; v_to_i int;
  v_pkg uuid;
  v_snap jsonb := '{}'::jsonb;
  v_disp jsonb;
  v_run text;
begin
  if not public.fn_is_admin() then
    raise exception 'Only an admin can roll a job back';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to roll a job back';
  end if;

  select * into v from jobs where id = p_job_id for update;
  if v.id is null then raise exception 'Job not found'; end if;

  v_flow := case
    when lower(coalesce(v.job_type,'')) like '%design%' and lower(coalesce(v.job_type,'')) like '%print%'
      then array['new','designing','approval','pre_print_qc','print_file_ready','ready_to_print','printing','material_received','finishing','quality_check','ready','dispatched','delivered']
    when lower(coalesce(v.job_type,'')) like '%design%'
      then array['new','designing','approval','pre_print_qc','print_file_ready','file_sent_client']
    else array['file_received','file_check','ready_to_print','printing','material_received','finishing','quality_check','ready','dispatched','delivered']
  end;

  v_from_i := array_position(v_order, v.current_stage);
  v_to_i   := array_position(v_order, p_to_stage);
  if v_from_i is null then raise exception 'Unknown current stage %', v.current_stage; end if;
  if v_to_i is null or not (p_to_stage = any(v_flow)) then
    raise exception '% is not a stage of this job''s flow', p_to_stage;
  end if;
  if v_to_i = v_from_i then
    raise exception 'The job is already at %', p_to_stage;
  end if;
  if v_to_i > array_position(v_order, 'ready') and v_to_i > v_from_i then
    raise exception 'Dispatch and delivery must be done from the dispatch screen, not by changing the stage here';
  end if;

  if v_to_i < array_position(v_order, 'printing') then
    select pr.status into v_run from print_run_jobs prj join print_runs pr on pr.id = prj.print_run_id
     where prj.job_id = p_job_id limit 1;
    if v_run is not null then
      raise exception 'This job is in a print run (%). Remove it from the run first, then roll back.', v_run;
    end if;
  end if;

  select full_name, role into v_name, v_role from profiles where id = v_uid;

  if v_to_i < v_from_i and v_to_i < array_position(v_order, 'dispatched') then
    select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_disp from dispatches d where d.job_id = p_job_id;
    if jsonb_array_length(v_disp) > 0 then
      v_snap := v_snap || jsonb_build_object('dispatches_removed', v_disp);
      delete from dispatches where job_id = p_job_id;
    end if;
    v_snap := v_snap || jsonb_build_object('dispatched_at', v.dispatched_at, 'delivered_at', v.delivered_at,
                                           'dispatch_mode', v.dispatch_mode);
    update jobs set dispatched_at = null, delivered_at = null, dispatch_mode = null,
                    dispatch_receipt_url = null where id = p_job_id;
  end if;

  if v_to_i < v_from_i and v_to_i < array_position(v_order, 'ready') and v.package_id is not null then
    v_pkg := v.package_id;
    v_snap := v_snap || jsonb_build_object('package_id_removed', v_pkg);
    update jobs set package_id = null where id = p_job_id;
    delete from packages p where p.id = v_pkg and not exists (select 1 from jobs j where j.package_id = p.id);
  end if;

  update jobs set current_stage = p_to_stage,
         revision_count = case when p_to_stage = 'designing' and v_to_i < v_from_i then coalesce(revision_count,0) + 1 else revision_count end
   where id = p_job_id;

  insert into job_stage_history (job_id, from_stage, to_stage, notes, changed_by, changed_by_name, changed_by_role,
                                 is_rollback, reason, rollback_snapshot)
  values (p_job_id, v.current_stage, p_to_stage,
          'ROLLBACK: ' || btrim(p_reason), v_uid, v_name, v_role, true, btrim(p_reason),
          nullif(v_snap, '{}'::jsonb));

  begin
    insert into activity_logs (user_id, user_name, action, module, entity_type, entity_id, description, metadata)
    values (v_uid, v_name, 'rollback', 'Jobs', 'jobs', p_job_id::text,
            coalesce(v_name,'Admin') || ' rolled back ' || coalesce(v.job_number,'') || ' — ' || coalesce(v.project_name,'')
              || ' from ' || v.current_stage || ' to ' || p_to_stage || '. Reason: ' || btrim(p_reason),
            jsonb_build_object('job_number', v.job_number, 'from', v.current_stage, 'to', p_to_stage, 'reason', btrim(p_reason)));
  exception when others then null;
  end;

  return p_to_stage;
end;
$function$;
