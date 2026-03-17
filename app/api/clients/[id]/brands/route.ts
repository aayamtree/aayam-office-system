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

  // Fetch brands for this client from clients table (brand_name field is hashtag format)
  // Also try brands table if it exists
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, company, brand_name')
    .eq('id', id)
    .single();

  if (error || !client) return NextResponse.json({ data: [] });

  // Parse brand_name from hashtag/comma format: "#tiger #cobra" or "Tiger, Cobra"
  const raw = (client as any).brand_name || '';
  let brands: { id: string; name: string }[] = [];
  if (raw.trim()) {
    brands = raw
      .split(/[,\s#]+/)
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((name: string) => ({ id: name, name: name.charAt(0).toUpperCase() + name.slice(1) }));
  }

  return NextResponse.json({ data: brands, client: { id: client.id, name: client.company || client.name } });
}
