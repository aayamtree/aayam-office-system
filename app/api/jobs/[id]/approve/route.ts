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
  const { data: job, error } = await supabase
    .from('jobs')
    .update({ current_stage: newStage })
    .eq('id', id)
    .eq('current_stage', 'awaiting_admin') // safety: only approve pending jobs
    .select('id, project_name, job_number, designer_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Job not found or already processed' }, { status: 404 });

  // Step 2: Try to add audit fields — silently ignore if columns don't exist yet
  try {
    await supabase.from('jobs').update({
      approval_status: action === 'approve' ? 'approved' : 'rejected',
      approval_by: user.id,
      approval_date: new Date().toISOString(),
      ...(action === 'reject' && body.reason ? { approval_remark: body.reason } : {}),
    }).eq('id', id);
  } catch (_) {
    // Audit columns not yet added — main approval already succeeded
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
    });
  }

  return NextResponse.json({
    success: true,
    action,
    job: { id: job.id, project_name: job.project_name, job_number: job.job_number, current_stage: newStage }
  });
}
