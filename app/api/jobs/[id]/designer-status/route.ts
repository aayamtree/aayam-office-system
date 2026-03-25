import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * PATCH /api/jobs/[id]/designer-status
 *
 * Access Control:
 *  - admin    → can change status on ANY job, all statuses including transfer
 *  - designer → can change status ONLY on jobs assigned to them; all statuses including transfer
 *  - others   → 403 Forbidden (marketing/finance/dispatch/cmyk only view, never change)
 *
 * Activity Logging:
 *  - Every change is recorded in job_stage_history with changed_by user ID + role
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

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get caller's role from profiles
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const callerRole = callerProfile?.role || 'unknown';
  const callerName = callerProfile?.full_name || user.email || 'Unknown';

  // ── Role Gate ─────────────────────────────────────────────────────────────
  const ALLOWED_ROLES = ['admin', 'designer'];
  if (!ALLOWED_ROLES.includes(callerRole)) {
    return NextResponse.json(
      { error: `Access denied. Only designers and admins can change task status. Your role: ${callerRole}` },
      { status: 403 }
    );
  }

  // ── Validate Input ────────────────────────────────────────────────────────
  const body = await request.json();
  const { designer_status, designer_id } = body;

  const VALID_STATUSES = ['live', 'hold', 'review', 'end', 'transfer'];
  if (!designer_status || !VALID_STATUSES.includes(designer_status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  // ── Fetch current job (for ownership check + activity log) ────────────────
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('id, job_number, project_name, designer_status, designer_id, current_stage')
    .eq('id', id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // ── Ownership Check for Designers ─────────────────────────────────────────
  // Designer can only update jobs assigned to THEM
  if (callerRole === 'designer' && job.designer_id !== user.id) {
    return NextResponse.json(
      { error: 'Access denied. You can only change status of jobs assigned to you.' },
      { status: 403 }
    );
  }

  // ── Build Update Payload ──────────────────────────────────────────────────
  const updatePayload: Record<string, any> = { designer_status };

  if (designer_status === 'transfer' && designer_id) {
    updatePayload.designer_id = designer_id; // reassign the job
  }

  // ── Update the Job ────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('jobs')
    .update(updatePayload)
    .eq('id', id)
    .select('id, project_name, designer_status, designer_id, current_stage')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Activity Log ──────────────────────────────────────────────────────────
  // Record every status change with full audit trail: who, from what, to what, when
  const prevStatus = job.designer_status || 'none';
  const logNote = designer_status === 'transfer' && designer_id
    ? `Status changed: ${prevStatus} → transfer (reassigned). By: ${callerName} (${callerRole})`
    : `Status changed: ${prevStatus} → ${designer_status}. By: ${callerName} (${callerRole})`;

  // Log to job_stage_history (reuse existing table — no new table needed)
  await supabase.from('job_stage_history').insert({
    job_id: id,
    from_stage: `designer:${prevStatus}`,       // prefix with 'designer:' to distinguish from production stages
    to_stage:   `designer:${designer_status}`,
    notes: logNote,
    changed_by: user.id,                         // USER ID for full audit trail 🔑
    changed_by_name: callerName,
    changed_by_role: callerRole,
  }).then(({ error: logError }) => {
    // Non-blocking — don't fail the request if logging fails
    if (logError) console.error('[StatusLog] Failed to write audit log:', logError.message);
  });

  return NextResponse.json({
    data,
    audit: {
      changed_by: user.id,
      changed_by_name: callerName,
      changed_by_role: callerRole,
      from_status: prevStatus,
      to_status: designer_status,
      timestamp: new Date().toISOString(),
    }
  });
}

// GET /api/jobs/[id]/designer-status — fetch current status
export async function GET(
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

  const { data, error } = await supabase
    .from('jobs')
    .select('id, designer_status, designer_id, current_stage')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
