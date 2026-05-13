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

// GET /api/jobs/[id]/subtasks
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = makeClient();
  const { data, error } = await supabase
    .from('job_subtasks')
    .select(`
      id, title, status, due_date, sort_order, notes, created_at, updated_at,
      assigned_to,
      assignee:profiles!assigned_to(id, full_name, avatar_url, role)
    `)
    .eq('job_id', params.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/jobs/[id]/subtasks
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, assigned_to, status, due_date, notes, sort_order } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  // Get max sort_order for this job
  const { data: existing } = await supabase
    .from('job_subtasks')
    .select('sort_order')
    .eq('job_id', params.id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('job_subtasks')
    .insert({
      job_id:      params.id,
      title:       title.trim(),
      assigned_to: assigned_to || null,
      status:      status || 'pending',
      due_date:    due_date || null,
      notes:       notes || null,
      sort_order:  sort_order ?? nextOrder,
      created_by:  user.id,
    })
    .select(`
      id, title, status, due_date, sort_order, notes, created_at,
      assigned_to,
      assignee:profiles!assigned_to(id, full_name, avatar_url, role)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
