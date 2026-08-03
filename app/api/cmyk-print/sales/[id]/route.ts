import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Who may touch an existing bill. Designers, marketing and dispatch never can —
// enforced HERE, server-side; hiding the button in the UI is not a lock.
const CAN_EDIT_ROLES = ['admin', 'cmyk'];

/** Resolve the signed-in user and their role from the session cookie. */
async function getCaller() {
  const cookieStore = await cookies();
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { auth, user: null, caller: null };

  const { data: caller } = await auth
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  return { auth, user, caller };
}

/** Service-role client — writes stay reliable even if the browser session lapses. */
function serviceClient(fallback: any) {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fallback;
}

/**
 * PUT /api/cmyk-print/sales/[id]
 *
 * Edits an existing POS bill. Admin + CMYK team only, enforced server-side.
 *  - The bill NUMBER and its original date are never changed — the same bill is corrected,
 *    not replaced, so nothing goes missing from the day's sales.
 *  - Line items are replaced wholesale (delete + insert) so removed lines really disappear.
 *  - Paper stock self-corrects: trigger_adjust_paper_stock returns the old sheets and
 *    deducts the new ones on UPDATE, so stock always matches the current bill.
 *  - A reason is REQUIRED and the before/after totals are written to activity_logs.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const reason = (body?.reason || '').trim();
  if (reason.length < 3) {
    return NextResponse.json({ error: 'A reason is required to edit a bill (at least 3 characters).' }, { status: 400 });
  }

  const { auth, user, caller } = await getCaller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!CAN_EDIT_ROLES.includes(caller?.role || '')) {
    return NextResponse.json(
      { error: `Only admin and CMYK team members can edit a bill. Your role: ${caller?.role || 'unknown'}` },
      { status: 403 }
    );
  }

  const service = serviceClient(auth);

  const { data: before } = await service
    .from('pos_sales')
    .select('id, sale_number, total_amount, customer_name, sheets_used, papers, created_at')
    .eq('id', id)
    .single();
  if (!before) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

  // Whitelist of editable columns. sale_number and id are deliberately absent — a corrected
  // bill keeps its identity. created_at IS editable (bills entered a day or two late need
  // their real date), but it is validated below and the move is recorded in the audit log.
  const ALLOWED = [
    'created_at',
    'customer_name', 'customer_phone', 'cmyk_client_id',
    'subtotal', 'discount_percent', 'discount_amount', 'total_amount',
    'gst_rate', 'gst_amount', 'cgst_amount', 'sgst_amount',
    'order_type', 'pickup_status', 'artwork_link',
    'payment_mode', 'cmyk_account_id', 'amount_received', 'change_amount',
    'payment_status', 'balance_due',
    'paper_stock_id', 'sheets_used', 'papers',
    'notes',
  ] as const;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED) {
    if (key in (body.sale || {})) updates[key] = body.sale[key] ?? null;
  }

  // A bad date would quietly park the bill in 1970 or the next century, where nobody
  // would find it again. Reject anything unparseable, in the future, or absurdly old.
  if ('created_at' in updates) {
    if (updates.created_at === null) {
      delete updates.created_at; // never blank the date — leave it as it was
    } else {
      const when = new Date(updates.created_at);
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      if (isNaN(when.getTime())) {
        return NextResponse.json({ error: 'That bill date could not be read.' }, { status: 400 });
      }
      if (when.getTime() > tomorrow) {
        return NextResponse.json({ error: 'A bill cannot be dated in the future.' }, { status: 400 });
      }
      if (when.getFullYear() < 2020) {
        return NextResponse.json({ error: 'That bill date is too far in the past.' }, { status: 400 });
      }
      updates.created_at = when.toISOString();
    }
  }

  const dateMoved =
    !!updates.created_at &&
    new Date(updates.created_at).getTime() !== new Date(before.created_at).getTime();

  // The paper columns drive the stock trigger, so they must always be written together —
  // a partial update would leave stock adjusted against a half-changed bill.
  const { error: updateError } = await service
    .from('pos_sales')
    .update(updates)
    .eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Replace line items wholesale so deleted lines actually go away.
  if (Array.isArray(body.items)) {
    const { error: delError } = await service.from('pos_sale_items').delete().eq('sale_id', id);
    if (delError) return NextResponse.json({ error: `Bill saved but items failed: ${delError.message}` }, { status: 500 });

    if (body.items.length > 0) {
      const rows = body.items.map((it: any) => ({
        sale_id: id,
        product_id: it.product_id ?? null,
        product_name: it.product_name || 'Item',
        quantity: it.quantity ?? 1,
        price: it.price ?? 0,
        total: it.total ?? 0,
        details: it.details ?? null,
        print_sides: it.print_sides ?? null,
        paper_stock_id: it.paper_stock_id ?? null,
        paper_name: it.paper_name ?? null,
        sheets: it.sheets ?? null,
      }));
      const { error: insError } = await service.from('pos_sale_items').insert(rows);
      if (insError) return NextResponse.json({ error: `Bill saved but items failed: ${insError.message}` }, { status: 500 });
    }
  }

  const newTotal = updates.total_amount ?? before.total_amount;
  await service.from('activity_logs').insert([{
    user_id: user.id,
    user_name: caller?.full_name || user.email,
    action: 'UPDATE',
    module: 'Sales',
    entity_type: 'pos_sale',
    entity_id: before.id,
    entity_name: before.sale_number,
    description:
      `Edited bill ${before.sale_number} (${before.customer_name || 'Walk-in'}): ₹${before.total_amount} → ₹${newTotal}.` +
      (dateMoved ? ` DATE MOVED ${before.created_at} → ${updates.created_at}.` : '') +
      ` Reason: ${reason}`,
    metadata: {
      reason,
      role: caller?.role,
      user_email: user.email,
      date_moved: dateMoved,
      before: {
        created_at: before.created_at,
        total_amount: before.total_amount,
        customer_name: before.customer_name,
        sheets_used: before.sheets_used,
        papers: before.papers,
      },
      after: {
        created_at: updates.created_at ?? before.created_at,
        total_amount: newTotal,
        customer_name: updates.customer_name ?? before.customer_name,
        sheets_used: updates.sheets_used ?? before.sheets_used,
        papers: updates.papers ?? before.papers,
      },
    },
  }]);

  console.log(`[POS edit] Bill ${before.sale_number} edited by ${caller?.full_name || user.email} (${caller?.role}): ₹${before.total_amount} → ₹${newTotal}${dateMoved ? `, date ${before.created_at} → ${updates.created_at}` : ''}. Reason: ${reason}`);

  return NextResponse.json({ success: true, sale_number: before.sale_number });
}

/**
 * DELETE /api/cmyk-print/sales/[id]
 *
 * Deletes a POS bill. ADMIN ONLY — enforced server-side (UI hiding is not a lock).
 *  - pos_sale_items are removed automatically (FK ON DELETE CASCADE).
 *  - paper stock is restored automatically (AFTER DELETE trigger, per-paper-type
 *    for multi-paper bills as of 2026-07-06).
 *  - a reason is REQUIRED and is written to activity_logs for audit.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();

  let reason = '';
  try {
    const body = await request.json();
    reason = (body?.reason || '').trim();
  } catch {
    // no body sent
  }
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required to cancel/delete a bill.' }, { status: 400 });
  }

  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await auth
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (caller?.role !== 'admin') {
    return NextResponse.json(
      { error: `Only admins can delete a bill. Your role: ${caller?.role || 'unknown'}` },
      { status: 403 }
    );
  }

  // Service-role client for the actual delete (reliable regardless of session state).
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;

  // Fetch for audit + to confirm it exists.
  const { data: sale } = await service
    .from('pos_sales')
    .select('id, sale_number, total_amount, customer_name, sheets_used, papers, created_at')
    .eq('id', id)
    .single();
  if (!sale) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

  // Log BEFORE deleting so the reason is captured even if the delete itself fails partway.
  await service.from('activity_logs').insert([{
    user_id: user.id,
    user_name: caller?.full_name || user.email,
    action: 'DELETE',
    module: 'Sales',
    entity_type: 'pos_sale',
    entity_id: sale.id,
    entity_name: sale.sale_number,
    description: `Cancelled bill ${sale.sale_number} (${sale.customer_name || 'Walk-in'}, ₹${sale.total_amount}). Reason: ${reason}`,
    metadata: {
      reason,
      role: caller?.role,
      user_email: user.email,
      bill_date: sale.created_at,
      total_amount: sale.total_amount,
      customer_name: sale.customer_name,
      sheets_used: sale.sheets_used,
      papers: sale.papers,
    },
  }]);

  const { error } = await service.from('pos_sales').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(`[POS delete] Bill ${sale.sale_number} (${sale.customer_name || 'Walk-in'}, ₹${sale.total_amount}) deleted by ${caller?.full_name || user.email} (admin). Reason: ${reason}`);

  return NextResponse.json({ success: true, deleted: sale.sale_number });
}
