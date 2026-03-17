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

  // Fetch user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const isDesigner = profile?.role === 'designer';

  // Fetch design tasks — role-filtered
  let query = supabase
    .from('design_tasks')
    .select('id, task_code, current_status, created_at, client_id, assigned_to, created_by')
    .order('created_at', { ascending: false });

  if (isDesigner) {
    // Designers only see their own tasks
    query = query.eq('assigned_to', user.id);
  }

  const { data: tasks, error } = await query;

  if (error) {
    console.error('dossier-list tasks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const taskList = tasks || [];
  if (taskList.length === 0) return NextResponse.json({ data: [] });

  // Fetch dossier counts per task — also fetch brand_name from data_json if stored there
  const taskIds = taskList.map((t: any) => t.id);
  const { data: dossierRows } = await supabase
    .from('dossier_entries')
    .select('task_id, data_json, entry_type')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true });

  // Build count map and grab brand_name from TASK_CREATED dossier data_json
  const countMap: Record<string, number> = {};
  const brandMap: Record<string, string> = {};
  (dossierRows || []).forEach((d: any) => {
    countMap[d.task_id] = (countMap[d.task_id] || 0) + 1;
    if (d.entry_type === 'TASK_CREATED' && d.data_json?.brand_name && !brandMap[d.task_id]) {
      brandMap[d.task_id] = d.data_json.brand_name;
    }
  });

  // Fetch client names
  const clientIds = Array.from(new Set(taskList.map((t: any) => t.client_id).filter(Boolean)));
  const clientMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, company')
      .in('id', clientIds as string[]);
    (clients || []).forEach((c: any) => {
      clientMap[c.id] = c.company || c.name || '—';
    });
  }

  // Fetch designer names
  const designerIds = Array.from(new Set(
    taskList.flatMap((t: any) => [t.assigned_to, t.created_by].filter(Boolean))
  ));
  const profileMap: Record<string, string> = {};
  if (designerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', designerIds as string[]);
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p.full_name || '—';
    });
  }

  const enriched = taskList.map((t: any) => ({
    id: t.id,
    task_code: t.task_code || '—',
    current_status: t.current_status || 'created',
    brand_name: brandMap[t.id] || null,
    created_at: t.created_at,
    client_name: t.client_id ? (clientMap[t.client_id] || '—') : '—',
    designer_name: profileMap[t.assigned_to] || profileMap[t.created_by] || '—',
    dossier_count: countMap[t.id] || 0,
  }));

  return NextResponse.json({ data: enriched });
}
