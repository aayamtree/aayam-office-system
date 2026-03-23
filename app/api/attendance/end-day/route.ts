import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Helper: calculate actual work minutes between login and logout,
 * clipped to the 8 AM – 9 PM IST window for a given IST date.
 *   8 AM IST = 02:30 UTC
 *   9 PM IST = 15:30 UTC
 */
function calcWorkMinutes(firstLoginIso: string, logoutIso: string, todayIST: string): number {
  const loginMs  = new Date(firstLoginIso).getTime();
  const logoutMs = new Date(logoutIso).getTime();
  const workStartMs = new Date(`${todayIST}T02:30:00Z`).getTime(); // 8 AM IST
  const workEndMs   = new Date(`${todayIST}T15:30:00Z`).getTime(); // 9 PM IST
  const effectiveStart = Math.max(loginMs, workStartMs);
  const effectiveEnd   = Math.min(logoutMs, workEndMs);
  return Math.max(0, Math.round((effectiveEnd - effectiveStart) / 60000));
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const nowUtc   = new Date();
  const nowIST   = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
  const todayIST = nowIST.toISOString().split('T')[0];
  const nowIso   = nowUtc.toISOString();

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

  // Time-based: login → logout clipped to 8 AM – 9 PM IST
  const finalMinutes = existing.first_login_time
    ? calcWorkMinutes(existing.first_login_time, nowIso, todayIST)
    : 0;

  const { error } = await supabase
    .from('designer_attendance')
    .update({
      last_logout_time: nowIso,
      status: 'logged_out',
      total_minutes_worked: finalMinutes,
      tap_out_method: 'manual',
    })
    .eq('id', existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, logout_time: nowIso, total_minutes_worked: finalMinutes, hours: Math.round(finalMinutes / 6) / 10 });
}
