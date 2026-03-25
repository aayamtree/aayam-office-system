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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const isDesigner = profile?.role === 'designer';

  // ── Read from jobs table (single source of truth) ──────────────────────────
  let query = supabase
    .from('jobs')
    .select('id, job_number, project_name, current_stage, designer_status, created_at, client_id, designer_id, brand_name')
    .not('current_stage', 'in', '("delivered","cancelled")')
    .order('created_at', { ascending: false });

  // Designers only see their own jobs
  if (isDesigner) {
    query = query.eq('designer_id', user.id);
  }

  const { data: jobs, error } = await query;

  if (error) {
    console.error('[dossier-list] jobs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobList = jobs || [];
  if (jobList.length === 0) return NextResponse.json({ data: [] });

  // ── Fetch client names ──────────────────────────────────────────────────────
  const clientIds = Array.from(new Set(jobList.map((j: any) => j.client_id).filter(Boolean)));
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

  // ── Fetch designer names ────────────────────────────────────────────────────
  const designerIds = Array.from(new Set(jobList.map((j: any) => j.designer_id).filter(Boolean)));
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

  // ── Fetch dossier entry counts linked to jobs ────────────────────────────────
  const jobIds = jobList.map((j: any) => j.id);
  const countMap: Record<string, number> = {};
  if (jobIds.length > 0) {
    const { data: entries } = await supabase
      .from('dossier_entries')
      .select('task_id')
      .in('task_id', jobIds);
    (entries || []).forEach((e: any) => {
      countMap[e.task_id] = (countMap[e.task_id] || 0) + 1;
    });
  }

  const enriched = jobList.map((j: any) => ({
    id: j.id,
    task_code: j.job_number || j.id.substring(0, 8).toUpperCase(),
    current_status: j.designer_status || j.current_stage || 'created',
    brand_name: j.brand_name || null,
    created_at: j.created_at,
    client_name: j.client_id ? (clientMap[j.client_id] || '—') : '—',
    designer_name: j.designer_id ? (profileMap[j.designer_id] || '—') : '—',
    dossier_count: countMap[j.id] || 0,
    project_name: j.project_name,
    current_stage: j.current_stage,
    designer_status: j.designer_status,
  }));

  return NextResponse.json({ data: enriched });
}
