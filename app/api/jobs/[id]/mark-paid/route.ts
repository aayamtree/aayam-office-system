import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * POST /api/jobs/[id]/mark-paid
 *
 * Closes the finance side of a delivered DESIGN job. Used from the
 * "Awaiting Payment" list: a design job whose file was sent to the client
 * (current_stage = 'file_sent_client') stays there until payment lands.
 *
 * Effect:
 *   - jobs.payment_status = 'paid'
 *   - jobs.total_amount / amount_received set to the collected amount (if provided)
 *   - logged to job_stage_history for audit
 *
 * Access: admin or finance only.
 *
 * Body (optional): { amount?: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await authClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const callerRole = callerProfile?.role || 'unknown';
  if (!['admin', 'finance'].includes(callerRole)) {
    return NextResponse.json({ error: 'Only an admin or finance user can mark a job paid.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rawAmount = body?.amount;
  const amount = (rawAmount === undefined || rawAmount === null || rawAmount === '')
    ? null
    : Number(rawAmount);
  if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
    return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
  }

  const db = createServerSupabase();

  const { data: job, error: fetchError } = await db
    .from('jobs')
    .select('id, job_number, current_stage, payment_status, total_amount')
    .eq('id', id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  if (job.payment_status === 'paid') {
    return NextResponse.json({ ok: true, already: true, payment_status: 'paid' });
  }

  const update: Record<string, unknown> = { payment_status: 'paid' };
  if (amount !== null) {
    update.total_amount = amount;
    update.amount_received = amount;
  } else if (job.total_amount && Number(job.total_amount) > 0) {
    // Amount already on the job — treat it as fully received.
    update.amount_received = job.total_amount;
  }

  const { error: updateError } = await db.from('jobs').update(update).eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const paidAmt = amount !== null ? amount : (job.total_amount || 0);
  await db.from('job_stage_history').insert({
    job_id: id,
    from_stage: job.current_stage,
    to_stage: job.current_stage,
    notes: `💰 Payment received & closed${paidAmt ? ` (₹${paidAmt})` : ''}. By: ${callerProfile?.full_name || user.email} (${callerRole})`,
    changed_by: user.id,
    changed_by_name: callerProfile?.full_name || user.email,
    changed_by_role: callerRole,
  }).then(({ error }) => { if (error) console.error('[mark-paid] log failed:', error.message); });

  return NextResponse.json({ ok: true, payment_status: 'paid' });
}
