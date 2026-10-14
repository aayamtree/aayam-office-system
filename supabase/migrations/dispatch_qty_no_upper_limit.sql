-- Dispatch quantity has no upper limit: printers send a little more or less
-- than ordered, so the ordered quantity is only a guide. Kept: at least 1, and
-- a whole-job (NULL) dispatch is refused once a part-shipment already exists.
create or replace function public.check_dispatch_qty()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_qty        integer;
  v_job_number text;
  v_shipped    bigint;
begin
  if new.job_id is null then
    return new;
  end if;

  select quantity, job_number
    into v_qty, v_job_number
    from jobs
   where id = new.job_id
     for update;

  if coalesce(v_qty, 0) <= 0 then
    return new;
  end if;

  select coalesce(sum(dispatched_qty), 0)
    into v_shipped
    from dispatches
   where job_id = new.job_id
     and dispatched_qty is not null;

  if new.dispatched_qty is null then
    if v_shipped > 0 then
      raise exception
        '% already has % of % pcs dispatched - enter the quantity for this dispatch instead of dispatching the whole job.',
        coalesce(v_job_number, new.job_id::text), v_shipped, v_qty
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.dispatched_qty < 1 then
    raise exception 'Dispatch quantity must be at least 1.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;
