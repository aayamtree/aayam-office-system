import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// PATCH /api/jobs/[id]/approve
// One-click approve: sets current_stage = 'designing'
// Any admin can call this
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin role
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can approve jobs' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action || 'approve'; // 'approve' or 'reject'
  const rejectReason = body.reason || '';

  const newStage = action === 'approve' ? 'designing' : 'new';

  // Step 1: Update current_stage only (safe — column always exists)
  // Use maybeSingle() to avoid the "Cannot coerce to single JSON object" error
  // when the job has already been processed (filter returns 0 rows on re-click).
  const { data: job, error } = await supabase
    .from('jobs')
    .update({ current_stage: newStage })
    .eq('id', id)
    .eq('current_stage', 'awaiting_admin') // safety: only approve pending jobs
    .select('id, project_name, job_number, designer_id, current_stage')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If nothing matched, the job was already processed. Return idempotent success
  // so a double-click doesn't look like a failure to the user.
  if (!job) {
    const { data: existing } = await supabase
      .from('jobs')
      .select('id, project_name, job_number, current_stage')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: true,
      action,
      job: {
        id: existing.id,
        project_name: existing.project_name,
        job_number: existing.job_number,
        current_stage: existing.current_stage,
      },
    });
  }

  // Step 2: record WHO approved this and what was said.
  //
  // This used to be wrapped in try/catch with a comment saying it failed
  // safely if the columns did not exist. It did not fail safely — it failed
  // SILENTLY, which is worse. Supabase RETURNS errors, it does not throw them,
  // so the catch never ran, nothing was logged, and not one approval was ever
  // recorded. The columns are real now; if this ever breaks again it will say
  // so out loud.
  const { error: auditErr } = await supabase.from('jobs').update({
    approval_status: action === 'approve' ? 'approved' : 'rejected',
    approval_by: user.id,
    approval_date: new Date().toISOString(),
    ...(action === 'reject' && body.reason ? { approval_remark: body.reason } : {}),
  }).eq('id', id);

  if (auditErr) {
    // The approval itself already succeeded in step 1, so this is not fatal —
    // but it must be visible rather than swallowed.
    console.error(`[approve] job ${id}: approval recorded but audit trail NOT saved:`, auditErr.message);
  }

  // Notify designer via broadcast_notifications
  if (job.designer_id) {
    const message = action === 'approve'
      ? `✅ Your job "${job.project_name}" (${job.job_number}) has been approved! You can start designing.`
      : `❌ Your job "${job.project_name}" (${job.job_number}) was not approved. ${rejectReason ? `Reason: ${rejectReason}` : 'Please check with admin.'}`;

    await supabase.from('broadcast_notifications').insert({
      message,
      priority: 'high',
      target_audience: 'designer',
      created_by: user.id,
      link: `/admin/jobs/${id}`,
    });
  }

  return NextResponse.json({
    success: true,
    action,
    job: { id: job.id, project_name: job.project_name, job_number: job.job_number, current_stage: newStage }
  });
}
