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

// GET — single task (uses separate queries to avoid PostgREST FK ambiguity)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch core task first (no profile joins — avoids FK ambiguity)
  const { data: task, error } = await supabase
    .from('design_tasks')
    .select(`
      *,
      client:clients(id, name, company),
      product_type:product_types(id, name, category),
      task_status_history(id, from_status, to_status, changed_at, reason, rework_number, changed_by),
      task_time_sessions(id, session_start, session_end, duration_minutes, designer_id)
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Access control
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileData?.role !== 'admin') {
    const hasAccess = task.assigned_to === user.id || task.created_by === user.id;
    if (!hasAccess) {
      const { count } = await supabase
        .from('task_transfers')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', id)
        .eq('transferred_by', user.id);
      if (!count) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Fetch profile names separately to avoid FK ambiguity
  const profileIds = [task.assigned_to, task.created_by].filter(Boolean);
  let profileMap: Record<string, any> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds);
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
  }

  // Enrich task with profile data
  const enriched = {
    ...task,
    assigned_user: task.assigned_to ? profileMap[task.assigned_to] || null : null,
    created_user:  task.created_by  ? profileMap[task.created_by]  || null : null,
  };

  return NextResponse.json({ data: enriched });
}

// PATCH — update task fields (not status — use /status endpoint)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const allowedFields = ['description', 'dimensions', 'deadline', 'priority', 'product_type_id', 'is_draft'];
  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from('design_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
