import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Saved item catalog (Zoho Books style). Reads happen client-side via RLS;
// all writes go through this service-role route so they never fail as anon.
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

function cleanPayload(body: any) {
  const payload: Record<string, any> = {};
  if (typeof body.name === 'string') payload.name = body.name.trim();
  if (typeof body.description === 'string') payload.description = body.description.trim();
  if (body.rate !== undefined) payload.rate = Number(body.rate) || 0;
  if (typeof body.hsn_code === 'string') payload.hsn_code = body.hsn_code.trim();
  if (body.gst_rate !== undefined) payload.gst_rate = Number(body.gst_rate) || 0;
  if (typeof body.is_active === 'boolean') payload.is_active = body.is_active;
  return payload;
}

// Create a new saved item
export async function POST(request: NextRequest) {
  const { user, admin } = await authAndAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again and retry.' }, { status: 401 });
  }

  let body: any = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const payload = cleanPayload(body);
  if (!payload.name) {
    return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('catalog_items')
    .insert(payload)
    .select()
    .single();

  if (error) {
    const msg = (error.code === '23505')
      ? 'An item with this name already exists'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ item: data });
}

// Update an existing saved item
export async function PATCH(request: NextRequest) {
  const { user, admin } = await authAndAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again and retry.' }, { status: 401 });
  }

  let body: any = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'Item id is required' }, { status: 400 });

  const payload = cleanPayload(body);
  if (payload.name !== undefined && !payload.name) {
    return NextResponse.json({ error: 'Item name cannot be empty' }, { status: 400 });
  }
  payload.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from('catalog_items')
    .update(payload)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    const msg = (error.code === '23505')
      ? 'An item with this name already exists'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ item: data });
}

// Delete a saved item (hard delete)
export async function DELETE(request: NextRequest) {
  const { user, admin } = await authAndAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again and retry.' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Item id is required' }, { status: 400 });

  const { error } = await admin.from('catalog_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
