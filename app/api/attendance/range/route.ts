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

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'today'; // today | week | month

  const now = new Date();
  let startDate: string;
  let endDate = now.toISOString().split('T')[0];

  if (period === 'week') {
    // Start from Monday of the current week
    const day = now.getDay(); // 0=Sun, 1=Mon ...
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    startDate = monday.toISOString().split('T')[0];
  } else if (period === 'month') {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  } else {
    // today
    startDate = endDate;
  }

  // Fetch all designers
  const { data: designers, error: designersError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'designer')
    .eq('is_active', true)
    .not('full_name', 'ilike', 'Designer _');

  if (designersError) return NextResponse.json({ error: designersError.message }, { status: 500 });

  if (period === 'today') {
    // Single-day view (same as /today endpoint)
    const { data: attendance } = await supabase
      .from('designer_attendance')
      .select('*')
      .eq('date', startDate);

    const attByDesigner = (attendance || []).reduce((acc: any, a: any) => {
      acc[a.designer_id] = a;
      return acc;
    }, {});

    const result = (designers || []).map((d: any) => {
      const att = attByDesigner[d.id];
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

    return NextResponse.json({ data: result, period, startDate, endDate });
  } else {
    // Multi-day view — aggregate per designer
    const { data: attendance } = await supabase
      .from('designer_attendance')
      .select('designer_id, date, status, total_minutes_worked, first_login_time, last_logout_time')
      .gte('date', startDate)
      .lte('date', endDate);

    // Build per-designer aggregates
    const aggMap: Record<string, { days: number; present: number; total_minutes: number; dates: string[] }> = {};
    (designers || []).forEach((d: any) => {
      aggMap[d.id] = { days: 0, present: 0, total_minutes: 0, dates: [] };
    });

    (attendance || []).forEach((a: any) => {
      if (!aggMap[a.designer_id]) return;
      aggMap[a.designer_id].days++;
      aggMap[a.designer_id].dates.push(a.date);
      aggMap[a.designer_id].total_minutes += a.total_minutes_worked || 0;
      if (a.status !== 'absent') aggMap[a.designer_id].present++;
    });

    const result = (designers || []).map((d: any) => {
      const agg = aggMap[d.id];
      // For multi-day, we show aggregate summary. Status = present/absent/mixed
      const presentDays = agg.present;
      const totalDays = agg.days;
      return {
        id: d.id,
        full_name: d.full_name,
        email: d.email,
        status: presentDays === 0 ? 'absent' : presentDays === totalDays ? 'active' : 'idle',
        present_days: presentDays,
        total_days_in_range: totalDays,
        total_minutes_worked: agg.total_minutes,
        first_login_time: null,  // not applicable for range
        last_logout_time: null,
        last_heartbeat_time: null,
      };
    });

    return NextResponse.json({ data: result, period, startDate, endDate });
  }
}
