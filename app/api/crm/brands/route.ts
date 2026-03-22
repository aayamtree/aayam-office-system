import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get('client_id');

  // Fetch brand_name from clients — brands are stored as comma-separated or hashtag format
  // Also support a standalone brands table if it exists
  let brands: { id: string; name: string }[] = [];

  try {
    // Try brands table first (if it exists)
    const { data: brandsData, error } = await supabase
      .from('brands')
      .select('id, name')
      .order('name');

    if (!error && brandsData) {
      // Filter by client if requested
      if (clientId) {
        const { data: clientBrands } = await supabase
          .from('brands')
          .select('id, name')
          .eq('client_id', clientId)
          .order('name');
        brands = clientBrands || brandsData;
      } else {
        brands = brandsData;
      }
    }
  } catch {
    // brands table doesn't exist — return empty (brand is a free-text field)
    brands = [];
  }

  return NextResponse.json({ data: brands });
}
