import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Columns we accept from the client form. Anything else is ignored so an
// unexpected field can never break the insert.
const ALLOWED_FIELDS = [
    'name', 'company', 'email', 'phone', 'alt_phone', 'gstin', 'address',
    'city', 'state', 'pincode', 'client_type', 'credit_limit', 'notes',
    'is_active', 'brand_name', 'source', 'opening_balance',
    'opening_balance_date', 'opening_balance_type', 'source_lead_id',
] as const;

// Create a client. The insert runs with the service role on the server so it
// succeeds even if the browser's Supabase JWT has lapsed (the old direct
// browser insert failed with an "anon" RLS violation in that case). The caller
// is still authenticated via the SSR cookie session before we do anything.
export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    );

    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
        return NextResponse.json(
            { error: 'Your session has expired. Please sign in again and retry.' },
            { status: 401 }
        );
    }

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body?.name || !body?.phone) {
        return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    // Whitelist the incoming fields
    const payload: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
        if (body[key] !== undefined) payload[key] = body[key];
    }
    payload.created_by = user.id;
    payload.assigned_to = body.assigned_to ?? user.id;
    payload.outstanding_balance = 0;
    if (payload.source === undefined) payload.source = 'direct';

    // Service-role client bypasses RLS for this trusted, already-authenticated write.
    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await admin
        .from('clients')
        .insert([payload])
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const limit = parseInt(searchParams.get('limit') || '200');

  let query = supabase
    .from('clients')
    .select('id, name, company')
    .order('company', { ascending: true })
    .limit(limit);

  if (search) {
    query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data || [] });
}
