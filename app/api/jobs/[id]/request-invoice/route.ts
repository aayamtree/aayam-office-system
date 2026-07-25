import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// POST /api/jobs/[id]/request-invoice
// Dispatch asks accounts to raise the invoice. Runs server-side with the
// caller's cookie session (so it never silently fails as anon), persists the
// request on the job so the "Requested" state survives a reload, and is
// idempotent — re-pressing within the cooldown does NOT spam a new notification.
const COOLDOWN_MINUTES = 180; // 3h

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, job_number, project_name, client_id, invoice_requested_at, clients(name, company)')
    .eq('id', id)
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Idempotency / anti-spam: if already requested within the cooldown, succeed
  // without inserting another notification.
  const now = Date.now();
  const last = job.invoice_requested_at ? new Date(job.invoice_requested_at).getTime() : 0;
  if (last && now - last < COOLDOWN_MINUTES * 60 * 1000) {
    return NextResponse.json({ success: true, alreadyRequested: true, requested_at: job.invoice_requested_at });
  }

  const requestedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('jobs')
    .update({ invoice_requested_at: requestedAt, invoice_requested_by: user.id })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const client = (job as any).clients;
  const clientName = client?.company || client?.name || 'N/A';
  const { error: notifyErr } = await supabase.from('broadcast_notifications').insert({
    message: `🔔 Dispatch requesting invoice for ${job.job_number}\nClient: ${clientName}\nProject: ${job.project_name || ''}`,
    target_audience: 'admin',
    priority: 'urgent',
    created_by: user.id,
    link: `/admin/jobs/${id}`,
  });
  // The request itself is recorded even if the notification insert fails; report
  // partial success honestly so the UI doesn't claim a delivery that didn't happen.
  if (notifyErr) {
    return NextResponse.json({ success: true, notified: false, requested_at: requestedAt, warning: 'Saved, but notification could not be sent.' });
  }

  return NextResponse.json({ success: true, notified: true, requested_at: requestedAt });
}
