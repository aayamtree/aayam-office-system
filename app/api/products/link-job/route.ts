// API Route: /api/products/link-job — the pipeline → library bridge.
// Called by the SaveToLibraryPrompt when a design job reaches
// "Print File Ready". Three actions:
//   link   — attach job to an existing product (+ save job's final file as a version)
//   create — create a new product from the job, then link
//   skip   — mark the job as skipped (logged, reviewable later)

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

/** Latest final file attached to the job (print_files preferred, then files). */
function latestJobFile(job: any): { url: string; name: string } | null {
  for (const field of ['print_files', 'files']) {
    const arr = job?.[field];
    if (Array.isArray(arr) && arr.length > 0) {
      const f = arr[arr.length - 1];
      const url = f?.url || f?.webViewLink || f?.link;
      if (url) return { url, name: f?.name || f?.fileName || 'design file' };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { job_id, action } = body;
  if (!job_id || !action) return NextResponse.json({ error: 'job_id and action are required' }, { status: 400 });

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, job_number, project_name, client_id, brand_id, brand_name, product_category, product_category_id, print_files, files')
    .eq('id', job_id)
    .single();
  if (jobErr || !job) return NextResponse.json({ error: jobErr?.message || 'Job not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const actorName = profile?.full_name || null;

  // ── SKIP ────────────────────────────────────────────────────────────────
  if (action === 'skip') {
    const { error } = await supabase
      .from('jobs')
      .update({ library_status: 'skipped', library_skip_reason: body.skip_reason || null })
      .eq('id', job_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, skipped: true });
  }

  // ── Resolve the product (existing or new) ───────────────────────────────
  let productId: string | null = null;
  let productName = '';

  if (action === 'link') {
    if (!body.product_id) return NextResponse.json({ error: 'product_id is required for link' }, { status: 400 });
    productId = body.product_id;
    const { data: p } = await supabase.from('products').select('name').eq('id', productId).single();
    productName = p?.name || '';
  } else if (action === 'create') {
    const np = body.product || {};
    if (!np.name) return NextResponse.json({ error: 'product.name is required for create' }, { status: 400 });
    const { data: created, error: createErr } = await supabase
      .from('products')
      .insert({
        name: np.name,
        category: np.category || 'Other',
        client_id: np.client_id ?? job.client_id ?? null,
        brand_id: np.brand_id ?? job.brand_id ?? null,
        brand_name: np.brand_name ?? job.brand_name ?? null,
        size_w: np.size_w ?? null,
        size_h: np.size_h ?? null,
        size_d: np.size_d ?? null,
        size_unit: np.size_unit || 'mm',
        size_text: np.size_text ?? null,
        notes: np.notes ?? null,
        created_by: user.id,
      })
      .select('id, name')
      .single();
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    productId = created.id;
    productName = created.name;
    await supabase.from('product_activity').insert({
      product_id: productId,
      event_type: 'created',
      detail: `Product created from job ${job.job_number}`,
      actor_id: user.id,
      actor_name: actorName,
    });
  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  // ── Link job → product ──────────────────────────────────────────────────
  const { error: linkErr } = await supabase
    .from('jobs')
    .update({ product_id: productId, library_status: 'linked', library_skip_reason: null })
    .eq('id', job_id);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  await supabase.from('product_activity').insert({
    product_id: productId,
    event_type: 'linked_job',
    detail: `Linked to job ${job.job_number}${job.project_name ? ` (${job.project_name})` : ''}`,
    meta: { job_id: job.id, job_number: job.job_number },
    actor_id: user.id,
    actor_name: actorName,
  });

  // ── Save the job's final file as a new version (if the job has one) ─────
  const file = latestJobFile(job);
  let versionNo: number | null = null;
  if (file && body.attach_file !== false) {
    const { data: version, error: vErr } = await supabase
      .from('product_versions')
      .insert({
        product_id: productId,
        file_url: file.url,
        file_name: file.name,
        designer_id: user.id,
        job_id: job.id,
        job_number: job.job_number,
        size_check_status: 'skipped',
        size_check_note: 'Attached automatically from job files',
        notes: `Final design from job ${job.job_number}`,
      })
      .select('id, version_no')
      .single();
    if (!vErr && version) {
      versionNo = version.version_no;
      await supabase
        .from('product_activity')
        .update({ actor_id: user.id, actor_name: actorName })
        .eq('version_id', version.id)
        .is('actor_id', null);
    }
  }

  return NextResponse.json({ ok: true, product_id: productId, product_name: productName, version_no: versionNo, file_attached: !!(file && versionNo) });
}
