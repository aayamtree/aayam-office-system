-- A print run now follows its jobs. Until now the sync only went run -> jobs, so when Dispatch
-- QC'd / dispatched the jobs first, the run kept saying "In QC" for days (e.g. PP-00069).
-- Rule: a run's status follows its SLOWEST job (cancelled jobs ignored), forward only.
--   every job Ready or beyond  -> run becomes 'handed_over' (closed)
--   every job in QC or beyond  -> run becomes 'qc' (if it was behind that)

create or replace function public.fn_print_run_status_rank(p_status text)
returns int language sql immutable set search_path to 'public','pg_temp' as $f$
  select case p_status when 'planned' then 0 when 'at_printer' then 1 when 'printing_done' then 2
    when 'after_print' then 3 when 'qc' then 4 when 'handed_over' then 5 when 'dispatched' then 6 else -1 end
$f$;

create or replace function public.fn_print_run_status_from_jobs(p_run_id uuid)
returns text language plpgsql stable security definer set search_path to 'public','pg_temp' as $f$
declare v_status text; v_min int;
begin
  select status into v_status from print_runs where id = p_run_id;
  if v_status is null or v_status in ('handed_over','dispatched') then return null; end if;
  select min(fn_print_run_stage_rank(j.current_stage)) into v_min
    from print_run_jobs prj join jobs j on j.id = prj.job_id
   where prj.print_run_id = p_run_id and j.current_stage <> 'cancelled';
  if v_min is null then return null; end if;
  if v_min >= 12 then return 'handed_over'; end if;
  if v_min >= 11 and fn_print_run_status_rank(v_status) < 4 then return 'qc'; end if;
  return null;
end
$f$;

create or replace function public.fn_sync_jobs_to_print_run()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare r record; v_target text;
begin
  for r in select distinct prj.print_run_id from print_run_jobs prj where prj.job_id = new.id loop
    v_target := fn_print_run_status_from_jobs(r.print_run_id);
    if v_target is not null then
      update print_runs set status = v_target where id = r.print_run_id and status <> v_target;
      update print_run_status_history set reason = 'Automatic: its jobs moved on in Dispatch'
       where id = (select id from print_run_status_history
                    where print_run_id = r.print_run_id and to_status = v_target
                    order by created_at desc limit 1)
         and reason is null;
    end if;
  end loop;
  return new;
end
$f$;

drop trigger if exists trg_sync_jobs_to_print_run on public.jobs;
create trigger trg_sync_jobs_to_print_run
  after update of current_stage on public.jobs
  for each row when (old.current_stage is distinct from new.current_stage)
  execute function public.fn_sync_jobs_to_print_run();

-- One-time catch-up for runs already behind their jobs (today: PP-00062 only).
do $c$
declare r record; v_target text;
begin
  for r in select id from print_runs where status not in ('handed_over','dispatched') loop
    v_target := fn_print_run_status_from_jobs(r.id);
    if v_target is not null then
      update print_runs set status = v_target where id = r.id;
      update print_run_status_history set reason = 'Automatic catch-up: its jobs were already further along'
       where id = (select id from print_run_status_history where print_run_id = r.id and to_status = v_target order by created_at desc limit 1)
         and reason is null;
    end if;
  end loop;
end
$c$;
