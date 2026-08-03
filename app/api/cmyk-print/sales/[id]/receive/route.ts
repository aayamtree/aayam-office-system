import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Recording money against a bill is an admin / CMYK-team job. Enforced HERE, server-side.
const CAN_RECEIVE_ROLES = ['admin', 'cmyk'];

/**
 * POST /api/cmyk-print/sales/[id]/receive
 *
 * Records money collected against an existing POS bill and tags which CMYK account
 * (Cash / Rohan / Eklavya) it landed in, so it shows up on /admin/cmyk-print/accounts.
 *
 * Why a server route: browser writes run as `anon` the moment a Supabase session lapses
 * and fail silently — money would look recorded but never reach the table. Service-role
 * here keeps the write honest.
 *
 * Body: { cmyk_account_id: string, amount?: number }
 *  - amount omitted → collect the full outstanding balance.
 *  - amount is CUMULATIVE-safe: it is ADDED to whatever was already received.
 */
export async function POST(
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

  const accountId = (body?.cmyk_account_id || '').trim();
  if (!accountId) {
    return NextResponse.json({ error: 'Choose which account received the money.' }, { status: 400 });
  }

  // ── Who is asking ────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: caller } = await auth.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (!CAN_RECEIVE_ROLES.includes(caller?.role || '')) {
    return NextResponse.json({ error: 'You do not have permission to record payments.' }, { status: 403 });
  }

  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;

  // ── The bill ─────────────────────────────────────────────────────────────────
  const { data: sale } = await service
    .from('pos_sales')
    .select('id, sale_number, customer_name, total_amount, amount_received, cmyk_account_id')
    .eq('id', id)
    .single();
  if (!sale) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });

  const total = Number(sale.total_amount) || 0;
  const already = Number(sale.amount_received) || 0;
  const outstanding = Math.max(0, total - already);
  if (outstanding <= 0) {
    return NextResponse.json({ error: 'This bill is already fully paid.' }, { status: 400 });
  }

  // Blank amount = settle the whole balance, which is the common counter case.
  const requested = body?.amount === undefined || body?.amount === null || body?.amount === ''
    ? outstanding
    : Number(body.amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
  }
  if (requested > outstanding) {
    return NextResponse.json(
      { error: `Amount is more than the ₹${outstanding} still due on this bill.` },
      { status: 400 }
    );
  }

  // ── The account ──────────────────────────────────────────────────────────────
  const { data: account } = await service
    .from('cmyk_accounts')
    .select('id, name, type')
    .eq('id', accountId)
    .single();
  if (!account) return NextResponse.json({ error: 'That CMYK account no longer exists.' }, { status: 400 });

  const received = already + requested;
  const balanceDue = Math.max(0, total - received);

  const { error: updErr } = await service
    .from('pos_sales')
    .update({
      amount_received: received,
      balance_due: balanceDue,
      payment_status: balanceDue <= 0 ? 'paid' : 'partial',
      cmyk_account_id: account.id,
      // Keep the legacy mode in step with the account that actually took the money.
      payment_mode: account.type === 'cash' ? 'cash' : 'upi',
    })
    .eq('id', id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await service.from('activity_logs').insert([{
    user_id: user.id,
    user_name: caller?.full_name || user.email,
    action: 'UPDATE',
    module: 'Sales',
    entity_type: 'pos_sale',
    entity_id: sale.id,
    entity_name: sale.sale_number,
    description:
      `Recorded ₹${requested} received into ${account.name} against bill ${sale.sale_number} ` +
      `(${sale.customer_name || 'Walk-in'}). Now ₹${received} of ₹${total}` +
      (balanceDue > 0 ? `, ₹${balanceDue} still due.` : ' — fully paid.'),
    metadata: {
      role: caller?.role,
      user_email: user.email,
      amount: requested,
      account_id: account.id,
      account_name: account.name,
      amount_received_before: already,
      amount_received_after: received,
      balance_due: balanceDue,
    },
  }]);

  return NextResponse.json({
    success: true,
    sale_number: sale.sale_number,
    amount_received: received,
    balance_due: balanceDue,
    account_name: account.name,
  });
}
