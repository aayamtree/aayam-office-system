import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * End My Day — called when designer clicks "End My Day" button.
 * Records the exact tap-out time and locks the attendance record.
 * No further heartbeats will add minutes once status = 'logged_out'.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // IST date
  const nowUtc = new Date();
  const nowIST = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
  const todayIST = nowIST.toISOString().split('T')[0];
  const nowIso = nowUtc.toISOString();

  const { data: existing } = await supabase
    .from('designer_attendance')
    .select('id, first_login_time, total_minutes_worked, status')
    .eq('designer_id', user.id)
    .eq('date', todayIST)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'No attendance record found for today' }, { status: 404 });
  }

  if (existing.status === 'logged_out') {
    return NextResponse.json({ ok: true, already_logged_out: true, total_minutes_worked: existing.total_minutes_worked });
  }

  // Use heartbeat-counted minutes (already accumulated) — do NOT recalculate from elapsed time
  // This ensures hours reflect actual active browser time, not raw login→tap-out gap
  const finalMinutes = existing.total_minutes_worked || 0;

  const { error } = await supabase
    .from('designer_attendance')
    .update({
      last_logout_time: nowIso,
      status: 'logged_out',
      total_minutes_worked: finalMinutes,
      // Mark that this was a deliberate tap-out (not EOD cron or beacon)
      tap_out_method: 'manual',
    })
    .eq('id', existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    logout_time: nowIso,
    total_minutes_worked: finalMinutes,
    hours: Math.round(finalMinutes / 6) / 10,
  });
}
