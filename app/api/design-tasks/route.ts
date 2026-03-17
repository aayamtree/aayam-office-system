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

// GET — list tasks (access controlled via RLS)
export async function GET(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const assignedTo = searchParams.get('assigned_to');

  let query = supabase
    .from('design_tasks')
    .select(`
      *,
      client:clients(id, name, company),
      product_type:product_types(id, name, category)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('current_status', status);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — create new task
export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'designer'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Only designers and admins can create tasks' }, { status: 403 });
  }

  const body = await request.json();
  const { client_id, brand_id, product_type_id, description, dimensions, deadline, priority, assigned_to, is_draft } = body;

  // Validate required fields
  if (!client_id || !product_type_id || !description) {
    return NextResponse.json({ error: 'client_id, product_type_id, and description are required' }, { status: 400 });
  }

  // Generate task_code
  const { data: codeData, error: codeError } = await supabase.rpc('generate_task_code');
  if (codeError) return NextResponse.json({ error: 'Failed to generate task code' }, { status: 500 });
  const taskCode = codeData as string;

  const { data, error } = await supabase
    .from('design_tasks')
    .insert({
      task_code: taskCode,
      // ── Compat fields from pre-existing design_tasks (old Design Studio) ──
      task_number: taskCode,        // old NOT NULL column
      title: (description || taskCode).substring(0, 100), // old NOT NULL column
      status: 'pending',            // old status column (different from current_status)
      estimated_hours: 0,           // old column default
      actual_hours: 0,              // old column default
      // ── New Designer Module columns ──
      client_id,
      brand_id,
      brand_name: body.brand_name || null,
      product_type_id,
      description,
      dimensions,
      deadline,
      priority: priority || 'normal',
      assigned_to: assigned_to || user.id,
      created_by: user.id,
      current_status: 'created',
      is_draft: is_draft || false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write dossier entry
  await supabase.from('dossier_entries').insert({
    task_id: data.id,
    entry_type: 'TASK_CREATED',
    actor_id: user.id,
    data_json: { task_code: taskCode, client_id, assigned_to: assigned_to || user.id },
  });

  return NextResponse.json({ data }, { status: 201 });
}
