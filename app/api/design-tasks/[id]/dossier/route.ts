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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch dossier entries without FK join (avoids PostgREST FK hint ambiguity)
  const { data: entries, error } = await supabase
    .from('dossier_entries')
    .select('id, entry_type, data_json, actor_id, created_at')
    .eq('task_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch actor names separately
  const actorIds = Array.from(new Set((entries || []).map((e: any) => e.actor_id).filter(Boolean)));
  let actorMap: Record<string, any> = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', actorIds);
    (profiles || []).forEach((p: any) => { actorMap[p.id] = p; });
  }

  const enriched = (entries || []).map((e: any) => {
    const actorName = e.actor_id ? (actorMap[e.actor_id]?.full_name || null) : null;
    const performedByName = actorName || e.data_json?.performed_by_name || e.performed_by_name || 'Unknown';
    return {
      ...e,
      actor: e.actor_id ? actorMap[e.actor_id] || null : null,
      performed_by_name: performedByName,
    };
  });

  return NextResponse.json({ data: enriched });
}
