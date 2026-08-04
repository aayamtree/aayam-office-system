'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { Package, CheckCircle, Truck, Clock, AlertTriangle, ClipboardCheck, Loader2, X, Camera, MapPin, Building2, Search, FileText, ShieldCheck } from 'lucide-react';
import { useJobs, useDispatches } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Job, Dispatch } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { getStageName, getStageColor } from '@/lib/job-workflow';
import { hasInvoiceAttached } from '@/lib/invoice-status';
import { DISPATCH_MODE_FIELDS, type DispatchMode } from '@/types/database';
import ActionButton from '@/components/ActionButton';
import LoadError from '@/components/LoadError';
import DispatchPaperwork from '@/components/dispatch/DispatchPaperwork';

// ─── Transporter vendor ──────────────────────────────────────
interface TransporterVendor {
  id: string;
  name: string;
  company?: string;
}

export default function DispatchPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, error: jobsError, updateJobStage, refetch: refetchJobs } = useJobs({
    // Explicit select so the dispatch card can see the invoice signals.
    // The accountant may attach an invoice two ways: by saving invoice_reference
    // on the job, or by creating a row in the invoices table (job_id FK).
    // We fetch both so "Invoice ready" reflects reality either way.
    select: 'id, job_number, project_name, client_id, priority, current_stage, job_type, product_category, parent_job_id, client_deadline, total_amount, amount_received, payment_status, quantity, packing_info, invoice_reference, eway_bill_number, invoice_requested_at, files, client:clients(id, name, company), invoices:invoices(id)',
    filter: [{ column: 'current_stage', value: ['material_received', 'quality_check', 'ready'], op: 'in' }],
    orderBy: { column: 'client_deadline', ascending: true }
  });
  const { dispatches, loading: dispatchesLoading, error: dispatchesError, createDispatch, refetch: refetchDispatches } = useDispatches();

  // Jobs are not on the realtime channel (perf), so an already-open dispatch
  // screen won't see the accountant's invoice until it refetches. Refresh when
  // the dispatcher returns to the tab / focuses the window.
  useEffect(() => {
    const onFocus = () => { refetchJobs?.(); refetchDispatches?.(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refetchJobs, refetchDispatches]);

  // Auth-race guard: on a cold load the jobs query can fire before the Supabase
  // cookie session is hydrated, so it runs as `anon` and RLS returns 0 rows —
  // leaving the dispatcher staring at an empty board until a manual refresh.
  // (profile alone isn't reliable here: a cached fallback profile can appear
  // before the real session.) Refetch when Supabase confirms a live session.
  useEffect(() => {
    let done = false;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !done) { done = true; refetchJobs?.(); refetchDispatches?.(); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        refetchJobs?.();
        refetchDispatches?.();
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchJobs, refetchDispatches]);

  // ?job=<id> — arrived from ⌘K's "where does this appear" list. The job sits in
  // one of three columns here depending on its stage, and we don't know which,
  // so ring whichever card matches and scroll it into view.
  const [focusJobId, setFocusJobId] = useState<string | null>(null);
  const focusCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFocusJobId(new URLSearchParams(window.location.search).get('job'));
  }, []);
  useEffect(() => {
    if (!focusJobId || jobsLoading) return;
    focusCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusJobId, jobsLoading, jobs]);

  // Transporters
  const [transporters, setTransporters] = useState<TransporterVendor[]>([]);

  // Dispatch modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Invoice request tracking (prevents spam)
  const [invoiceRequested, setInvoiceRequested] = useState<Set<string>>(new Set());

  const [dispatchForm, setDispatchForm] = useState({
    transporter_name: '',
    tracking_number: '',
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    received_by_name: '',
    packages: 1,
    notes: '',
    dispatch_mode: 'collect' as DispatchMode,
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  // Dispatch must tick that it has actually opened the invoice / e-way bill.
  const [docsVerified, setDocsVerified] = useState(false);

  // Which fields this mode asks for. Local Transport is the odd one: a local
  // driver has no LR number and no tracking, so all we can record is who drove.
  const modeFields = DISPATCH_MODE_FIELDS[dispatchForm.dispatch_mode];

  // Receipt is mandatory when goods leave via courier or transport
  const receiptRequired = modeFields.receipt;

  const loading = jobsLoading || dispatchesLoading;

  // Fetch transporters on mount
  useEffect(() => {
    const fetchTransporters = async () => {
      const { data } = await supabase
        .from('vendors')
        .select('id, name, company')
        .or('category.ilike.%transport%,category.ilike.%courier%,category.ilike.%logistic%')
        .order('name');
      setTransporters(data || []);
    };
    fetchTransporters();
  }, []);

  // ─── Derived Data ─────────────────────────────────────────
  const materialReceived = jobs.filter(j => j.current_stage === 'material_received');
  const pendingQC = jobs.filter(j => j.current_stage === 'quality_check');
  const readyToDispatch = jobs.filter(j => j.current_stage === 'ready');

  const sentDispatches = dispatches.slice(0, 6);

  // Delayed count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delayedCount = jobs.filter(j => {
    if (!j.client_deadline) return false;
    const deadline = new Date(j.client_deadline);
    return deadline < today && !['delivered', 'completed', 'cancelled', 'dispatched'].includes(j.current_stage);
  }).length;

  const stats = [
    { label: 'Material Received', value: materialReceived.length.toString(), sub: `${materialReceived.length} awaiting material QC`, icon: ShieldCheck, color: 'bg-teal-500' },
    { label: 'QC & Dispatch', value: pendingQC.length.toString(), sub: `${pendingQC.length} jobs awaiting QC`, icon: ClipboardCheck, color: 'bg-purple-500' },
    { label: 'Ready to Dispatch', value: readyToDispatch.length.toString(), sub: `${readyToDispatch.length} jobs ready`, icon: Package, color: 'bg-primary' },
    { label: 'Delayed', value: delayedCount.toString(), sub: 'Needs attention', icon: AlertTriangle, color: delayedCount > 0 ? 'bg-red-500' : 'bg-gray-300' },
  ];

  // ─── Status helpers ───────────────────────────────────────
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-gray-100 text-gray-900';
      case 'in_transit': return 'bg-muted text-foreground';
      case 'dispatched': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'delivered': return 'Delivered';
      case 'in_transit': return 'In Transit';
      case 'dispatched': return 'Dispatched';
      default: return status;
    }
  };

  // ─── Handlers ─────────────────────────────────────────────
  const handleOpenDispatch = (job: Job) => {
    setSelectedJob(job);
    setDispatchForm({
      transporter_name: '', tracking_number: '', vehicle_number: '',
      driver_name: '', driver_phone: '', received_by_name: '',
      packages: job.quantity || 1, notes: '',
      dispatch_mode: 'collect',
    });
    setReceiptFile(null);
    setDocsVerified(false);
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    // Courier / transport must have a receipt for traceability
    if (receiptRequired && !receiptFile) {
      toast.error('Please attach the courier / transport receipt before dispatching.');
      return;
    }
    // Local transport has no LR and no tracking — the driver IS the record.
    if (modeFields.driver && !dispatchForm.driver_name.trim()) {
      toast.error('Enter the driver name — for local transport it is the only record we have.');
      return;
    }
    // Nothing leaves until someone has actually looked at the paperwork.
    if (!docsVerified) {
      toast.error('Open and tick the invoice / e-way bill check before dispatching.');
      return;
    }
    setSubmitting(true);

    try {
      // Upload receipt (courier / transport only)
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const path = `dispatch-receipts/${selectedJob.id}-${Date.now()}-${receiptFile.name}`;
        const { error: upErr } = await supabase.storage.from('attachments').upload(path, receiptFile);
        if (upErr) throw new Error('Receipt upload failed: ' + upErr.message);
        receiptUrl = supabase.storage.from('attachments').getPublicUrl(path).data?.publicUrl || null;
      }

      // Build the row explicitly. Spreading the form used to send
      // `dispatch_mode` into a table that had no such column, so PostgREST
      // rejected EVERY insert — 232 jobs and not one dispatch record.
      // An explicit payload means a new form field can never silently break
      // the insert again.
      const modeLabel = DISPATCH_MODE_FIELDS[dispatchForm.dispatch_mode].label;
      const result = await createDispatch({
        job_id: selectedJob.id,
        client_id: selectedJob.client_id,
        status: 'dispatched',
        dispatch_date: new Date().toISOString(),
        dispatch_mode: dispatchForm.dispatch_mode,
        packages: dispatchForm.packages || 1,
        notes: dispatchForm.notes || undefined,
        receipt_url: receiptUrl || undefined,
        // Only send what this mode actually asked for, so a stale value from a
        // mode the user switched away from can't be saved.
        transporter_name: modeFields.transporter ? dispatchForm.transporter_name || undefined : undefined,
        tracking_number: modeFields.tracking ? dispatchForm.tracking_number || undefined : undefined,
        vehicle_number: modeFields.vehicle ? dispatchForm.vehicle_number || undefined : undefined,
        driver_name: modeFields.driver ? dispatchForm.driver_name || undefined : undefined,
        driver_phone: modeFields.driver ? dispatchForm.driver_phone || undefined : undefined,
        received_by_name: modeFields.receivedBy ? dispatchForm.received_by_name || undefined : undefined,
        dispatched_by: profile?.id || undefined,
      } as any);

      if (result.error) throw new Error(result.error);

      const who = modeFields.receivedBy
        ? (dispatchForm.received_by_name ? ` — collected by ${dispatchForm.received_by_name}` : '')
        : modeFields.driver
          ? (dispatchForm.driver_name ? ` — driver ${dispatchForm.driver_name}` : '')
          : (dispatchForm.transporter_name ? ` (${dispatchForm.transporter_name})` : '');
      const tracking = modeFields.tracking && dispatchForm.tracking_number
        ? `. Tracking: ${dispatchForm.tracking_number}`
        : '';

      await updateJobStage(selectedJob.id, 'dispatched',
        `Dispatched via ${modeLabel}${who}${tracking}. Paperwork verified by ${profile?.full_name || 'dispatcher'}.`
      );

      // Persist mode of dispatch + receipt on the job.
      // (dispatched_at is set by the DB trigger on the dispatches insert —
      // it is the day-0 for payment ageing and must not depend on this call
      // succeeding.)
      await supabase.from('jobs')
        .update({ dispatch_mode: dispatchForm.dispatch_mode, dispatch_receipt_url: receiptUrl })
        .eq('id', selectedJob.id);

      // Save QC record for traceability
      try {
        await supabase.from('qc_records').insert({
          job_id: selectedJob.id,
          qc_type: 'post_print',
          checklist: { paperwork_verified: true },
          result: 'passed',
          notes: `Dispatched via ${modeLabel}. Invoice / e-way bill checked by ${profile?.full_name || 'dispatcher'}.`,
          performed_by: profile?.id || null,
          performed_by_name: profile?.full_name || 'Unknown',
        });
      } catch (err) {
        console.warn('Could not save dispatch QC record:', err);
      }

      setShowDispatchModal(false);
      toast.info('Order marked as Dispatched!');
    } catch (err: any) {
      toast.error(String('Error dispatching: ' + err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      {/* A failed fetch used to leave this screen looking merely quiet.
          On an operations board that is dangerous: an empty list reads as
          "nothing to dispatch" and work silently stops. Say so instead. */}
      {/* Parenthesised deliberately: `&&` binds tighter than `||`, so
          `a || b && <X/>` means `a || (b && <X/>)` — with a truthy jobsError
          React would render the raw error string as page text instead of the
          component. */}
      {(jobsError || dispatchesError) && (
        <LoadError variant="inline" what="the dispatch board" error={jobsError || dispatchesError} onRetry={() => { refetchJobs?.(); refetchDispatches?.(); }} />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-page-title text-gray-900">Dispatch</h1>
          <p className="text-xs md:text-sm text-gray-500">Welcome, {profile?.full_name || 'Dispatcher'} | QC & Logistics</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/dispatch/qc-check"
            className="flex items-center gap-2 bg-gray-700 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-600 transition-colors font-semibold text-sm"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Start QC</span>
          </Link>
          <Link
            href="/admin/print-runs"
            className="flex items-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-800 transition-colors font-semibold text-sm"
          >
            <Package className="w-4 h-4" />
            <span>Print Runs</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards — Job Queue style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <ClipboardCheck className="w-4 h-4 text-white" />
            <span className="text-xs text-white font-medium">Pending QC</span>
          </div>
          <p className="text-page-title text-white">{loading ? '...' : pendingQC.length}</p>
        </div>
        <div className="bg-muted border border-border rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Package className="w-4 h-4 text-foreground" />
            <span className="text-xs text-foreground font-medium">Ready to Dispatch</span>
          </div>
          <p className="text-page-title text-foreground">{loading ? '...' : readyToDispatch.length}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Truck className="w-4 h-4 text-gray-900" />
            <span className="text-xs text-gray-900 font-medium">Dispatched</span>
          </div>
          <p className="text-page-title text-gray-900">{loading ? '...' : dispatches.length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-red-600 font-medium">Delayed</span>
          </div>
          <p className="text-page-title text-red-700">{loading ? '...' : delayedCount}</p>
        </div>
      </div>

      {/* Pre Print QC + QC & Dispatch + Ready — card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {materialReceived.length === 0 && pendingQC.length === 0 && readyToDispatch.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500">No jobs pending QC or dispatch</div>
        )}

        {/* ── Printing Material Received → QC ── */}
        {materialReceived.map((job) => {
          const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
          return (
            <div key={job.id} ref={job.id === focusJobId ? focusCardRef : undefined} className={`bg-card rounded-md border border-border border-l-4 border-l-teal-400 hover:shadow-sm transition-shadow ${job.id === focusJobId ? 'ring-2 ring-amber-400' : isOverdue ? 'ring-1 ring-red-200' : ''}`}>
              <div className="bg-teal-50/60 px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md">
                <span className="text-[10px] font-mono text-muted-foreground">#{job.job_number}</span>
                <div className="flex items-center gap-1">
                  {job.priority === 'urgent' && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">Urgent</span>}
                  <span className="text-[9px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-semibold uppercase">Material In</span>
                </div>
              </div>
              <div className="px-3 pt-2 pb-3 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground truncate">{job.client?.company || job.client?.name}</p>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5">{job.project_name}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(job as any).product_category && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">{(job as any).product_category}</span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{job.job_type?.replace(/_/g, ' ')}</span>
                  {isOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Overdue</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                <div className="flex gap-1.5">
                  <button onClick={() => updateJobStage(job.id, 'quality_check')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 transition-colors">
                    <ShieldCheck className="w-3 h-3" /> Material OK → QC
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* ── QC & Dispatch ── */}
        {pendingQC.map((job) => {
          const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
          return (
            <div key={job.id} ref={job.id === focusJobId ? focusCardRef : undefined} className={`bg-card rounded-md border border-border border-l-4 border-l-violet-400 hover:shadow-sm transition-shadow ${job.id === focusJobId ? 'ring-2 ring-amber-400' : isOverdue ? 'ring-1 ring-red-200' : ''}`}>
              <div className="bg-violet-50/60 px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md">
                <span className="text-[10px] font-mono text-muted-foreground">#{job.job_number}</span>
                <div className="flex items-center gap-1">
                  {job.priority === 'urgent' && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">Urgent</span>}
                  <span className="text-[9px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-semibold uppercase">QC</span>
                </div>
              </div>
              <div className="px-3 pt-2 pb-3 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground truncate">{job.client?.company || job.client?.name}</p>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5">{job.project_name}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(job as any).product_category && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">{(job as any).product_category}</span>
                  )}
                  {isOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Overdue</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                <Link href="/admin/dispatch/qc-check"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-card border border-border text-muted-foreground rounded text-xs font-medium hover:text-foreground hover:border-foreground/30 transition-colors">
                  <ClipboardCheck className="w-3 h-3" /> Start QC
                </Link>
              </div>
            </div>
          );
        })}

        {readyToDispatch.map((job) => {
          const hasInvoice = hasInvoiceAttached(job as any);
          const invoiceAlreadyRequested = !!(job as any).invoice_requested_at;
          const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
          return (
            <div key={job.id} ref={job.id === focusJobId ? focusCardRef : undefined} className={`bg-card rounded-md border border-border border-l-4 border-l-green-400 hover:shadow-sm transition-shadow ${job.id === focusJobId ? 'ring-2 ring-amber-400' : isOverdue ? 'ring-1 ring-red-200' : ''}`}>
              <div className="bg-green-50/60 px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md">
                <span className="text-[10px] font-mono text-muted-foreground">#{job.job_number}</span>
                <div className="flex items-center gap-1">
                  {job.priority === 'urgent' && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">Urgent</span>}
                  <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold uppercase">Ready</span>
                </div>
              </div>
              <div className="px-3 pt-2 pb-3 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground truncate">{job.client?.company || job.client?.name}</p>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5">{job.project_name}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(job as any).product_category && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">{(job as any).product_category}</span>
                  )}
                  {isOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Overdue</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">Qty: {job.quantity} &bull; Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                {(job as any).packing_info && (
                  <p className="text-[10px] text-green-700 font-medium">
                    📦 {(job as any).packing_info.package_count} {(job as any).packing_info.package_type}(s) · ~{(job as any).packing_info.approx_weight_kg}kg
                  </p>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {!hasInvoice && (
                    <ActionButton
                      done={invoiceAlreadyRequested || invoiceRequested.has(job.id)}
                      doneLabel="Requested"
                      loadingLabel="Sending…"
                      successToast="Invoice requested from accounts ✓"
                      errorToast="Could not send invoice request"
                      onAction={async () => {
                        const res = await fetch(`/api/jobs/${job.id}/request-invoice`, { method: 'POST' });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error || 'Request failed');
                        setInvoiceRequested(prev => new Set(Array.from(prev).concat(job.id)));
                        return data;
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors bg-card border border-border text-muted-foreground hover:text-foreground"
                      doneClassName="bg-green-100 text-green-700 border-green-200"
                    >
                      <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> Request Invoice</span>
                    </ActionButton>
                  )}
                  <button
                    onClick={() => handleOpenDispatch(job)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-medium rounded whitespace-nowrap ${hasInvoice ? 'bg-foreground hover:opacity-90' : 'bg-amber-500 hover:bg-amber-600'}`}
                  >
                    {hasInvoice ? 'Dispatch Now' : '⚠️ Dispatch'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Dispatches */}
      {sentDispatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-section text-gray-900 font-semibold">Recent Dispatches</h2>
            <Link href="/admin/dispatch/history" className="text-sm text-gray-500 hover:text-gray-700">View All →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sentDispatches.map((dispatch) => (
              <div key={dispatch.id} className="bg-white rounded-md overflow-hidden border border-gray-200">
                <div className="bg-gray-400 px-3 py-2 flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">{dispatch.dispatch_number}</span>
                  <span className="text-xs px-2 py-0.5 bg-white/25 rounded-md text-white font-medium">
                    {getStatusLabel(dispatch.status)}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-gray-500 text-xs mb-1">{dispatch.client?.company || dispatch.client?.name}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{dispatch.transporter_name || 'Self'}</span>
                    <span>{dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString() : '-'}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Packages: {dispatch.packages}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* DISPATCH MODAL                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {showDispatchModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-section">Create Dispatch</h2>
                <p className="text-sm text-gray-500">Order #{selectedJob.job_number}</p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-4 space-y-4">
              {/* ── Paperwork from accounts — shown BEFORE the form fields,
                   because verifying it is the first thing dispatch should do. */}
              <DispatchPaperwork
                job={selectedJob as any}
                verified={docsVerified}
                onVerifiedChange={setDocsVerified}
              />

              {/* Mode of dispatch */}
              <div>
                <label className="block text-sm font-medium mb-1">Mode of Dispatch</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(DISPATCH_MODE_FIELDS) as DispatchMode[]).map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDispatchForm({ ...dispatchForm, dispatch_mode: id })}
                      className={`px-2 py-2 text-xs font-semibold rounded-md border transition-colors ${
                        dispatchForm.dispatch_mode === id
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {DISPATCH_MODE_FIELDS[id].label}
                    </button>
                  ))}
                </div>
                {dispatchForm.dispatch_mode === 'local_transport' && (
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Local driver — no LR or tracking number. Record the driver so the consignment can be traced.
                  </p>
                )}
              </div>

              {/* Receipt — required for courier / transport */}
              {modeFields.receipt && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {dispatchForm.dispatch_mode === 'courier' ? 'Courier' : 'Transport'} Receipt
                    <span className="text-red-500"> *</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                    className="w-full text-sm border rounded-md px-3 py-2 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Required for courier / transport dispatch. Image or PDF.</p>
                </div>
              )}

              {/* Client Collect — the only thing worth recording is who came. */}
              {modeFields.receivedBy && (
                <div>
                  <label className="block text-sm font-medium mb-1">Collected By (Client Name)</label>
                  <input type="text" placeholder="Name of person collecting"
                    value={dispatchForm.received_by_name}
                    onChange={e => setDispatchForm({ ...dispatchForm, received_by_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
              )}

              {(modeFields.transporter || modeFields.tracking) && (
                <div className="grid grid-cols-2 gap-3">
                  {modeFields.transporter && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Transporter</label>
                      {transporters.length > 0 ? (
                        <select
                          value={dispatchForm.transporter_name}
                          onChange={e => setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          <option value="">Self / Manual</option>
                          {transporters.map(t => (
                            <option key={t.id} value={t.name}>{t.name}{t.company ? ` (${t.company})` : ''}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" placeholder="e.g. DTDC, Self"
                          value={dispatchForm.transporter_name} onChange={e => setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm" />
                      )}
                    </div>
                  )}
                  {modeFields.tracking && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Tracking / LR No</label>
                      <input type="text" placeholder="Optional"
                        value={dispatchForm.tracking_number} onChange={e => setDispatchForm({ ...dispatchForm, tracking_number: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm" />
                    </div>
                  )}
                </div>
              )}

              {/* Packages pairs with Vehicle No when that field is shown; on its
                  own it takes the full width rather than leaving a hole. No mode
                  asks for a vehicle today — the field stays wired up so turning
                  it back on for one mode is a one-word change. */}
              <div className={modeFields.vehicle ? 'grid grid-cols-2 gap-3' : ''}>
                {modeFields.vehicle && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Vehicle No</label>
                    <input type="text" placeholder="e.g. OD-02-AA-1234"
                      value={dispatchForm.vehicle_number} onChange={e => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Packages Count</label>
                  <input type="number" min="1"
                    value={dispatchForm.packages || ''} onChange={e => setDispatchForm({ ...dispatchForm, packages: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
              </div>

              {/* Driver — local transport only. A local tempo has no LR number,
                  so the driver's name and phone ARE the tracking. */}
              {modeFields.driver && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Driver Name<span className="text-red-500"> *</span>
                    </label>
                    <input type="text" placeholder="Who is driving"
                      value={dispatchForm.driver_name} onChange={e => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Driver Phone</label>
                    <input type="tel" inputMode="tel" placeholder="Optional"
                      value={dispatchForm.driver_phone} onChange={e => setDispatchForm({ ...dispatchForm, driver_phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea rows={2} placeholder="Any delivery instructions..."
                  value={dispatchForm.notes} onChange={e => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-500 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                This will move the order to &quot;Dispatched&quot; and create a dispatch record.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDispatchModal(false)} className="flex-1 px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting || !docsVerified}
                  title={!docsVerified ? 'Tick the paperwork check first' : undefined}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
