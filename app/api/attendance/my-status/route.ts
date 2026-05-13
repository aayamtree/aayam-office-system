import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Returns the current user's own attendance record for today */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // IST date
  const nowIST = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
  const todayIST = nowIST.toISOString().split('T')[0];

  const { data } = await supabase
    .from('designer_attendance')
    .select('id, status, first_login_time, last_logout_time, total_minutes_worked, tap_out_method, admin_override')
    .eq('designer_id', user.id)
    .eq('date', todayIST)
    .single();

  return NextResponse.json({
    data: data || { status: 'absent', first_login_time: null, last_logout_time: null, total_minutes_worked: 0 }
  });
}
