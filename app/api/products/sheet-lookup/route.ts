// API Route: /api/products/sheet-lookup — "have we seen this file before?"
//
// The browser hashes the print sheet (SHA-256 of the bytes) BEFORE uploading
// anything. If we already scanned that exact file we return the previous scan
// plus the products it created, so the user can stop instead of paying for
// another Claude scan and creating a second copy of every product.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;

  const body = await request.json().catch(() => ({}));
  const fileHash: string | null = body.file_hash || null;
  if (!fileHash) return NextResponse.json({ error: 'file_hash is required' }, { status: 400 });

  const { data: sheet } = await supabase
    .from('library_sheets')
    .select('*')
    .eq('file_hash', fileHash)
    .maybeSingle();

  if (!sheet) return NextResponse.json({ known: false });

  // Which products did that scan create, and do they still exist?
  let products: any[] = [];
  if (Array.isArray(sheet.product_ids) && sheet.product_ids.length > 0) {
    const { data } = await supabase
      .from('products')
      .select('id, name, brand_name, category, thumbnail_url, current_version_no')
      .in('id', sheet.product_ids);
    products = data || [];
  }

  // Record the repeat sighting (useful signal: how often staff re-upload).
  await supabase
    .from('library_sheets')
    .update({ times_seen: (sheet.times_seen || 1) + 1, last_seen_at: new Date().toISOString() })
    .eq('id', sheet.id);

  return NextResponse.json({
    known: true,
    sheet: {
      id: sheet.id,
      file_name: sheet.file_name,
      file_url: sheet.file_url,
      thumbnail_url: sheet.thumbnail_url,
      job_count: sheet.job_count,
      scanned_at: sheet.scanned_at,
      scanned_by_name: sheet.scanned_by_name,
      times_seen: (sheet.times_seen || 1) + 1,
    },
    // The cached AI result — lets the user re-import selected jobs without
    // paying for another scan.
    jobs: sheet.scan_result || [],
    products,
  });
}
