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

  // Upsert — if record exists for today, just update status to active
  const { data, error } = await supabase
    .from('designer_attendance')
    .upsert(
      {
        designer_id: user.id,
        date: today,
        first_login_time: new Date().toISOString(),
        last_heartbeat_time: new Date().toISOString(),
        status: 'active',
      },
      {
        onConflict: 'designer_id,date',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  // If record already existed (conflict), just update status to active
  if (error && error.code === '23505') {
    await supabase
      .from('designer_attendance')
      .update({ status: 'active', last_heartbeat_time: new Date().toISOString() })
      .eq('designer_id', user.id)
      .eq('date', today);
    return NextResponse.json({ success: true, action: 're-activated' });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data, action: 'logged_in' });
}
