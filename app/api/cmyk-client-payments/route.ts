import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Authenticate the caller via the SSR cookie session, then return a
// service-role client for the actual write. The service role bypasses RLS so
// the save still succeeds when the browser's Supabase JWT has lapsed.
async function authAndAdmin() {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { user: null as any, admin: null as any };

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return { user, admin };
}

// Record a payment collected from a CMYK client.
export async function POST(request: NextRequest) {
  const { user, admin } = await authAndAdmin();
  if (!user) {
    return NextResponse.json(
      { error: 'Your session has expired. Please sign in again and retry.' },
      { status: 401 }
    );
  }

  let body: any = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!body.cmyk_client_id) {
    return NextResponse.json({ error: 'Client is required' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount greater than 0' }, { status: 400 });
  }
  // The account the money landed in. Exactly one of cash/bank id may be set.
  // Legacy `method` (cash/upi) is derived so old displays & statements keep working:
  // a cash account -> 'cash', a bank/UPI account -> 'upi'.
  const cashAccountId = body.cash_account_id || null;
  const bankAccountId = body.bank_account_id || null;
  const method = cashAccountId ? 'cash' : bankAccountId ? 'upi' : (body.method === 'upi' ? 'upi' : 'cash');

  const payload: Record<string, any> = {
    cmyk_client_id: body.cmyk_client_id,
    amount,
    method,
    cash_account_id: cashAccountId,
    bank_account_id: bankAccountId,
    created_by: user.id,
  };
  if (body.paid_on) payload.paid_on = body.paid_on;
  if (body.notes) payload.notes = body.notes;

  const { data, error } = await admin
    .from('cmyk_client_payments')
    .insert([payload])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// Remove a recorded payment (undo a mistaken entry).
export async function DELETE(request: NextRequest) {
  const { user, admin } = await authAndAdmin();
  if (!user) {
    return NextResponse.json(
      { error: 'Your session has expired. Please sign in again and retry.' },
      { status: 401 }
    );
  }

  let body: any = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: 'Payment id is required' }, { status: 400 });

  const { error } = await admin
    .from('cmyk_client_payments')
    .delete()
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
