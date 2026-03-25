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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // IST date — office is in India
  const nowUtc = new Date();
  const nowIST = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
  const todayIST = nowIST.toISOString().split('T')[0];
  const nowIso = nowUtc.toISOString();

  // Check if a record already exists for today
  const { data: existing } = await supabase
    .from('designer_attendance')
    .select('id, status, first_login_time, total_minutes_worked')
    .eq('designer_id', user.id)
    .eq('date', todayIST)
    .single();

  if (existing) {
    // ── RE-LOGIN (2nd, 3rd session of the day) ──────────────────────────────
    // IMPORTANT: Do NOT overwrite first_login_time — preserve the earliest login.
    // Only flip status back to 'active' so heartbeat resumes accumulating minutes.
    // total_minutes_worked is NOT reset — it carries over from previous sessions.
    const { error } = await supabase
      .from('designer_attendance')
      .update({
        status: 'active',
        last_heartbeat_time: nowIso,
        tap_out_method: null, // Allow "End My Day" button to work again
      })
      .eq('id', existing.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      action: 're-activated',
      session_note: 'Re-login: first_login_time and total_minutes preserved from earlier sessions',
      total_minutes_carried: existing.total_minutes_worked || 0,
    });
  }

  // ── FIRST LOGIN OF THE DAY ──────────────────────────────────────────────
  // Create a fresh record with first_login_time = now.
  const { data, error } = await supabase
    .from('designer_attendance')
    .insert({
      designer_id: user.id,
      date: todayIST,
      first_login_time: nowIso,
      last_heartbeat_time: nowIso,
      status: 'active',
      total_minutes_worked: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data, action: 'first_login' });
}
