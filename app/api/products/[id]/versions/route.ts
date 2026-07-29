// API Route: /api/products/[id]/versions — add a design version.
// DB triggers auto-assign version_no, roll the product forward
// (thumbnail/file/size), supersede older versions, and log activity.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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

const VERSION_FIELDS = [
  'file_url', 'file_name', 'file_hash', 'thumbnail_url',
  'size_w', 'size_h', 'size_d', 'size_unit', 'size_text',
  'size_check_status', 'size_check_note',
  'job_id', 'job_number', 'status', 'notes',
] as const;

// POST /api/products/:id/versions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const fields: Record<string, any> = {};
  for (const f of VERSION_FIELDS) {
    if (f in body) fields[f] = body[f] === '' ? null : body[f];
  }

  // Same file already on this product? Don't create a second identical
  // version — return the one that is already there.
  if (fields.file_hash) {
    const { data: dup } = await supabase
      .from('product_versions')
      .select('*')
      .eq('product_id', id)
      .eq('file_hash', fields.file_hash)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({
        version: dup,
        duplicate: true,
        message: `This exact file is already saved as version ${dup.version_no}.`,
      });
    }
  }

  const { data: version, error } = await supabase
    .from('product_versions')
    .insert({ ...fields, product_id: id, designer_id: user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Triggers run as service role (no auth.uid()) — stamp the actor on the
  // activity rows the trigger just wrote.
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  await supabase
    .from('product_activity')
    .update({ actor_id: user.id, actor_name: profile?.full_name || null })
    .eq('version_id', version.id)
    .is('actor_id', null);

  return NextResponse.json({ version });
}
