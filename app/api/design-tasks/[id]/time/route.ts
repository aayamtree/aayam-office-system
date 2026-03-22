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

// GET — time summary for a task
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sessions, error } = await supabase
    .from('task_time_sessions')
    .select('*')
    .eq('task_id', id)
    .order('session_start', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate total minutes from completed sessions
  const completedMinutes = (sessions || [])
    .filter(s => s.session_end && s.duration_minutes)
    .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  // Check for an open session (currently LIVE)
  const openSession = (sessions || []).find(s => !s.session_end);
  let liveMinutes = 0;
  if (openSession) {
    const start = new Date(openSession.session_start).getTime();
    liveMinutes = Math.round((Date.now() - start) / 60000);
  }

  const totalMinutes = completedMinutes + liveMinutes;

  return NextResponse.json({
    data: {
      total_minutes: totalMinutes,
      completed_minutes: completedMinutes,
      live_minutes: liveMinutes,
      session_count: (sessions || []).length,
      open_session: openSession || null,
      sessions: sessions || [],
    }
  });
}
