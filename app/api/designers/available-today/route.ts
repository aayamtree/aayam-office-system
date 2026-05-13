import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];
  const IDLE_THRESHOLD_MINUTES = 15;
  const OFFLINE_THRESHOLD_MINUTES = 30;

  // Fetch designers and attendance in two separate queries (avoids PostgREST join direction issues)
  const [designersResult, attendanceResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'designer')
      .eq('is_active', true)
      .not('full_name', 'ilike', 'Designer _'),  // exclude placeholder accounts (Designer 5, 6, etc.)
    supabase
      .from('designer_attendance')
      .select('designer_id, date, status, first_login_time, last_heartbeat_time, total_minutes_worked')
      .eq('date', today),
  ]);

  if (designersResult.error) {
    return NextResponse.json({ error: designersResult.error.message }, { status: 500 });
  }

  const designers = designersResult.data || [];
  const attendanceByDesigner = (attendanceResult.data || []).reduce((acc: any, a: any) => {
    acc[a.designer_id] = a;
    return acc;
  }, {});

  const now = new Date();

  const result = designers.map((d: any) => {
    const att = attendanceByDesigner[d.id];
    let status: string = 'absent';
    let lastActive: string | null = null;

    if (att) {
      if (att.status === 'logged_out') {
        status = 'logged_out';
      } else if (att.last_heartbeat_time) {
        const lastHB = new Date(att.last_heartbeat_time);
        const diffMinutes = (now.getTime() - lastHB.getTime()) / 60000;
        lastActive = att.last_heartbeat_time;

        if (diffMinutes >= OFFLINE_THRESHOLD_MINUTES) {
          status = 'logged_out';
        } else if (diffMinutes >= IDLE_THRESHOLD_MINUTES) {
          status = 'idle';
        } else {
          status = 'active';
        }
      } else {
        status = att.status;
      }
    }

    return {
      id: d.id,
      name: d.full_name,
      email: d.email,
      status,
      last_active: lastActive,
      first_login_time: att?.first_login_time || null,
      total_minutes_worked: att?.total_minutes_worked || 0,
    };
  });

  return NextResponse.json({ data: result });
}
