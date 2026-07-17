// API Route: /api/products/master-update
// When a scan finds a mismatch and the DESIGN is the correct/newer source,
// this overwrites the brand or product master with the scanned details.
// POST { type: 'brand' | 'product', id, product_id, fields: {field: value,...} }

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
  const { data: { user } } = await auth.auth.getUser();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;
  return { user, supabase: service };
}

function flatten(v: any): string {
  const parts: string[] = [];
  const push = (x: any) => {
    if (x == null) return;
    if (Array.isArray(x)) x.forEach(push);
    else if (typeof x === 'object') Object.values(x).forEach(push);
    else parts.push(String(x));
  };
  push(v);
  return parts.join(' ').slice(0, 20000);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, id, product_id, fields } = await request.json();
  if (!type || !id || !fields) return NextResponse.json({ error: 'type, id and fields are required' }, { status: 400 });

  const table = type === 'brand' ? 'brands' : 'product_masters';
  const { data: row, error: readErr } = await supabase.from(table).select('id, name, master_data').eq('id', id).single();
  if (readErr || !row) return NextResponse.json({ error: readErr?.message || 'Master not found' }, { status: 404 });

  const merged = { ...(row.master_data || {}), ...fields };
  const update: any = { master_data: merged, master_text: flatten(merged) };
  if (type === 'brand') update.master_updated_at = new Date().toISOString();
  else update.updated_at = new Date().toISOString();

  const { error } = await supabase.from(table).update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Clear the mismatch on the product's stored check + log who approved the update
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  if (product_id) {
    const { data: prod } = await supabase.from('products').select('check_results').eq('id', product_id).single();
    const cr = prod?.check_results || {};
    const key = type === 'brand' ? 'brand' : 'product';
    if (cr[key]) cr[key] = { ...cr[key], status: 'match', mismatches: [], updated_by_user: true };
    await supabase.from('products').update({ check_results: cr }).eq('id', product_id);
    await supabase.from('product_activity').insert({
      product_id,
      event_type: 'updated',
      detail: `${type === 'brand' ? 'Brand' : 'Product'} master "${row.name}" updated with new details from design (${Object.keys(fields).join(', ')})`,
      actor_id: user.id,
      actor_name: profile?.full_name || null,
    });
  }

  return NextResponse.json({ ok: true });
}
