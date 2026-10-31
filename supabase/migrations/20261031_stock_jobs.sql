-- Stock Jobs
-- Print extra copies on spare sheet space, keep them in the warehouse (no invoice, no dispatch)
-- and release them as a real order when the client asks.
--   * each printed batch is its own stock job (its own printer, QC and shelf quantity)
--   * a client order can take from several batches (oldest first)
--   * if the client wants more than the shelf holds, the balance becomes a linked new print job
--   * every change of shelf quantity is written to stock_movements (who, when, why)
-- APPLIED to the live database (aayam-fresh) on 2026-10-31.

alter table public.jobs
  add column if not exists is_stock boolean not null default false,
  add column if not exists stock_qty_on_hand integer,
  add column if not exists stock_location text,
  add column if not exists stock_artwork_version text,
  add column if not exists stock_stored_at timestamptz,
  add column if not exists stock_source_job_id uuid references public.jobs(id) on delete set null;

create index if not exists idx_jobs_is_stock on public.jobs(is_stock) where is_stock;
create index if not exists idx_jobs_stock_source on public.jobs(stock_source_job_id) where stock_source_job_id is not null;

-- New stage: in_stock (on the warehouse shelf, outside the order pipeline)
alter table public.jobs drop constraint if exists jobs_current_stage_valid;
alter table public.jobs add constraint jobs_current_stage_valid check (
  current_stage is null or current_stage = any (array[
    'new','awaiting_admin','designing','approval','pre_print_qc','print_file_ready','file_sent_client',
    'file_received','file_check','ready_to_print','printing','material_received','quality_check','finishing',
    'ready','dispatched','delivered','cancelled','in_stock'
  ]::text[])
);

-- Shelf history: every change of quantity, signed (+ in, - out).
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_job_id uuid not null references public.jobs(id) on delete cascade,
  order_job_id uuid references public.jobs(id) on delete set null,
  kind text not null check (kind in ('in','release','return','adjust')),
  qty integer not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_movements_stock on public.stock_movements(stock_job_id);
create index if not exists idx_stock_movements_order on public.stock_movements(order_job_id) where order_job_id is not null;
alter table public.stock_movements enable row level security;
drop policy if exists stock_movements_read on public.stock_movements;
create policy stock_movements_read on public.stock_movements for select to authenticated using (true);

-- 1. Put a printed stock job on the shelf.
create or replace function public.fn_put_in_stock(p_job_id uuid, p_qty integer, p_location text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter the quantity received (more than 0)'; end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if not v_job.is_stock then raise exception 'This is a client order, not a stock job'; end if;
  if v_job.current_stage not in ('material_received','quality_check','ready','finishing') then
    raise exception 'Job is at stage %, it cannot be put in stock yet', v_job.current_stage;
  end if;

  update public.jobs
     set current_stage = 'in_stock',
         stock_qty_on_hand = p_qty,
         stock_location = nullif(trim(p_location), ''),
         stock_artwork_version = coalesce(file_version, 'v1'),
         stock_stored_at = now(),
         package_id = null,
         is_active = true
   where id = p_job_id;

  insert into public.stock_movements (stock_job_id, kind, qty, created_by)
  values (p_job_id, 'in', p_qty, auth.uid());

  insert into public.job_stage_history (job_id, from_stage, to_stage, notes, changed_by, is_rollback)
  values (p_job_id, v_job.current_stage, 'in_stock',
          'Put in warehouse stock: ' || p_qty || ' pcs' || coalesce(' at ' || nullif(trim(p_location), ''), ''),
          auth.uid(), false);
end;
$$;

-- 2. Release for a client order.
--    p_batch_ids  : the stock batches (same client) the order may draw from, oldest is used first
--    p_total_qty  : what the client wants in total
--    If the shelf holds less, the rest becomes a new print job linked by client PO no. and notes.
create or replace function public.fn_release_stock(
  p_batch_ids uuid[],
  p_total_qty integer,
  p_rate numeric default 0,
  p_new_rate numeric default null,
  p_deadline timestamptz default null,
  p_client_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.jobs%rowtype;
  v_first public.jobs%rowtype;
  v_avail integer := 0;
  v_from_stock integer;
  v_short integer;
  v_remaining integer;
  v_take integer;
  v_order_id uuid;
  v_print_id uuid;
  v_order_no text;
  v_print_no text;
  v_gst_rate numeric;
  v_sub numeric;
  v_gst numeric;
  v_new_rate numeric := coalesce(p_new_rate, p_rate, 0);
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_total_qty is null or p_total_qty <= 0 then raise exception 'Enter the quantity the client wants (more than 0)'; end if;
  if p_batch_ids is null or array_length(p_batch_ids, 1) is null then raise exception 'No stock selected'; end if;

  -- lock every batch, oldest first, and check them
  for v_b in
    select * from public.jobs where id = any(p_batch_ids) order by stock_stored_at asc, created_at asc for update
  loop
    if not v_b.is_stock or v_b.current_stage <> 'in_stock' then
      raise exception 'Job % is not in warehouse stock', v_b.job_number;
    end if;
    if v_first.id is null then
      v_first := v_b;
    elsif v_b.client_id is distinct from v_first.client_id then
      raise exception 'All stock batches must belong to the same client';
    end if;
    v_avail := v_avail + coalesce(v_b.stock_qty_on_hand, 0);
  end loop;

  if v_first.id is null then raise exception 'Stock not found'; end if;
  if v_avail <= 0 then raise exception 'Nothing is left in stock'; end if;

  v_from_stock := least(p_total_qty, v_avail);
  v_short := p_total_qty - v_from_stock;
  v_gst_rate := coalesce(v_first.gst_rate, 18);

  -- the real order for the pieces coming from the shelf
  v_order_no := public.get_next_number(counter_id => 'job', type_prefix => 'PO');
  v_sub := round(v_from_stock * coalesce(p_rate, 0), 2);
  v_gst := round(v_sub * v_gst_rate / 100, 2);

  insert into public.jobs (
    job_number, project_name, client_id, job_type, product_category, product_category_id, product_id,
    brand_id, brand_name, label_product_id, description, thumbnail_url, files, file_version,
    quantity, quote_per_piece, subtotal, gst_rate, gst_amount, discount_amount, total_amount,
    payment_status, amount_received, advance_required, order_date, client_deadline, client_ref_no,
    current_stage, priority, status, qc_status, sales_person_id, stock_source_job_id, created_by, notes
  ) values (
    v_order_no, v_first.project_name, v_first.client_id, 'Print Only', v_first.product_category, v_first.product_category_id, v_first.product_id,
    v_first.brand_id, v_first.brand_name, v_first.label_product_id, v_first.description, v_first.thumbnail_url, v_first.files, v_first.file_version,
    v_from_stock, coalesce(p_rate, 0), v_sub, v_gst_rate, v_gst, 0, v_sub + v_gst,
    'pending', 0, false, now(), p_deadline, p_client_ref,
    'ready', 'normal', 'active', v_first.qc_status, v_first.sales_person_id, v_first.id, auth.uid(),
    'Released from stock (' || v_from_stock || ' of ' || p_total_qty || ' pcs ordered)'
  ) returning id into v_order_id;

  -- take the pieces off the shelf, oldest batch first
  v_remaining := v_from_stock;
  for v_b in
    select * from public.jobs where id = any(p_batch_ids) and coalesce(stock_qty_on_hand, 0) > 0
    order by stock_stored_at asc, created_at asc
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_b.stock_qty_on_hand);
    update public.jobs
       set stock_qty_on_hand = stock_qty_on_hand - v_take,
           is_active = case when stock_qty_on_hand - v_take = 0 then false else is_active end
     where id = v_b.id;
    insert into public.stock_movements (stock_job_id, order_job_id, kind, qty, created_by)
    values (v_b.id, v_order_id, 'release', -v_take, auth.uid());
    v_remaining := v_remaining - v_take;
  end loop;

  insert into public.job_stage_history (job_id, from_stage, to_stage, notes, changed_by, is_rollback)
  values (v_order_id, 'in_stock', 'ready', 'Released ' || v_from_stock || ' pcs from stock', auth.uid(), false);

  -- the client wants more than the shelf holds: new print job for the balance
  if v_short > 0 then
    v_print_no := public.get_next_number(counter_id => 'job', type_prefix => 'PO');
    v_sub := round(v_short * v_new_rate, 2);
    v_gst := round(v_sub * v_gst_rate / 100, 2);

    insert into public.jobs (
      job_number, project_name, client_id, job_type, product_category, product_category_id, product_id,
      brand_id, brand_name, label_product_id, description, thumbnail_url, files, print_files, file_version,
      quantity, quote_per_piece, subtotal, gst_rate, gst_amount, discount_amount, total_amount,
      payment_status, amount_received, order_date, client_deadline, client_ref_no,
      current_stage, priority, status, sales_person_id, created_by, notes
    ) values (
      v_print_no, v_first.project_name, v_first.client_id, 'Print Only', v_first.product_category, v_first.product_category_id, v_first.product_id,
      v_first.brand_id, v_first.brand_name, v_first.label_product_id, v_first.description, v_first.thumbnail_url, v_first.files, v_first.print_files, v_first.file_version,
      v_short, v_new_rate, v_sub, v_gst_rate, v_gst, 0, v_sub + v_gst,
      'pending', 0, now(), p_deadline, p_client_ref,
      'ready_to_print', 'normal', 'active', v_first.sales_person_id, auth.uid(),
      'Balance to print for the same client order as ' || v_order_no || ': ' || v_from_stock || ' pcs come from stock, ' || v_short || ' pcs printed new (' || p_total_qty || ' ordered)'
    ) returning id into v_print_id;

    update public.jobs
       set notes = notes || '. Balance ' || v_short || ' pcs is being printed as ' || v_print_no
     where id = v_order_id;
  end if;

  return jsonb_build_object(
    'order_job_id', v_order_id,
    'order_job_number', v_order_no,
    'from_stock', v_from_stock,
    'print_job_id', v_print_id,
    'print_job_number', v_print_no,
    'to_print', v_short
  );
end;
$$;

-- 3. Released by mistake: put the pieces back on the shelf (only before packing / invoice / dispatch).
create or replace function public.fn_return_to_stock(p_order_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o public.jobs%rowtype;
  v_m record;
  v_back integer := 0;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into v_o from public.jobs where id = p_order_job_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_o.stock_source_job_id is null then raise exception 'This order was not released from stock'; end if;
  if v_o.current_stage <> 'ready' or v_o.package_id is not null then
    raise exception 'This order is already packed or dispatched, it cannot be returned to stock';
  end if;
  if exists (select 1 from public.dispatches where job_id = p_order_job_id) then
    raise exception 'Part of this order is already dispatched';
  end if;
  if exists (select 1 from public.invoices where job_id = p_order_job_id) then
    raise exception 'An invoice already exists for this order';
  end if;

  for v_m in
    select stock_job_id, sum(-qty)::integer as qty
      from public.stock_movements
     where order_job_id = p_order_job_id and kind = 'release'
     group by stock_job_id
  loop
    update public.jobs
       set stock_qty_on_hand = coalesce(stock_qty_on_hand, 0) + v_m.qty, is_active = true
     where id = v_m.stock_job_id;
    insert into public.stock_movements (stock_job_id, order_job_id, kind, qty, reason, created_by)
    values (v_m.stock_job_id, p_order_job_id, 'return', v_m.qty, 'Order ' || v_o.job_number || ' returned to stock', auth.uid());
    v_back := v_back + v_m.qty;
  end loop;

  update public.jobs
     set current_stage = 'cancelled', notes = coalesce(notes || '. ', '') || 'Returned to stock'
   where id = p_order_job_id;

  insert into public.job_stage_history (job_id, from_stage, to_stage, notes, changed_by, is_rollback)
  values (p_order_job_id, 'ready', 'cancelled', 'Returned ' || v_back || ' pcs to stock', auth.uid(), false);

  return v_back;
end;
$$;

-- 4. Damaged / miscounted / old artwork: change the shelf quantity, with a reason.
create or replace function public.fn_adjust_stock(p_job_id uuid, p_delta integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_new integer;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Enter how many pieces to add or remove'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Please write the reason'; end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or not v_job.is_stock or v_job.current_stage <> 'in_stock' then
    raise exception 'This job is not in warehouse stock';
  end if;

  v_new := coalesce(v_job.stock_qty_on_hand, 0) + p_delta;
  if v_new < 0 then raise exception 'Only % pcs are in stock', coalesce(v_job.stock_qty_on_hand, 0); end if;

  update public.jobs
     set stock_qty_on_hand = v_new, is_active = (v_new > 0)
   where id = p_job_id;

  insert into public.stock_movements (stock_job_id, kind, qty, reason, created_by)
  values (p_job_id, 'adjust', p_delta, trim(p_reason), auth.uid());

  insert into public.job_stage_history (job_id, from_stage, to_stage, notes, changed_by, is_rollback)
  values (p_job_id, 'in_stock', 'in_stock', 'Stock adjusted by ' || p_delta || ' pcs: ' || trim(p_reason), auth.uid(), false);

  return v_new;
end;
$$;

grant execute on function public.fn_put_in_stock(uuid, integer, text) to authenticated;
grant execute on function public.fn_release_stock(uuid[], integer, numeric, numeric, timestamptz, text) to authenticated;
grant execute on function public.fn_return_to_stock(uuid) to authenticated;
grant execute on function public.fn_adjust_stock(uuid, integer, text) to authenticated;
