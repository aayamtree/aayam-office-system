import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ITEM_FIELDS = ['description', 'quantity', 'rate', 'amount', 'gst_rate'] as const;

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

// Replace all items for a quotation (delete existing, insert new) under the
// service role so it survives a lapsed browser session.
export async function PUT(request: NextRequest) {
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

  const quotationId = body.quotationId;
  if (!quotationId) return NextResponse.json({ error: 'quotationId is required' }, { status: 400 });

  const items = Array.isArray(body.items) ? body.items : [];

  const { error: delError } = await admin
    .from('quotation_items')
    .delete()
    .eq('quotation_id', quotationId);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (items.length > 0) {
    const rows = items.map((item: any) => {
      const row: Record<string, any> = { quotation_id: quotationId };
      for (const key of ITEM_FIELDS) if (item[key] !== undefined) row[key] = item[key];
      return row;
    });
    const { error: insError } = await admin.from('quotation_items').insert(rows);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
