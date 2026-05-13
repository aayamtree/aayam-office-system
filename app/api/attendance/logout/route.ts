import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // sendBeacon fires even after sign-out clears cookies.
  // Return 200 so the browser doesn't retry — just a no-op if no session.
  if (!user) return NextResponse.json({ ok: true, skipped: true });

  // Use IST offset (UTC+5:30) — office is based in India
  const nowUtc = new Date();
  const nowIST = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
  const todayIST = nowIST.toISOString().split('T')[0]; // YYYY-MM-DD in IST
  const nowIso = nowUtc.toISOString();

  // Get existing record to calculate minutes worked
  const { data: existing } = await supabase
    .from('designer_attendance')
    .select('first_login_time, total_minutes_worked, status')
    .eq('designer_id', user.id)
    .eq('date', todayIST)
    .single();

  // If no record today or already logged out, skip — no double-recording
  if (!existing || existing.status === 'logged_out') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let totalMinutes = existing?.total_minutes_worked || 0;
  if (existing?.first_login_time) {
    const loginTime = new Date(existing.first_login_time).getTime();
    const nowMs = nowUtc.getTime();
    totalMinutes = Math.max(totalMinutes, Math.round((nowMs - loginTime) / 60000));
  }

  await supabase
    .from('designer_attendance')
    .update({
      last_logout_time: nowIso,
      status: 'logged_out',
      total_minutes_worked: totalMinutes,
    })
    .eq('designer_id', user.id)
    .eq('date', todayIST);

  return NextResponse.json({ ok: true, total_minutes_worked: totalMinutes });
}
