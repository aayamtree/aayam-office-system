import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/** Shared helper — service-role client for shipping-address operations */
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

const SELECT = 'id, label, contact_name, contact_phone, address, city, state, pincode, is_default';

// GET /api/clients/:id/shipping-addresses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('client_shipping_addresses')
    .select(SELECT)
    .eq('client_id', id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

// POST /api/clients/:id/shipping-addresses — add a shipping address
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const address = (body.address || '').trim();
  if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 });

  const payload = {
    client_id: clientId,
    label: (body.label || '').trim() || 'Shipping Address',
    contact_name: (body.contact_name || '').trim() || null,
    contact_phone: (body.contact_phone || '').trim() || null,
    address,
    city: (body.city || '').trim() || null,
    state: (body.state || '').trim() || null,
    pincode: (body.pincode || '').trim() || null,
    is_default: !!body.is_default,
  };

  const { data, error } = await supabase
    .from('client_shipping_addresses')
    .insert(payload)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/clients/:id/shipping-addresses — remove one (body: { addressId })
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const addressId = body.addressId as string;
  if (!addressId) return NextResponse.json({ error: 'addressId is required' }, { status: 400 });

  const { error } = await supabase
    .from('client_shipping_addresses')
    .delete()
    .eq('id', addressId)
    .eq('client_id', clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
