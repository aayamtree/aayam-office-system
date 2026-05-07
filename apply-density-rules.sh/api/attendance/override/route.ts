import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Admin-only: Override attendance record
 * Allows admin to correct login time, logout time, and/or total minutes worked
 * for any designer on any date.
 */
export async function PATCH(request: NextRequest) {
  // Verify the caller is an authenticated admin
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only admin role can override attendance
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
  }

  // Use service role to allow admin to edit any record
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { record_id, first_login_time, last_logout_time, total_minutes_worked, override_reason } = body;

  if (!record_id) {
    return NextResponse.json({ error: 'record_id is required' }, { status: 400 });
  }

  const updates: Record<string, string | number | boolean> = {
    admin_override: true,
    override_reason: override_reason || 'Admin correction',
    override_at: new Date().toISOString(),
  };

  if (first_login_time !== undefined) updates.first_login_time = first_login_time;
  if (last_logout_time !== undefined) {
    updates.last_logout_time = last_logout_time;
    updates.status = 'logged_out';
  }
  if (total_minutes_worked !== undefined) updates.total_minutes_worked = total_minutes_worked;

  const { data, error } = await supabase
    .from('designer_attendance')
    .update(updates)
    .eq('id', record_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}
