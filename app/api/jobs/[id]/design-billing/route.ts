import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * PATCH /api/jobs/[id]/design-billing
 *
 * Finance tag: marks whether a job's DESIGN work is BILLABLE or NON_BILLABLE.
 *
 * Access Control (server-enforced — UI hiding alone is not enough):
 *  - admin  → can change the tag on ANY job
 *  - others → 403 Forbidden (designer/marketing/finance/dispatch/cmyk view only)
 *
 * Audit: every change is written to job_stage_history.
 */
export async function PATCH(
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

  // ── Auth ────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const callerRole = callerProfile?.role || 'unknown';
  const callerName = callerProfile?.full_name || user.email || 'Unknown';

  // ── Role Gate — ADMIN ONLY ──────────────────────────────────────────────
  if (callerRole !== 'admin') {
    return NextResponse.json(
      { error: `Only admins can change the billing tag. Your role: ${callerRole}` },
      { status: 403 }
    );
  }

  // ── Validate Input ──────────────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));
  const { design_billing } = body;
  const VALID = ['billable', 'non_billable'];
  if (!design_billing || !VALID.includes(design_billing)) {
    return NextResponse.json(
      { error: `Invalid value. Must be one of: ${VALID.join(', ')}` },
      { status: 400 }
    );
  }

  // ── Fetch current (for audit) ───────────────────────────────────────────
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('id, job_number, project_name, design_billing')
    .eq('id', id)
    .single();
  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // ── Update ──────────────────────────────────────────────────────────────
  // An admin setting the tag is also confirming it.
  const { data, error } = await supabase
    .from('jobs')
    .update({ design_billing, design_billing_confirmed: true })
    .eq('id', id)
    .select('id, job_number, project_name, design_billing, design_billing_confirmed')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Audit (non-blocking) ────────────────────────────────────────────────
  const prev = job.design_billing || 'none';
  supabase.from('job_stage_history').insert({
    job_id: id,
    from_stage: `billing:${prev}`,
    to_stage: `billing:${design_billing}`,
    notes: `Design billing tag: ${prev} → ${design_billing}. By: ${callerName} (${callerRole})`,
    changed_by: user.id,
    changed_by_name: callerName,
    changed_by_role: callerRole,
  }).then(({ error: logErr }) => {
    if (logErr) console.error('[DesignBilling] audit log failed:', logErr.message);
  });

  return NextResponse.json({ data });
}
