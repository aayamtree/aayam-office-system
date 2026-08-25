import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServiceAccountToken } from '@/lib/google-service-account';
import { deleteFromDrive } from '@/lib/google-drive-upload';

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

/** Only these JSONB array columns may be written through this route. */
const ALLOWED_FIELDS = ['files', 'print_files'] as const;
type FileField = (typeof ALLOWED_FIELDS)[number];

function resolveField(raw: unknown): FileField {
  return ALLOWED_FIELDS.includes(raw as FileField) ? (raw as FileField) : 'files';
}

// POST /api/jobs/:id/files — append one file to the job's files (or print_files) array
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const field = resolveField(body.field);
  const file = body.file;
  if (!file || !file.url) return NextResponse.json({ error: 'file (with url) is required' }, { status: 400 });

  // Read current array, append, save (avoids clobbering concurrent uploads)
  const { data: job, error: readErr } = await supabase
    .from('jobs')
    .select(field)
    .eq('id', id)
    .single();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const existing = Array.isArray((job as any)?.[field]) ? (job as any)[field] : [];
  const updatedFiles = [...existing, file];

  const { data, error } = await supabase
    .from('jobs')
    .update({ [field]: updatedFiles })
    .eq('id', id)
    .select(field)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: (data as any)?.[field] || updatedFiles });
}

// DELETE /api/jobs/:id/files — remove one file (body: { index } or { url }, optional field)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const field = resolveField(body.field);

  const { data: job, error: readErr } = await supabase
    .from('jobs')
    .select(field)
    .eq('id', id)
    .single();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const existing: any[] = Array.isArray((job as any)?.[field]) ? (job as any)[field] : [];
  let updatedFiles: any[];
  let removed: any = null;
  // Both branches remove exactly ONE entry, and a request that matches nothing
  // is an error rather than a silent no-op that answers 200 — the caller shows
  // the person "file removed" off the back of that answer.
  let at = -1;
  if (typeof body.index === 'number') {
    at = body.index;
  } else if (body.url) {
    at = existing.findIndex((f) => f?.url === body.url);
  } else {
    return NextResponse.json({ error: 'index or url is required' }, { status: 400 });
  }
  if (at < 0 || at >= existing.length) {
    return NextResponse.json({ error: 'That file is no longer on this job — it may already have been removed.' }, { status: 404 });
  }
  removed = existing[at] ?? null;
  updatedFiles = existing.filter((_, i) => i !== at);

  const { data, error } = await supabase
    .from('jobs')
    .update({ [field]: updatedFiles })
    .eq('id', id)
    .select(field)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also remove the underlying file from the Shared Drive (best-effort: never
  // block the app-side removal if Drive is briefly unavailable).
  if (removed?.fileId) {
    try {
      const sa = await getServiceAccountToken();
      if (sa.success && sa.accessToken) {
        await deleteFromDrive(sa.accessToken, removed.fileId);
      }
    } catch { /* app record already removed; ignore Drive cleanup failure */ }
  }

  return NextResponse.json({ files: (data as any)?.[field] || updatedFiles });
}
