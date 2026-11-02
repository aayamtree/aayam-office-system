-- Opening stock: bring stock that is ALREADY on the shelf into the system (one-time, in bulk).
-- Each row becomes one stock batch (a stock job already at stage in_stock) with no price,
-- no invoice and no dispatch. Release, Adjust and History then work as for any other stock.
--   p_rows: jsonb array of
--     { client_id, project_name, qty, location?, stored_at? (date), vendor_id? (printer),
--       artwork_version?, template_job_id? (copy product, brand, files from an earlier job) }
-- Returns how many batches were added.
create or replace function public.fn_add_opening_stock(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  t public.jobs%rowtype;
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
    if (r->>'client_id') is null or (r->>'client_id') = '' then raise exception 'Every row needs a client'; end if;
    if v_name is null then raise exception 'Every row needs a product name'; end if;
    if v_qty is null or v_qty <= 0 then raise exception 'Row "%": quantity must be more than 0', v_name; end if;
    v_when := coalesce(nullif(r->>'stored_at', '')::date::timestamptz, now());
    if v_when > now() then raise exception 'Row "%": printed date is in the future', v_name; end if;

    t := null;
    if nullif(r->>'template_job_id', '') is not null then
      select * into t from public.jobs where id = (r->>'template_job_id')::uuid;
    end if;

    v_no := public.get_next_number(counter_id => 'job', type_prefix => 'PO');

    insert into public.jobs (
      job_number, project_name, client_id, vendor_id, job_type, product_category, product_category_id, product_id,
      brand_id, brand_name, label_product_id, description, thumbnail_url, files, file_version,
      quantity, quote_per_piece, subtotal, gst_rate, gst_amount, discount_amount, total_amount,
      payment_status, amount_received, advance_required, order_date,
      current_stage, priority, status, sales_person_id, created_by, notes,
      is_stock, stock_qty_on_hand, stock_location, stock_artwork_version, stock_stored_at, is_active
    ) values (
      v_no, v_name, (r->>'client_id')::uuid, nullif(r->>'vendor_id', '')::uuid, 'Print Only',
      t.product_category, t.product_category_id, t.product_id,
      t.brand_id, t.brand_name, t.label_product_id, t.description, t.thumbnail_url, t.files, t.file_version,
      v_qty, 0, 0, coalesce(t.gst_rate, 18), 0, 0, 0,
      'pending', 0, false, v_when,
      'in_stock', 'normal', 'active', t.sales_person_id, auth.uid(), 'Opening stock (already on the shelf when stock tracking started)',
      true, v_qty, nullif(trim(r->>'location'), ''),
      coalesce(nullif(trim(r->>'artwork_version'), ''), t.file_version, 'v1'), v_when, true
    ) returning id into v_id;

    insert into public.stock_movements (stock_job_id, kind, qty, reason, created_by)
    values (v_id, 'in', v_qty, 'Opening stock', auth.uid());

    insert into public.job_stage_history (job_id, from_stage, to_stage, notes, changed_by, is_rollback)
    values (v_id, null, 'in_stock',
            'Opening stock added: ' || v_qty || ' pcs' || coalesce(' at ' || nullif(trim(r->>'location'), ''), ''),
            auth.uid(), false);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.fn_add_opening_stock(jsonb) to authenticated;
