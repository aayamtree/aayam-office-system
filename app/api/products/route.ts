// API Route: /api/products — Product Library create & update.
// Uses the service-role client for writes (browser writes silently fail
// as anon when the Supabase session lapses — see jobs files route).

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

const PRODUCT_FIELDS = [
  'client_id', 'brand_id', 'brand_name', 'name', 'category', 'category_id',
  'size_w', 'size_h', 'size_d', 'size_unit', 'size_text',
  'thumbnail_url', 'file_url', 'notes', 'is_active',
] as const;

function pickFields(body: any) {
  const out: Record<string, any> = {};
  for (const f of PRODUCT_FIELDS) {
    if (f in body) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

async function getActorName(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  return data?.full_name || null;
}

// POST /api/products — create a product
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const fields = pickFields(body);
  if (!fields.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const { data: product, error } = await supabase
    .from('products')
    .insert({ ...fields, created_by: user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = await getActorName(supabase, user.id);
  await supabase.from('product_activity').insert({
    product_id: product.id,
    event_type: 'created',
    detail: `Product created: ${product.name}`,
    actor_id: user.id,
    actor_name: actorName,
  });

  return NextResponse.json({ product });
}

// PATCH /api/products — update a product ({ id, ...fields })
export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const fields = pickFields(body);
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from('products')
    .update(fields)
    .eq('id', body.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = await getActorName(supabase, user.id);
  await supabase.from('product_activity').insert({
    product_id: product.id,
    event_type: 'updated',
    detail: `Details updated (${Object.keys(fields).join(', ')})`,
    actor_id: user.id,
    actor_name: actorName,
  });

  return NextResponse.json({ product });
}
