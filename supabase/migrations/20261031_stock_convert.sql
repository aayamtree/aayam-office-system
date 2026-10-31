-- Convert a running job (printed, not yet dispatched) into a stock job.
-- Only while nothing has gone out: no box, no dispatch, no invoice, no money received.
-- Prices are zeroed (it is not an order); the old quantity and total are kept in the job history note.

create or replace function public.fn_convert_to_stock(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.jobs%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into v from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v.is_stock then raise exception 'This is already a stock job'; end if;
  if v.stock_source_job_id is not null then
    raise exception 'This order was released from stock. Use "Return to stock" instead';
  end if;
  if v.current_stage not in ('material_received','quality_check','ready','finishing') then
    raise exception 'Only printed jobs that have not been dispatched can become stock (this one is at stage %)', v.current_stage;
  end if;
  if v.package_id is not null then raise exception 'This job is already packed in a box'; end if;
  if exists (select 1 from public.dispatches where job_id = p_job_id) then
    raise exception 'Part of this job is already dispatched';
  end if;
  if exists (select 1 from public.invoices where job_id = p_job_id)
     or nullif(trim(coalesce(v.invoice_reference, '')), '') is not null then
    raise exception 'An invoice is already attached to this job';
  end if;
  if coalesce(v.amount_received, 0) > 0
     or exists (select 1 from public.payments_received where job_id = p_job_id) then
    raise exception 'Money is already received on this job, it cannot become stock';
  end if;

  update public.jobs
     set is_stock = true,
         quote_per_piece = 0, design_charge = 0, subtotal = 0, gst_amount = 0,
         discount_amount = 0, total_amount = 0,
         payment_status = 'pending', amount_received = 0,
         advance_required = false, advance_collected = false, advance_amount = 0,
         invoice_requested_at = null, client_deadline = null
   where id = p_job_id;

  insert into public.job_stage_history (job_id, from_stage, to_stage, notes, changed_by, is_rollback)
  values (p_job_id, v.current_stage, v.current_stage,
          'Converted to stock job (was a client order: ' || coalesce(v.quantity, 0) || ' pcs, total ' || coalesce(v.total_amount, 0) || ')',
          auth.uid(), false);
end;
$$;

grant execute on function public.fn_convert_to_stock(uuid) to authenticated;
