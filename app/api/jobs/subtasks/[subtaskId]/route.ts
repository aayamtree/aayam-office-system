import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function makeClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => (cookieStore as any).set(name, value, options)) } }
  );
}

// PATCH /api/jobs/subtasks/[subtaskId]
export async function PATCH(req: NextRequest, { params }: { params: { subtaskId: string } }) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = ['title', 'status', 'assigned_to', 'due_date', 'notes', 'sort_order'];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from('job_subtasks')
    .update(updates)
    .eq('id', params.subtaskId)
    .select(`
      id, title, status, due_date, sort_order, notes, updated_at,
      assigned_to,
      assignee:profiles!assigned_to(id, full_name, avatar_url, role)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/jobs/subtasks/[subtaskId]
export async function DELETE(_req: NextRequest, { params }: { params: { subtaskId: string } }) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('job_subtasks')
    .delete()
    .eq('id', params.subtaskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
