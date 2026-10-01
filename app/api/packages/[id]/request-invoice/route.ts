import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// POST /api/packages/[id]/request-invoice
// One box / sack = ONE invoice and ONE e-way bill covering every job inside.
// Dispatch asks accounts once, with the full item list, instead of once per job.
// Accounts attaches the invoice to any one job in the package; Dispatch shares
// it across the package (see shareDocsAcrossPackages).
const COOLDOWN_MINUTES = 180; // 3h, same as the per-job request

export async function POST(
  _request: NextRequest,
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
  if (!user) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });

  const { data: pkg, error: pkgErr } = await supabase
    .from('packages')
    .select('id, consignment_no, package_type, package_count, approx_weight_kg, client:clients(name, company)')
    .eq('id', id)
    .maybeSingle();
  if (pkgErr) return NextResponse.json({ error: pkgErr.message }, { status: 500 });
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('id, job_number, project_name, quantity, product_category, invoice_requested_at')
    .eq('package_id', id)
    .order('job_number', { ascending: true });
  if (jobsErr) return NextResponse.json({ error: jobsErr.message }, { status: 500 });
  if (!jobs || jobs.length === 0) return NextResponse.json({ error: 'This package has no jobs' }, { status: 400 });

  const now = Date.now();
  const last = Math.max(...jobs.map((j: any) => (j.invoice_requested_at ? new Date(j.invoice_requested_at).getTime() : 0)));
  const allRequested = jobs.every((j: any) => !!j.invoice_requested_at);
  if (allRequested && last && now - last < COOLDOWN_MINUTES * 60 * 1000) {
    return NextResponse.json({ success: true, alreadyRequested: true });
  }

  const requestedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('jobs')
    .update({ invoice_requested_at: requestedAt, invoice_requested_by: user.id })
    .eq('package_id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const client = (pkg as any).client;
  const clientName = client?.company || client?.name || 'N/A';
  const items = jobs
    .map((j: any) => `• #${j.job_number} ${j.project_name || ''}${j.quantity ? ` — ${j.quantity} pcs` : ''}`)
    .join('\n');
  const first = jobs[0] as any;

  const { error: notifyErr } = await supabase.from('broadcast_notifications').insert({
    message:
      `🔔 Dispatch requesting ONE invoice + e-way bill for package ${pkg.consignment_no}\n` +
      `Client: ${clientName}\n` +
      `Packed as: ${pkg.package_count} ${pkg.package_type}(s)${pkg.approx_weight_kg ? ` · ~${pkg.approx_weight_kg}kg` : ''}\n` +
      `Items in this package:\n${items}\n` +
      `Attach the invoice / e-way bill to any ONE of these jobs — it applies to the whole package.`,
    target_audience: 'admin',
    priority: 'urgent',
    created_by: user.id,
    link: `/admin/jobs/${first.id}`,
  });
  if (notifyErr) {
    return NextResponse.json({ success: true, notified: false, warning: 'Saved, but notification could not be sent.' });
  }
  return NextResponse.json({ success: true, notified: true });
}
