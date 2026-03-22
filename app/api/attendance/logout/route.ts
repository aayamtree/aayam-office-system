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

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Get existing record to calculate minutes worked
  const { data: existing } = await supabase
    .from('designer_attendance')
    .select('first_login_time, total_minutes_worked')
    .eq('designer_id', user.id)
    .eq('date', today)
    .single();

  let totalMinutes = existing?.total_minutes_worked || 0;
  if (existing?.first_login_time) {
    const loginTime = new Date(existing.first_login_time).getTime();
    const nowMs = new Date(now).getTime();
    totalMinutes = Math.round((nowMs - loginTime) / 60000);
  }

  const { error } = await supabase
    .from('designer_attendance')
    .update({
      last_logout_time: now,
      status: 'logged_out',
      total_minutes_worked: totalMinutes,
    })
    .eq('designer_id', user.id)
    .eq('date', today);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, total_minutes_worked: totalMinutes });
}
