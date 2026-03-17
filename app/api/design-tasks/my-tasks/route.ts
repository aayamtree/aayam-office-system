import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch tasks assigned to the current user — flat fields only, no FK joins
  const { data: tasks, error } = await supabase
    .from('design_tasks')
    .select(`
      id,
      task_code,
      task_number,
      title,
      current_status,
      priority,
      deadline,
      created_at,
      updated_at,
      client_id,
      assigned_to,
      product_type_id,
      description,
      drive_link
    `)
    .eq('assigned_to', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('my-tasks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: tasks || [] });
}
