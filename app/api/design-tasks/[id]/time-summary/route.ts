import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

  // Fetch all time sessions for this task
  const { data: sessions, error } = await supabase
    .from('task_time_sessions')
    .select('id, session_start, session_end, duration_minutes, session_type, designer_id, pause_reason')
    .eq('task_id', id)
    .order('session_start', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allSessions = sessions || [];

  // Aggregate totals
  const totalMinutes = allSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const designMinutes = allSessions
    .filter(s => s.session_type === 'design' || !s.session_type)
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const reworkMinutes = allSessions
    .filter(s => s.session_type === 'rework')
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  // Check for open (active) session
  const openSession = allSessions.find(s => !s.session_end);

  return NextResponse.json({
    data: {
      total_minutes: totalMinutes,
      design_minutes: designMinutes,
      rework_minutes: reworkMinutes,
      session_count: allSessions.length,
      has_active_session: !!openSession,
      active_session_start: openSession?.session_start || null,
      sessions: allSessions.map(s => ({
        id: s.id,
        session_start: s.session_start,
        session_end: s.session_end,
        duration_minutes: s.duration_minutes,
        session_type: s.session_type || 'design',
        is_active: !s.session_end,
        pause_reason: s.pause_reason,
      })),
    }
  });
}
