import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
    .select('id, sale_number, total_amount, customer_name, sheets_used, papers')
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
