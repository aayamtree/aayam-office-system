-- Common stock: stock printed for many clients (no client name on it).
--   * a stock batch may have no client (jobs.client_id is already nullable)
--   * Release on such a batch asks which client is taking it; the order is made for that client
-- Opening-stock rows may also have no client (client_id null or empty).
drop function if exists public.fn_release_stock(uuid[], integer, numeric, numeric, timestamptz, text);

create or replace function public.fn_release_stock(
  p_batch_ids uuid[],
  p_total_qty integer,
  p_rate numeric default 0,
  p_new_rate numeric default null,
  p_deadline timestamptz default null,
  p_client_ref text default null,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.jobs%rowtype;
  v_first public.jobs%rowtype;
  v_client uuid;
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
  -- common stock (no client): the caller says which client is taking it
  v_client := coalesce(v_first.client_id, p_client_id);
  if v_client is null then raise exception 'Choose the client who is taking this stock'; end if;
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
    v_order_no, v_first.project_name, v_client, 'Print Only', v_first.product_category, v_first.product_category_id, v_first.product_id,
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
      v_print_no, v_first.project_name, v_client, 'Print Only', v_first.product_category, v_first.product_category_id, v_first.product_id,
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


create or replace function public.fn_add_opening_stock(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_files jsonb;
  v_thumb text;
  v_no text;
  v_id uuid;
  v_qty integer;
  v_when timestamptz;
  v_name text;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to add';
  end if;

  perform set_config('app.skip_stage_notify', '1', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_qty := nullif(r->>'qty', '')::integer;
    v_name := nullif(trim(r->>'project_name'), '');
    if v_name is null then raise exception 'Every row needs a product name'; end if;
    if v_qty is null or v_qty <= 0 then raise exception 'Row "%": quantity must be more than 0', v_name; end if;
    v_when := coalesce(nullif(r->>'stored_at', '')::date::timestamptz, now());
    if v_when > now() then raise exception 'Row "%": printed date is in the future', v_name; end if;

    v_files := case when jsonb_typeof(r->'files') = 'array' then r->'files' else '[]'::jsonb end;
    select f->>'url' into v_thumb from jsonb_array_elements(v_files) f
     where coalesce(f->>'type', '') like 'image/%' limit 1;

    v_no := public.get_next_number(counter_id => 'job', type_prefix => 'PO');

    insert into public.jobs (
      job_number, project_name, client_id, vendor_id, job_type, thumbnail_url, files,
      quantity, quote_per_piece, subtotal, gst_rate, gst_amount, discount_amount, total_amount,
      payment_status, amount_received, advance_required, order_date,
      current_stage, priority, status, created_by, notes,
      is_stock, stock_qty_on_hand, stock_artwork_version, stock_stored_at, is_active
    ) values (
      v_no, v_name, nullif(r->>'client_id', '')::uuid, nullif(r->>'vendor_id', '')::uuid, 'Print Only', v_thumb, v_files,
      v_qty, 0, 0, 18, 0, 0, 0,
      'pending', 0, false, v_when,
      'in_stock', 'normal', 'active', auth.uid(), 'Opening stock (already on the shelf when stock tracking started)',
      true, v_qty,
      coalesce(nullif(trim(r->>'artwork_version'), ''), 'v1'), v_when, true
    ) returning id into v_id;

    insert into public.stock_movements (stock_job_id, kind, qty, reason, created_by)
    values (v_id, 'in', v_qty, 'Opening stock', auth.uid());

    insert into public.job_stage_history (job_id, from_stage, to_stage, notes, changed_by, is_rollback)
    values (v_id, 'in_stock', 'in_stock',
            'Opening stock added: ' || v_qty || ' pcs',
            auth.uid(), false);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.fn_release_stock(uuid[], integer, numeric, numeric, timestamptz, text, uuid) to authenticated;
grant execute on function public.fn_add_opening_stock(jsonb) to authenticated;
