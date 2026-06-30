import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { notifyPrintReviewAssigned } from '@/lib/notification-service';

/**
 * POST /api/jobs/[id]/assign-print-review
 *
 * Admin sends a PRINT-ONLY job's client print-file to a chosen designer so the
 * designer can verify it's print-ready. Effect:
 *   - jobs.designer_id      = chosen designer
 *   - jobs.current_stage    = 'file_check'  (Printability QC — shows in designer queue)
 *   - jobs.designer_status  = 'live'
 *   - jobs.print_ready      = false
 * Then notifies the designer (in-app + Telegram with a clickable job link).
 *
 * Access: admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Auth (cookie session) ──────────────────────────────────────────────────
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await authClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can send a file for print review.' }, { status: 403 });
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));
  const designerId = body?.designer_id as string | undefined;
  if (!designerId) {
    return NextResponse.json({ error: 'designer_id is required.' }, { status: 400 });
  }

  // ── Privileged writes via service role ─────────────────────────────────────
  const db = createServerSupabase();

  // Fetch the job (+ client for the notification)
  const { data: job, error: fetchError } = await db
    .from('jobs')
    .select('id, job_number, project_name, job_type, current_stage, priority, designer_id, client:clients(id, name, company)')
    .eq('id', id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Guard: must be a Print-Only job still in the design-verification window
  const type = (job.job_type || '').toLowerCase();
  const isPrintOnly = type === 'print only' || type === 'print_only' || type === 'printing';
  if (!isPrintOnly) {
    return NextResponse.json({ error: 'This action is only for Print-Only jobs.' }, { status: 400 });
  }
  const ALLOWED_FROM = ['new', 'file_received', 'file_check'];
  if (!ALLOWED_FROM.includes(job.current_stage)) {
    return NextResponse.json({ error: `Job is at "${job.current_stage}" — can only be sent for review from the design stage.` }, { status: 400 });
  }

  // Confirm the chosen designer exists
  const { data: designer } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('id', designerId)
    .single();
  if (!designer) {
    return NextResponse.json({ error: 'Selected designer not found.' }, { status: 400 });
  }

  // ── Update the job ─────────────────────────────────────────────────────────
  const { error: updateError } = await db
    .from('jobs')
    .update({
      designer_id: designerId,
      current_stage: 'file_check',
      designer_status: 'live',
      print_ready: false,
    })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // ── Audit log ──────────────────────────────────────────────────────────────
  await db.from('job_stage_history').insert({
    job_id: id,
    from_stage: job.current_stage,
    to_stage: 'file_check',
    notes: `Print file sent to ${designer.full_name} for print-ready verification. By: ${callerProfile?.full_name || user.email} (admin)`,
    changed_by: user.id,
    changed_by_name: callerProfile?.full_name || user.email,
    changed_by_role: 'admin',
  }).then(({ error }) => { if (error) console.error('[assign-print-review] log failed:', error.message); });

  // ── Notify the designer (in-app + Telegram with clickable link) ────────────
  try {
    const origin = new URL(request.url).origin;
    const jobUrl = `${origin}/admin/jobs/${id}`;
    await notifyPrintReviewAssigned(designerId, job, jobUrl, db);
  } catch (e) {
    console.error('[assign-print-review] notify failed:', e);
    // non-blocking
  }

  return NextResponse.json({
    ok: true,
    designer: { id: designer.id, full_name: designer.full_name },
    current_stage: 'file_check',
  });
}
