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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Use IST date — records are stored with IST date in login/logout/heartbeat routes
  const nowIST = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
  const today = nowIST.toISOString().split('T')[0];

  // Two separate queries — avoids PostgREST join direction issues
  const [designersResult, attendanceResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('role', 'designer').eq('is_active', true).not('full_name', 'ilike', 'Designer _'),
    supabase.from('designer_attendance').select('*').eq('date', today),
  ]);

  if (designersResult.error) return NextResponse.json({ error: designersResult.error.message }, { status: 500 });

  const attendanceByDesigner = (attendanceResult.data || []).reduce((acc: any, a: any) => {
    acc[a.designer_id] = a;
    return acc;
  }, {});

  const result = (designersResult.data || []).map((d: any) => {
    const att = attendanceByDesigner[d.id];
    return {
      id: d.id,
      full_name: d.full_name,
      email: d.email,
      status: att?.status || 'absent',
      first_login_time: att?.first_login_time || null,
      last_logout_time: att?.last_logout_time || null,
      last_heartbeat_time: att?.last_heartbeat_time || null,
      total_minutes_worked: att?.total_minutes_worked || 0,
    };
  });

  return NextResponse.json({ data: result });
}
