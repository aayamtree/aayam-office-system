import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * POST /api/jobs/[id]/confirm-print-ready
 *
 * The assigned designer (or an admin) confirms the client's print file is
 * print-ready. Effect:
 *   - jobs.print_ready          = true
 *   - jobs.current_stage        = 'ready_to_print'  (enters Production / Print Planner)
 *   - jobs.drive_file_status    = 'verified'
 *   - jobs.drive_file_verified_at = now()
 *   - jobs.designer_status      = 'end'
 *
 * Access: admin, or the designer the job is assigned to.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const callerRole = callerProfile?.role || 'unknown';
  if (!['admin', 'designer'].includes(callerRole)) {
    return NextResponse.json({ error: 'Only the assigned designer or an admin can confirm print-ready.' }, { status: 403 });
  }

  const db = createServerSupabase();

  const { data: job, error: fetchError } = await db
    .from('jobs')
    .select('id, job_number, job_type, current_stage, designer_id')
    .eq('id', id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Designer may only confirm jobs assigned to them
  if (callerRole === 'designer' && job.designer_id !== user.id) {
    return NextResponse.json({ error: 'You can only confirm jobs assigned to you.' }, { status: 403 });
  }

  // Guard: print-only and still in the verification window
  const type = (job.job_type || '').toLowerCase();
  const isPrintOnly = type === 'print only' || type === 'print_only' || type === 'printing';
  if (!isPrintOnly) {
    return NextResponse.json({ error: 'This action is only for Print-Only jobs.' }, { status: 400 });
  }
  if (!['file_received', 'file_check'].includes(job.current_stage)) {
    return NextResponse.json({ error: `Job is at "${job.current_stage}" — nothing to confirm.` }, { status: 400 });
  }

  const { error: updateError } = await db
    .from('jobs')
    .update({
      print_ready: true,
      current_stage: 'ready_to_print',
      drive_file_status: 'verified',
      drive_file_verified_at: new Date().toISOString(),
      designer_status: 'end',
    })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await db.from('job_stage_history').insert({
    job_id: id,
    from_stage: job.current_stage,
    to_stage: 'ready_to_print',
    notes: `Print file verified & confirmed print-ready. By: ${callerProfile?.full_name || user.email} (${callerRole})`,
    changed_by: user.id,
    changed_by_name: callerProfile?.full_name || user.email,
    changed_by_role: callerRole,
  }).then(({ error }) => { if (error) console.error('[confirm-print-ready] log failed:', error.message); });

  return NextResponse.json({ ok: true, current_stage: 'ready_to_print' });
}
