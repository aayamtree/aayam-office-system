import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

// Valid status transitions map
const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ['live'],
  live:    ['hold', 'review', 'end'],
  hold:    ['live'],
  review:  ['live', 'rework', 'end'],
  rework:  ['live'],
  end:     ['rework'],
};

// Dossier entry type mapping
const DOSSIER_TYPE: Record<string, string> = {
  'live-from-created': 'LIVE_STARTED',
  'live':              'LIVE_STARTED',
  'hold':              'HOLD_APPLIED',
  'review':            'REVIEW_STARTED',
  'rework':            'REWORK_CREATED',
  'end':               'TASK_ENDED',
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { new_status, reason } = body;

  if (!new_status) return NextResponse.json({ error: 'new_status is required' }, { status: 400 });

  // Get current task
  const { data: task, error: taskError } = await supabase
    .from('design_tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (taskError || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Access control: designer must own the task (or be admin)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';
  if (!isAdmin && task.assigned_to !== user.id && task.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate transition
  const allowed = VALID_TRANSITIONS[task.current_status] || [];
  if (!allowed.includes(new_status)) {
    return NextResponse.json({
      error: `Invalid transition: ${task.current_status} → ${new_status}. Allowed: ${allowed.join(', ')}`
    }, { status: 400 });
  }

  // If going to HOLD, reason is required
  if (new_status === 'hold' && !reason) {
    return NextResponse.json({ error: 'A reason is required when putting a task on hold' }, { status: 400 });
  }

  // Calculate rework number if going to rework
  let reworkNumber: number | null = null;
  if (new_status === 'rework') {
    const { count } = await supabase
      .from('task_status_history')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', id)
      .eq('to_status', 'rework');
    reworkNumber = (count || 0) + 1;
  }

  // Handle time session on status change
  if (new_status === 'live') {
    // Determine session type based on rework_count
    const sessionType = (task.rework_count || 0) > 0 ? 'rework' : 'design';
    // Start a new time session
    await supabase.from('task_time_sessions').insert({
      task_id: id,
      designer_id: user.id,
      session_start: new Date().toISOString(),
      session_type: sessionType,
    });
  } else if (task.current_status === 'live') {
    // Pause/end the open session
    const { data: openSession } = await supabase
      .from('task_time_sessions')
      .select('id, session_start')
      .eq('task_id', id)
      .is('session_end', null)
      .order('session_start', { ascending: false })
      .limit(1)
      .single();

    if (openSession) {
      const start = new Date(openSession.session_start).getTime();
      const end = new Date().getTime();
      const durationMinutes = Math.round((end - start) / 60000);
      await supabase.from('task_time_sessions').update({
        session_end: new Date().toISOString(),
        duration_minutes: durationMinutes,
        pause_reason: reason || null,
      }).eq('id', openSession.id);
    }
  }

  // Update task status — this is critical, must always succeed
  const updates: any = { current_status: new_status };
  if (new_status === 'rework') updates.rework_count = reworkNumber;
  const { error: updateError } = await supabase.from('design_tasks').update(updates).eq('id', id);
  if (updateError) {
    console.error('CRITICAL: Failed to update task status:', updateError);
    return NextResponse.json({ error: `Failed to update status: ${updateError.message}` }, { status: 500 });
  }

  // Write status history (non-critical — wrap in try-catch)
  try {
    await supabase.from('task_status_history').insert({
      task_id: id,
      from_status: task.current_status,
      to_status: new_status,
      changed_by: user.id,
      reason: reason || null,
      rework_number: reworkNumber,
    });
  } catch (e) { console.warn('task_status_history insert failed (non-critical):', e); }

  // Write dossier entry (non-critical — wrap in try-catch)
  try {
    // Fetch actor's name for performed_by_name
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    const performedByName = actorProfile?.full_name || user.email || 'Unknown';

    const entryType = new_status === 'rework'
      ? 'REWORK_CREATED'
      : new_status === 'end'
      ? 'TASK_ENDED'
      : new_status === 'hold'
      ? 'HOLD_APPLIED'
      : new_status === 'live'
      ? 'LIVE_STARTED'
      : new_status === 'review'
      ? 'REVIEW_STARTED'
      : 'STATUS_CHANGED';

    await supabase.from('dossier_entries').insert({
      task_id: id,
      entry_type: entryType,
      actor_id: user.id,
      performed_by_name: performedByName,   // only saved if column exists
      data_json: {
        from_status: task.current_status,
        to_status: new_status,
        reason: reason || null,
        rework_number: reworkNumber,
        timestamp: new Date().toISOString(),
        performed_by_name: performedByName,  // also in JSON — always works
      },
    });
  } catch (e) { console.warn('dossier_entries insert failed (non-critical):', e); }

  // Fetch updated task
  const { data: updated } = await supabase.from('design_tasks').select('*').eq('id', id).single();
  return NextResponse.json({ data: updated });
}

