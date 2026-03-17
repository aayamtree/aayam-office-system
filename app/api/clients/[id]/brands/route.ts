import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Try proper brands table first (available after SQL migration ADD_BRANDS_TABLE.sql)
  const { data: brandsFromTable, error: brandsError } = await supabase
    .from('brands')
    .select('id, name')
    .eq('client_id', id)
    .order('name');

  if (!brandsError && brandsFromTable && brandsFromTable.length > 0) {
    // Proper brands table exists and has data — return real UUIDs
    return NextResponse.json({
      data: brandsFromTable,
      source: 'brands_table',
    });
  }

  // 2. Fallback: parse brand_name text field from clients table
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company, brand_name')
    .eq('id', id)
    .single();

  if (!client) return NextResponse.json({ data: [] });

  const raw = (client as any).brand_name || '';
  let brands: { id: string; name: string }[] = [];
  if (raw.trim()) {
    brands = raw
      .split(/[,\s#]+/)
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((name: string) => ({
        id: name.toLowerCase().replace(/\s+/g, '_'), // deterministic temp id (not a UUID)
        name: name.charAt(0).toUpperCase() + name.slice(1),
      }));
  }

  return NextResponse.json({
    data: brands,
    source: 'text_fallback',
    client: { id: client.id, name: (client as any).company || client.name },
  });
}

// POST /api/clients/:id/brands — create a new brand for this client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });

  // Upsert: if brand already exists for this client, return it without error
  const { data, error } = await supabase
    .from('brands')
    .upsert({ name, client_id: clientId }, { onConflict: 'name,client_id', ignoreDuplicates: false })
    .select('id, name')
    .single();

  if (error) {
    // brands table may not exist yet — return a temp entry so form still works
    if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
      return NextResponse.json({ data: { id: name.toLowerCase().replace(/\s+/g, '_'), name } });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
