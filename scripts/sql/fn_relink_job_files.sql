-- Used only by the Google Drive -> Raspberry Pi file move.
-- Updates a job's file links and removes the activity-log rows that the generic
-- auto-log trigger creates in the SAME transaction, so the background move does not fill
-- the activity feed with fake "updated job" lines. Nothing existing is changed.
create or replace function public.fn_relink_job_files(
  p_job uuid, p_files jsonb, p_print jsonb, p_drive_link text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
     set files = p_files,
         print_files = p_print,
         drive_link = coalesce(p_drive_link, drive_link)
   where id = p_job;

  delete from public.activity_logs
   where xmin::text = (txid_current() % 4294967296)::text
     and (entity_id = p_job or resource_id = p_job::text);
end;
$$;

revoke all on function public.fn_relink_job_files(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_relink_job_files(uuid, jsonb, jsonb, text) to service_role;
