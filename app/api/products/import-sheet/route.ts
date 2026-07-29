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
import { productDedupeKey } from '@/lib/product-dedupe';

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
    sheet: { file_url?: string; file_name?: string; thumbnail_url?: string; client_id?: string | null; sheet_name?: string; file_hash?: string };
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
      const clientId = sheet?.client_id || null;
      const jobThumb = job.thumbnail_url || sheet?.thumbnail_url || null;

      // --- De-duplication ---------------------------------------------------
      // Same brand + name + category + client = the SAME product. Re-printing
      // a design must add a version to the existing product, never create a
      // second copy of it in the library.
      const dedupeKey = productDedupeKey({ brand_name: job.brand_name, name, category, client_id: clientId });
      const { data: existing } = await supabase
        .from('products')
        .select('id, name, client_id, brand_id, product_master_id, current_version_no')
        .eq('dedupe_key', dedupeKey)
        .limit(1)
        .maybeSingle();

      let product = existing as any;
      const matched = !!existing;

      if (!matched) {
        const { data: created, error: pErr } = await supabase.from('products')
          .insert({
            name,
            category,
            client_id: clientId,
            brand_name: job.brand_name || null,
            thumbnail_url: jobThumb,
            notes: `Imported from ${sheetLabel}${job.copies_on_sheet ? ` (${job.copies_on_sheet} up on sheet)` : ''}`,
            created_by: user.id,
          })
          .select('id, name, client_id, brand_id, product_master_id, current_version_no')
          .single();
        if (pErr) { results.push({ name, ok: false, error: pErr.message }); continue; }
        product = created;

        await supabase.from('product_activity').insert({
          product_id: product.id, event_type: 'created',
          detail: `Created from ${sheetLabel}`, actor_id: user.id, actor_name: actorName,
        });
      } else {
        await supabase.from('product_activity').insert({
          product_id: product.id, event_type: 'matched',
          detail: `Recognised on ${sheetLabel} — existing product reused instead of creating a duplicate`,
          actor_id: user.id, actor_name: actorName,
        });
      }

      // Attach the sheet file as this product's design version — unless this
      // exact file is already on it (same sheet re-imported).
      let versionId: string | null = null;
      let versionSkipped = false;
      if (sheet?.file_url) {
        let dupVersion: { id: string } | null = null;
        if (sheet.file_hash) {
          const { data } = await supabase.from('product_versions')
            .select('id').eq('product_id', product.id).eq('file_hash', sheet.file_hash).limit(1).maybeSingle();
          dupVersion = data as any;
        }
        if (!dupVersion) {
          // fall back to the Drive URL when no hash was supplied
          const { data } = await supabase.from('product_versions')
            .select('id').eq('product_id', product.id).eq('file_url', sheet.file_url).limit(1).maybeSingle();
          dupVersion = data as any;
        }

        if (dupVersion) {
          versionId = dupVersion.id;
          versionSkipped = true;
        } else {
          const { data: version } = await supabase.from('product_versions')
            .insert({
              product_id: product.id,
              file_url: sheet.file_url,
              file_name: sheet.file_name || sheetLabel,
              file_hash: sheet.file_hash || null,
              thumbnail_url: jobThumb,
              designer_id: user.id,
              status: 'approved',
              scan_data: (() => { const { __local_preview, ...rest } = job; return rest; })(),
              scanned_at: new Date().toISOString(),
              size_check_status: 'skipped',
              size_check_note: 'Part of a multi-job print sheet',
              notes: `One job on ${sheetLabel}${job.copies_on_sheet ? ` · ${job.copies_on_sheet} up` : ''}`,
            })
            .select('id')
            .single();
          if (version) {
            versionId = version.id;
            await supabase.from('product_activity').update({ actor_id: user.id, actor_name: actorName }).eq('version_id', version.id).is('actor_id', null);
          }
        }
      }

      // Master cross-checks (brand + product)
      const { checkResults, resolvedBrandId, resolvedMasterId } = await runMasterChecks(
        supabase,
        { productId: product.id, clientId: product.client_id, brandId: product.brand_id, productMasterId: product.product_master_id },
        job
      );

      const { __local_preview: _lp, ...jobClean } = job;
      await supabase.from('products').update({
        scan_data: jobClean,
        scan_text: flattenScan(jobClean),
        check_results: checkResults,
        ...(resolvedBrandId ? { brand_id: resolvedBrandId, brand_name: job.brand_name || null } : {}),
        ...(resolvedMasterId ? { product_master_id: resolvedMasterId } : {}),
      }).eq('id', product.id);

      results.push({
        name, ok: true, product_id: product.id, version_id: versionId,
        brand_name: job.brand_name || null,
        matched,            // true = existing product reused, no duplicate created
        version_skipped: versionSkipped, // true = this exact file was already attached
        brand_check: checkResults.brand.status,
        product_check: checkResults.product.status,
      });
    } catch (e: any) {
      results.push({ name: job.product_name || 'job', ok: false, error: e.message });
    }
  }

  const ok = results.filter((r) => r.ok);

  // Remember which products this sheet produced, so re-uploading it can show
  // "this file already created these 6 products".
  if (sheet?.file_hash && ok.length > 0) {
    const ids = ok.map((r) => r.product_id).filter(Boolean);
    const { data: row } = await supabase
      .from('library_sheets').select('id, product_ids').eq('file_hash', sheet.file_hash).maybeSingle();
    if (row) {
      const merged = Array.from(new Set([...(row.product_ids || []), ...ids]));
      await supabase.from('library_sheets').update({ product_ids: merged }).eq('id', row.id);
    }
  }

  return NextResponse.json({
    ok: true,
    imported: ok.filter((r) => !r.matched).length,
    reused: ok.filter((r) => r.matched).length,
    results,
  });
}
