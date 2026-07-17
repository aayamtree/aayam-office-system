// API Route: /api/products/import-sheet — save the jobs detected on a sheet.
// For each selected job: create (or reuse) a product, attach the sheet file
// as its design version, store the job's scan_data, and run the brand +
// product master cross-checks (shared helper). No extra Claude calls — uses
// the detection output.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { runMasterChecks, flattenScan } from '@/lib/product-masters-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const PACKAGING = ['Box', 'Label', 'Pouch', 'Carton', 'Sticker', 'Bag', 'Other'];
function cleanCategory(c: any): string {
  const s = String(c || '').trim();
  const hit = PACKAGING.find((p) => p.toLowerCase() === s.toLowerCase());
  return hit || 'Other';
}

async function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await auth.auth.getUser();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;
  return { user, supabase: service };
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { jobs, sheet } = body as {
    jobs: any[];
    sheet: { file_url?: string; file_name?: string; thumbnail_url?: string; client_id?: string | null; sheet_name?: string };
  };
  if (!Array.isArray(jobs) || jobs.length === 0) return NextResponse.json({ error: 'jobs array is required' }, { status: 400 });

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const actorName = profile?.full_name || null;
  const sheetLabel = sheet?.sheet_name || sheet?.file_name || 'job sheet';

  const results: any[] = [];

  for (const job of jobs) {
    try {
      const name = (job.product_name || job.brand_name || 'Untitled job').toString().trim().slice(0, 200);
      const category = cleanCategory(job.category);

      // Create the product
      const { data: product, error: pErr } = await supabase.from('products')
        .insert({
          name,
          category,
          client_id: sheet?.client_id || null,
          brand_name: job.brand_name || null,
          notes: `Imported from ${sheetLabel}${job.copies_on_sheet ? ` (${job.copies_on_sheet} up on sheet)` : ''}`,
          created_by: user.id,
        })
        .select('id, name, client_id, brand_id, product_master_id')
        .single();
      if (pErr) { results.push({ name, ok: false, error: pErr.message }); continue; }

      await supabase.from('product_activity').insert({
        product_id: product.id, event_type: 'created',
        detail: `Created from ${sheetLabel}`, actor_id: user.id, actor_name: actorName,
      });

      // Attach the sheet file as this product's design version
      if (sheet?.file_url) {
        const { data: version } = await supabase.from('product_versions')
          .insert({
            product_id: product.id,
            file_url: sheet.file_url,
            file_name: sheet.file_name || sheetLabel,
            thumbnail_url: sheet.thumbnail_url || null,
            designer_id: user.id,
            status: 'approved',
            scan_data: job,
            scanned_at: new Date().toISOString(),
            size_check_status: 'skipped',
            size_check_note: 'Part of a multi-job print sheet',
            notes: `One job on ${sheetLabel}${job.copies_on_sheet ? ` · ${job.copies_on_sheet} up` : ''}`,
          })
          .select('id')
          .single();
        if (version) {
          await supabase.from('product_activity').update({ actor_id: user.id, actor_name: actorName }).eq('version_id', version.id).is('actor_id', null);
        }
      }

      // Master cross-checks (brand + product)
      const { checkResults, resolvedBrandId, resolvedMasterId } = await runMasterChecks(
        supabase,
        { productId: product.id, clientId: product.client_id, brandId: product.brand_id, productMasterId: product.product_master_id },
        job
      );

      await supabase.from('products').update({
        scan_data: job,
        scan_text: flattenScan(job),
        check_results: checkResults,
        ...(resolvedBrandId ? { brand_id: resolvedBrandId, brand_name: job.brand_name || null } : {}),
        ...(resolvedMasterId ? { product_master_id: resolvedMasterId } : {}),
      }).eq('id', product.id);

      results.push({
        name, ok: true, product_id: product.id,
        brand_check: checkResults.brand.status,
        product_check: checkResults.product.status,
      });
    } catch (e: any) {
      results.push({ name: job.product_name || 'job', ok: false, error: e.message });
    }
  }

  return NextResponse.json({ ok: true, imported: results.filter((r) => r.ok).length, results });
}
