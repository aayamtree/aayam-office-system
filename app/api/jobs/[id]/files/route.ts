import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/** Shared helper — service-role client for job file operations.
 *  Privileged writes must bypass the browser anon/authenticated client,
 *  which silently fails (0 rows) when the Supabase session lapses. */
async function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
  const { data: { user } } = await auth.auth.getUser();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;
  return { user, supabase: service };
}

// POST /api/jobs/:id/files — append one file to the job's files array
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const file = body.file;
  if (!file || !file.url) return NextResponse.json({ error: 'file (with url) is required' }, { status: 400 });

  // Read current files, append, save (avoids clobbering concurrent uploads)
  const { data: job, error: readErr } = await supabase
    .from('jobs')
    .select('files')
    .eq('id', id)
    .single();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const existing = Array.isArray(job?.files) ? job.files : [];
  const updatedFiles = [...existing, file];

  const { data, error } = await supabase
    .from('jobs')
    .update({ files: updatedFiles })
    .eq('id', id)
    .select('files')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data?.files || updatedFiles });
}

// DELETE /api/jobs/:id/files — remove one file (body: { index } or { url })
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data: job, error: readErr } = await supabase
    .from('jobs')
    .select('files')
    .eq('id', id)
    .single();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const existing: any[] = Array.isArray(job?.files) ? job.files : [];
  let updatedFiles: any[];
  if (typeof body.index === 'number') {
    updatedFiles = existing.filter((_, i) => i !== body.index);
  } else if (body.url) {
    updatedFiles = existing.filter((f) => f?.url !== body.url);
  } else {
    return NextResponse.json({ error: 'index or url is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({ files: updatedFiles })
    .eq('id', id)
    .select('files')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data?.files || updatedFiles });
}
