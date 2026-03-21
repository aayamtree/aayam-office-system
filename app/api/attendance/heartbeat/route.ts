import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Heartbeat endpoint — called every 5 minutes by active designers.
 * IMPORTANT: Each heartbeat now increments total_minutes_worked by +5.
 * This means hours are counted by ACTUAL ACTIVE BROWSER TIME, not
 * login→logout elapsed time. If a designer leaves but PC stays on,
 * heartbeats still fire — so "End My Day" tap-out is the companion fix.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, skipped: true }); // non-blocking

  // IST date
  const nowUtc = new Date();
  const nowIST = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
  const todayIST = nowIST.toISOString().split('T')[0];
  const nowIso = nowUtc.toISOString();

  // Get existing record
  const { data: existing } = await supabase
    .from('designer_attendance')
    .select('id, total_minutes_worked, status')
    .eq('designer_id', user.id)
    .eq('date', todayIST)
    .single();

  // Only count heartbeat if currently active (not already tapped out)
  if (!existing || existing.status !== 'active') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Increment active minutes by 5 per heartbeat (heartbeat fires every 5 min)
  const newMinutes = (existing.total_minutes_worked || 0) + 5;

  const { error } = await supabase
    .from('designer_attendance')
    .update({
      last_heartbeat_time: nowIso,
      total_minutes_worked: newMinutes,
    })
    .eq('id', existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, total_minutes_worked: newMinutes });
}
