import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * /api/telegram/groups — manage Telegram department groups (admin only).
 *   GET   → list all groups the bot knows about
 *   PATCH → { id, department?, alerts_enabled?, digest_enabled? }
 *
 * Writes go through this service-role route (NOT direct browser writes) per
 * the project rule: browser writes silently fail as `anon` when the Supabase
 * session lapses.
 */

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) };
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: profile } = await service
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admins only' }, { status: 403 }) };
  }
  return { service };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.service!
    .from('telegram_groups')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data || [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const id: string | undefined = body?.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('department' in body) {
    const dept = body.department;
    const valid = ['design', 'print', 'dispatch', 'admin', 'cmyk', null];
    if (!valid.includes(dept)) {
      return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
    }
    updates.department = dept;
  }
  if (typeof body.alerts_enabled === 'boolean') updates.alerts_enabled = body.alerts_enabled;
  if (typeof body.digest_enabled === 'boolean') updates.digest_enabled = body.digest_enabled;

  const { data, error } = await auth.service!
    .from('telegram_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}
