import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeJobType } from '@/lib/job-workflow';
import { hasInvoiceAttached } from '@/lib/invoice-status';

// POST /api/jobs/[id]/invoice-details
// Save invoice reference / e-way bill and notify dispatch. Runs server-side
// with the caller's cookie session so the write & notification actually happen
// (the old browser-side write could silently fail as anon). Dispatch is notified
// when an invoice is attached by ANY means (reference typed OR an Invoice PDF
// uploaded), not only when a reference number is present.
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

  const body = await request.json().catch(() => ({}));
  const invoiceRef: string | null = (body.invoice_reference || '').trim() || null;
  const ewayNo: string | null = (body.eway_bill_number || '').trim() || null;

  const { error: updErr } = await supabase
    .from('jobs')
    .update({ invoice_reference: invoiceRef, eway_bill_number: ewayNo })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Re-read the job (with files) to decide whether to notify dispatch.
  const { data: job } = await supabase
    .from('jobs')
    .select('id, job_number, job_type, files, invoice_reference')
    .eq('id', id)
    .maybeSingle();

  const invoiceAttached = hasInvoiceAttached(job as any);
  const typeKey = normalizeJobType(job?.job_type);
  const isPrint = typeKey === 'print_only' || typeKey === 'design_print';

  let notified = false;
  if (invoiceAttached && isPrint) {
    const { error: notifyErr } = await supabase.from('broadcast_notifications').insert({
      message: `✅ Invoice ready for ${job?.job_number}\n${invoiceRef ? `Invoice: ${invoiceRef}` : 'Invoice document uploaded'}${ewayNo ? `\nE-Way Bill: ${ewayNo}` : ''}\nJob is ready for dispatch!`,
      target_audience: 'dispatch',
      priority: 'normal',
      created_by: user.id,
    });
    notified = !notifyErr;
  }

  return NextResponse.json({ success: true, invoiceAttached, notified });
}
