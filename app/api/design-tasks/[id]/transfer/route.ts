import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin only
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { transferred_to, reason } = body;

  if (!transferred_to) return NextResponse.json({ error: 'transferred_to is required' }, { status: 400 });

  // Get current task
  const { data: task } = await supabase.from('design_tasks').select('*').eq('id', id).single();
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const prevOwner = task.assigned_to;

  // Update task owner
  await supabase.from('design_tasks').update({ assigned_to: transferred_to }).eq('id', id);

  // Log the transfer
  await supabase.from('task_transfers').insert({
    task_id: id,
    transferred_from: prevOwner,
    transferred_to,
    transferred_by: user.id,
    reason: reason || null,
  });

  // Write dossier entry
  const { data: fromUser } = await supabase.from('profiles').select('full_name').eq('id', prevOwner).single();
  const { data: toUser } = await supabase.from('profiles').select('full_name').eq('id', transferred_to).single();

  await supabase.from('dossier_entries').insert({
    task_id: id,
    entry_type: 'TASK_TRANSFERRED',
    actor_id: user.id,
    data_json: {
      from_user_id: prevOwner,
      from_user_name: fromUser?.full_name || 'Unknown',
      to_user_id: transferred_to,
      to_user_name: toUser?.full_name || 'Unknown',
      reason: reason || null,
      timestamp: new Date().toISOString(),
    },
  });

  const { data: updated } = await supabase.from('design_tasks').select('*').eq('id', id).single();
  return NextResponse.json({ data: updated });
}
