import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Fields accepted from the client form. Anything else is ignored so an
// unexpected field can never break the insert/update.
const ALLOWED_FIELDS = [
  'client_id', 'lead_id', 'order_type', 'product_category', 'created_by',
  'valid_until', 'subtotal', 'gst_amount', 'discount_amount', 'total_amount',
  'status', 'notes', 'terms', 'converted_to_job_id',
] as const;

function pickFields(body: any) {
  const payload: Record<string, any> = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
}

// Authenticate the caller via the SSR cookie session, then return a
// service-role client for the actual write. The service role bypasses RLS so
// the save still succeeds when the browser's Supabase JWT has lapsed (the old
// direct browser write failed with an "anon" RLS violation in that case).
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

// Create a quotation. Generates the quote number server-side.
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

  const payload = pickFields(body);
  if (!payload.created_by) payload.created_by = user.id;

  // Generate the next quote number (QT-YY-NNN). Fall back to a timestamp id if
  // the RPC is unavailable so a save never fails on numbering alone.
  let quoteNumber: string | null = null;
  try {
    const { data: numberData } = await admin.rpc('get_next_number', { counter_id: 'quotation' });
    quoteNumber = numberData ?? null;
  } catch { /* fall through to fallback */ }
  payload.quote_number = quoteNumber || `QT-${Date.now()}`;

  const { data, error } = await admin
    .from('quotations')
    .insert([payload])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// Update an existing quotation.
export async function PATCH(request: NextRequest) {
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

  const id = body.id;
  if (!id) return NextResponse.json({ error: 'Quotation id is required' }, { status: 400 });

  const updates = pickFields(body.updates ?? body);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('quotations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
