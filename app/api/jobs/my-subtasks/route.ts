import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/jobs/my-subtasks
 * Returns all job subtasks assigned to the currently logged-in user,
 * enriched with job title and client name.
 */
export async function GET(_req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => (cookieStore as any).set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('job_subtasks')
    .select(`
      id, title, status, due_date, sort_order, notes,
      job_id,
      job:jobs!job_id(
        id, job_number, project_name, client_deadline, priority,
        client:clients!client_id(name, company)
      )
    `)
    .eq('assigned_to', user.id)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}
