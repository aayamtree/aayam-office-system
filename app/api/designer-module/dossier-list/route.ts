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

  // Fetch all design tasks
  const { data: tasks, error } = await supabase
    .from('design_tasks')
    .select('id, task_code, current_status, brand_name, created_at, client_id, assigned_to, created_by')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const taskList = tasks || [];
  if (taskList.length === 0) return NextResponse.json({ data: [] });

  // Fetch dossier counts per task
  const taskIds = taskList.map(t => t.id);
  const { data: dossierCounts } = await supabase
    .from('dossier_entries')
    .select('task_id')
    .in('task_id', taskIds);

  const countMap: Record<string, number> = {};
  (dossierCounts || []).forEach((d: any) => {
    countMap[d.task_id] = (countMap[d.task_id] || 0) + 1;
  });

  // Fetch client names
  const clientIds = Array.from(new Set(taskList.map(t => t.client_id).filter(Boolean)));
  let clientMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, company')
      .in('id', clientIds);
    (clients || []).forEach((c: any) => {
      clientMap[c.id] = c.company || c.name;
    });
  }

  // Fetch designer names
  const designerIds = Array.from(new Set(
    taskList.flatMap(t => [t.assigned_to, t.created_by].filter(Boolean))
  ));
  let profileMap: Record<string, string> = {};
  if (designerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', designerIds);
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p.full_name || 'Unknown';
    });
  }

  const enriched = taskList.map(t => ({
    id: t.id,
    task_code: t.task_code,
    current_status: t.current_status,
    brand_name: t.brand_name || null,
    created_at: t.created_at,
    client_name: clientMap[t.client_id] || '—',
    designer_name: profileMap[t.assigned_to] || profileMap[t.created_by] || '—',
    dossier_count: countMap[t.id] || 0,
  }));

  return NextResponse.json({ data: enriched });
}
