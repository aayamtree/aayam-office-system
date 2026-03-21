import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/** Shared helper — service-role client for brand operations */
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

/** Sync a name into clients.brand_name hashtag text field (backward compat) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBrandToClientText(
  supabase: any,
  clientId: string,
  brandName: string,
  remove = false
) {
  try {
    const { data: client } = await supabase
      .from('clients').select('brand_name').eq('id', clientId).single();
    const raw = (client?.brand_name || '') as string;
    const parts = raw.split(/[\s,]+/).map((s: string) => s.replace(/^#/, '').trim()).filter(Boolean);

    if (remove) {
      const updated = parts.filter((p: string) => p.toLowerCase() !== brandName.toLowerCase()).map((p: string) => `#${p}`).join(' ');
      await supabase.from('clients').update({ brand_name: updated }).eq('id', clientId);
    } else {
      const exists = parts.some((p: string) => p.toLowerCase() === brandName.toLowerCase());
      if (!exists) {
        const updated = parts.length ? `${parts.map((p: string) => `#${p}`).join(' ')} #${brandName}` : `#${brandName}`;
        await supabase.from('clients').update({ brand_name: updated }).eq('id', clientId);
      }
    }
  } catch { /* non-fatal */ }
}

// GET /api/clients/:id/brands
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Try proper brands table first
  const { data: brandsFromTable, error: brandsError } = await supabase
    .from('brands')
    .select('id, name')
    .eq('client_id', id)
    .order('name');

  if (!brandsError && brandsFromTable) {
    if (brandsFromTable.length > 0) {
      return NextResponse.json({ data: brandsFromTable, source: 'brands_table' });
    }

    // Table exists but empty — still check text field to seed
    const { data: client } = await supabase
      .from('clients').select('brand_name').eq('id', id).single();
    const raw = (client?.brand_name || '') as string;
    if (raw.trim()) {
      const parsed = raw
        .split(/[,\s#]+/).map((s: string) => s.trim()).filter(Boolean)
        .map((n: string) => ({ id: n.toLowerCase().replace(/\s+/g, '_'), name: n.charAt(0).toUpperCase() + n.slice(1) }));
      return NextResponse.json({ data: parsed, source: 'text_fallback' });
    }
    return NextResponse.json({ data: [], source: 'brands_table' });
  }

  // 2. brands table doesn't exist — parse text field
  const { data: client } = await supabase
    .from('clients').select('id, name, company, brand_name').eq('id', id).single();
  if (!client) return NextResponse.json({ data: [] });

  const raw = ((client as Record<string, unknown>).brand_name as string) || '';
  const brands: { id: string; name: string }[] = raw.trim()
    ? raw.split(/[,\s#]+/).map((s: string) => s.trim()).filter(Boolean)
        .map((name: string) => ({ id: name.toLowerCase().replace(/\s+/g, '_'), name: name.charAt(0).toUpperCase() + name.slice(1) }))
    : [];

  return NextResponse.json({ data: brands, source: 'text_fallback' });
}

// POST /api/clients/:id/brands — create a new brand for this client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('brands')
    .upsert({ name, client_id: clientId }, { onConflict: 'name,client_id', ignoreDuplicates: false })
    .select('id, name')
    .single();

  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
      // brands table not yet migrated — return temp entry and still sync text
      const tempBrand = { id: name.toLowerCase().replace(/\s+/g, '_'), name };
      await syncBrandToClientText(supabase, clientId, name);
      return NextResponse.json({ data: tempBrand });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync new brand name back to clients.brand_name text field
  await syncBrandToClientText(supabase, clientId, name);

  return NextResponse.json({ data });
}

// DELETE /api/clients/:id/brands — remove a brand
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const brandId = body.brandId as string;
  const brandName = (body.name || '').trim();
  if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 });

  const { error } = await supabase.from('brands').delete().eq('id', brandId).eq('client_id', clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync removal from clients.brand_name
  await syncBrandToClientText(supabase, clientId, brandName, true);

  return NextResponse.json({ success: true });
}
