'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import DispatchContactInput, { invalidateContactCache } from '@/components/dispatch/DispatchContactInput';
import ProductBadge from '@/components/shared/ProductBadge';

export default function DispatchPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, error: jobsError, updateJobStage, refetch: refetchJobs } = useJobs({
    // Explicit select so the dispatch card can see the invoice signals.
    // The accountant may attach an invoice two ways: by saving invoice_reference
    // on the job, or by creating a row in the invoices table (job_id FK).
    // We fetch both so "Invoice ready" reflects reality either way.
    select: 'id, job_number, project_name, client_id, priority, current_stage, job_type, product_category, parent_job_id, client_deadline, total_amount, amount_received, payment_status, quantity, packing_info, invoice_reference, eway_bill_number, invoice_requested_at, files, client:clients(id, name, company), invoices:invoices(id)',
    filter: [{ column: 'current_stage', value: ['material_received', 'quality_check', 'ready'], op: 'in' }],
    orderBy: { column: 'client_deadline', ascending: true },
    // useJobs defaults to 50, but 150+ jobs can sit in these stages at once —
    // a board silently showing a third of the queue reads as "all caught up".
    limit: 500
  });
  const { dispatches, loading: dispatchesLoading, error: dispatchesError, createDispatchGroup, refetch: refetchDispatches } = useDispatches();

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

  // Dispatch modal — always a GROUP of jobs (a single job is a group of one).
  // Clubbing several small jobs of one client into one box/bag is the normal
  // case here, not the exception: it saves transport cost and handling.
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Card-level selection for "dispatch together". One box = one client, so
  // once the first job is ticked, other clients' cards grey out.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Selection hygiene: jobs leave Ready from other screens/tabs while their
  // ids sit in this state — prune to what is actually on the board, so a job
  // that bounces back later cannot resurrect a stale (possibly cross-client)
  // selection.
  useEffect(() => {
    setSelectedIds(prev => {
      const readyIds = new Set(jobs.filter(j => j.current_stage === 'ready').map(j => j.id));
      const next = new Set(Array.from(prev).filter(id => readyIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [jobs]);

  // Per-job quantity to dispatch (kept as string — it feeds an input).
  // Prefilled with the remaining quantity so the common case — ship
  // everything — needs zero typing.
  const [qtyByJob, setQtyByJob] = useState<Record<string, string>>({});
  // Paperwork is ticked PER JOB — each job keeps its own invoice and e-way
  // bill even when the goods share one box.
  const [docsVerifiedByJob, setDocsVerifiedByJob] = useState<Record<string, boolean>>({});

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

  // Which fields this mode asks for. Local Transport is the odd one: a local
  // driver has no LR number and no tracking, so all we can record is who drove.
  const modeFields = DISPATCH_MODE_FIELDS[dispatchForm.dispatch_mode];

  // Receipt is mandatory when goods leave via courier or transport
  const receiptRequired = modeFields.receipt;

  // Nothing leaves until every job's paperwork has been opened and ticked.
  const allDocsVerified = selectedJobs.length > 0 && selectedJobs.every(j => docsVerifiedByJob[j.id]);

  const loading = jobsLoading || dispatchesLoading;

  // (The old vendors lookup that fed this form is gone: there were no
  //  transport or courier vendors, and DispatchContactInput now offers the
  //  names actually used on past dispatches instead.)

  // ─── Derived Data ─────────────────────────────────────────
  const materialReceived = jobs.filter(j => j.current_stage === 'material_received');
  const pendingQC = jobs.filter(j => j.current_stage === 'quality_check');
  const readyToDispatch = jobs.filter(j => j.current_stage === 'ready');

  // Quantity already shipped per job (from earlier partial dispatches).
  // A row with NULL dispatched_qty was a FULL dispatch — that job has left
  // the Ready column anyway, so summing only the numbers is enough here.
  const shippedByJob = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of dispatches) {
      if (d.job_id && typeof d.dispatched_qty === 'number') {
        m[d.job_id] = (m[d.job_id] || 0) + d.dispatched_qty;
      }
    }
    return m;
  }, [dispatches]);

  // How many pieces are still to ship. null = the job has no usable quantity,
  // so a dispatch is always "everything" (its dispatched_qty stays NULL and
  // the DB treats that as a full dispatch — same as every legacy row).
  const remainingFor = (job: Job): number | null => {
    const q = job.quantity || 0;
    if (q <= 0) return null;
    return Math.max(q - (shippedByJob[job.id] || 0), 0);
  };

  const selectedReadyJobs = readyToDispatch.filter(j => selectedIds.has(j.id));
  const anchorClientId = selectedReadyJobs[0]?.client_id;
  const anchorClientName = selectedReadyJobs[0]?.client?.company || selectedReadyJobs[0]?.client?.name || '';

  // Recent dispatches, ONE card per consignment: a clubbed shipment is one
  // physical box/bag and should read as one thing, not N look-alike cards.
  const recentGroups = useMemo(() => {
    const order: string[] = [];
    const byKey = new Map<string, Dispatch[]>();
    for (const d of dispatches) {
      const key = d.consignment_no || d.id;
      if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
      byKey.get(key)!.push(d);
    }
    return order.slice(0, 6).map(key => ({ key, rows: byKey.get(key)! }));
  }, [dispatches]);

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
  const toggleSelect = (job: Job) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(job.id)) next.delete(job.id); else next.add(job.id);
      return next;
    });
  };

  const handleOpenDispatch = (jobsToDispatch: Job[]) => {
    if (jobsToDispatch.length === 0) return;
    setSelectedJobs(jobsToDispatch);
    const qty: Record<string, string> = {};
    for (const j of jobsToDispatch) {
      const rem = remainingFor(j);
      qty[j.id] = rem != null ? String(rem) : '';
    }
    setQtyByJob(qty);
    setDocsVerifiedByJob({});
    // Default box count = what QC actually packed, summed over the group,
    // else 1 — the whole point of clubbing is one box for many jobs.
    const packed = jobsToDispatch.reduce(
      (sum, j) => sum + (Number((j as any).packing_info?.package_count) || 0), 0);
    setDispatchForm({
      transporter_name: '', tracking_number: '', vehicle_number: '',
      driver_name: '', driver_phone: '', received_by_name: '',
      packages: packed || 1, notes: '',
      dispatch_mode: 'collect',
    });
    setReceiptFile(null);
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJobs.length === 0) return;

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
    // Nothing leaves until someone has actually looked at EVERY job's paperwork.
    if (!allDocsVerified) {
      toast.error('Open and tick the invoice / e-way bill check for every job before dispatching.');
      return;
    }
    // One box = one client — enforced here too, not only at the checkbox,
    // because a stale selection could in theory mix clients.
    if (new Set(selectedJobs.map(j => j.client_id || '')).size > 1) {
      toast.error('These jobs belong to different clients — one box/bag goes to one client. Clear the selection and pick again.');
      setSelectedIds(new Set());
      return;
    }
    // Quantities: 1 … remaining, per job. (Jobs without a usable quantity
    // ship whole — their dispatched_qty stays NULL.)
    for (const j of selectedJobs) {
      const rem = remainingFor(j);
      if (rem == null) continue;
      const n = parseInt(qtyByJob[j.id] || '', 10);
      if (!Number.isFinite(n) || n < 1) {
        toast.error(`Enter the quantity to dispatch for #${j.job_number}.`);
        return;
      }
      if (n > rem) {
        toast.error(`#${j.job_number}: only ${rem} of ${j.quantity} left to dispatch.`);
        return;
      }
    }
    setSubmitting(true);

    try {
      // Server-truth guard: the on-screen shipped totals can be stale (another
      // tab or dispatcher), silently capped (PostgREST max-rows), or missing
      // entirely (a failed fetch falls back to an empty list). Physical-goods
      // accounting must not rest on that — re-read the shipped sums for
      // exactly these jobs and validate again before anything is written.
      // The DB trigger (check_dispatch_qty) enforces the same rule
      // transactionally as the last line of defence.
      const { data: priorRows, error: priorErr } = await supabase
        .from('dispatches')
        .select('job_id, dispatched_qty')
        .in('job_id', selectedJobs.map(j => j.id))
        .not('dispatched_qty', 'is', null);
      if (priorErr) throw new Error('Could not verify already-dispatched quantities: ' + priorErr.message);
      const priorByJob: Record<string, number> = {};
      for (const r of priorRows || []) {
        if (r.job_id) priorByJob[r.job_id] = (priorByJob[r.job_id] || 0) + (r.dispatched_qty || 0);
      }
      const freshRemFor = (j: Job): number | null => {
        const q = j.quantity || 0;
        if (q <= 0) return null;
        return Math.max(q - (priorByJob[j.id] || 0), 0);
      };
      for (const j of selectedJobs) {
        const rem = freshRemFor(j);
        if (rem == null) continue;
        const n = parseInt(qtyByJob[j.id] || '', 10);
        if (n > rem) {
          refetchDispatches?.();
          throw new Error(`#${j.job_number}: only ${rem} of ${j.quantity} left to dispatch — the board was out of date and has been refreshed.`);
        }
      }

      // Upload receipt (courier / transport only) — ONCE for the whole box.
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const path = `dispatch-receipts/${selectedJobs[0].id}-${Date.now()}-${receiptFile.name}`;
        const { error: upErr } = await supabase.storage.from('attachments').upload(path, receiptFile);
        if (upErr) throw new Error('Receipt upload failed: ' + upErr.message);
        receiptUrl = supabase.storage.from('attachments').getPublicUrl(path).data?.publicUrl || null;
      }

      // Build the shared shipment payload explicitly. Spreading the form used
      // to send `dispatch_mode` into a table that had no such column, so
      // PostgREST rejected EVERY insert — 232 jobs and not one dispatch
      // record. An explicit payload means a new form field can never silently
      // break the insert again.
      const modeLabel = DISPATCH_MODE_FIELDS[dispatchForm.dispatch_mode].label;
      const shared = {
        client_id: selectedJobs[0].client_id,
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
      };
      const items = selectedJobs.map(j => {
        const rem = freshRemFor(j);
        return { job_id: j.id, dispatched_qty: rem == null ? null : parseInt(qtyByJob[j.id], 10) };
      });

      // One dispatches row per job, all sharing one consignment number —
      // the invoice-required trigger and per-job e-way bill stay intact.
      const result = await createDispatchGroup(shared as any, items);
      if (result.created.length === 0) {
        throw new Error(result.failed[0]?.error || 'No dispatch could be created');
      }

      const who = modeFields.receivedBy
        ? (dispatchForm.received_by_name ? ` — collected by ${dispatchForm.received_by_name}` : '')
        : modeFields.driver
          ? (dispatchForm.driver_name ? ` — driver ${dispatchForm.driver_name}` : '')
          : (dispatchForm.transporter_name ? ` (${dispatchForm.transporter_name})` : '');
      const tracking = modeFields.tracking && dispatchForm.tracking_number
        ? `. Tracking: ${dispatchForm.tracking_number}`
        : '';
      const consignNote = selectedJobs.length > 1
        ? ` Consignment ${result.consignment_no} (${selectedJobs.length} jobs in one box/bag).`
        : '';

      let partials = 0;
      for (const j of selectedJobs) {
        if (!result.created.includes(j.id)) continue;
        const item = items.find(i => i.job_id === j.id)!;
        const rem = freshRemFor(j);
        const fullyShipped = item.dispatched_qty == null || (rem != null && item.dispatched_qty >= rem);
        const qtyNote = item.dispatched_qty != null
          ? ` Qty: ${item.dispatched_qty}${j.quantity ? ` of ${j.quantity}` : ''}.`
          : '';

        if (fullyShipped) {
          await updateJobStage(j.id, 'dispatched',
            `Dispatched via ${modeLabel}${who}${tracking}.${qtyNote}${consignNote} Paperwork verified by ${profile?.full_name || 'dispatcher'}.`
          );
        } else {
          // Partial: the job STAYS in Ready with the remainder — the DB
          // trigger is qty-aware too, so nothing moves it. Record the event
          // in the job's history so the timeline explains the wait.
          partials++;
          const left = (rem || 0) - (item.dispatched_qty || 0);
          await supabase.from('job_stage_history').insert([{
            job_id: j.id,
            from_stage: 'ready',
            to_stage: 'ready',
            notes: `Partial dispatch via ${modeLabel}${who}${tracking}.${qtyNote}${consignNote} ${left} remaining. By ${profile?.full_name || 'dispatcher'}.`
          }]);
        }

        // Persist mode of dispatch + receipt on the job.
        // (dispatched_at is set by the DB trigger on the dispatches insert —
        // now only once the job is FULLY shipped, so a partial does not start
        // the payment-ageing clock on goods still in the warehouse.)
        await supabase.from('jobs')
          .update({ dispatch_mode: dispatchForm.dispatch_mode, dispatch_receipt_url: receiptUrl })
          .eq('id', j.id);

        // Save QC record for traceability
        try {
          await supabase.from('qc_records').insert({
            job_id: j.id,
            qc_type: 'post_print',
            checklist: { paperwork_verified: true },
            result: 'passed',
            notes: `Dispatched via ${modeLabel}.${qtyNote}${consignNote} Invoice / e-way bill checked by ${profile?.full_name || 'dispatcher'}.`,
            performed_by: profile?.id || null,
            performed_by_name: profile?.full_name || 'Unknown',
          });
        } catch (err) {
          console.warn('Could not save dispatch QC record:', err);
        }
      }

      // Some rows can fail while others succeed (e.g. one job missing its
      // invoice). The successes are real dispatches — say exactly which jobs
      // did NOT go, so the operator can fix and re-dispatch just those.
      if (result.failed.length > 0) {
        const names = result.failed
          .map(f => selectedJobs.find(j => j.id === f.job_id)?.job_number || f.job_id)
          .join(', ');
        toast.error(`Not dispatched: ${names} — ${result.failed[0].error}`);
      }

      // The DB trigger has just remembered this courier / driver; drop the
      // cached list so the next dispatch offers it straight away.
      invalidateContactCache();
      setShowDispatchModal(false);
      setSelectedIds(new Set());
      if (selectedJobs.length === 1 && partials > 0) {
        toast.info('Partial dispatch recorded — the job stays on the board with the remaining quantity.');
      } else if (selectedJobs.length === 1) {
        toast.info('Order marked as Dispatched!');
      } else {
        toast.info(`Consignment ${result.consignment_no}: ${result.created.length} job(s) sent in one box/bag${partials > 0 ? `, ${partials} partial` : ''}.`);
      }
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

      {/* ── Club-into-one-box selection bar ──
          Appears once any Ready card is ticked. One click dispatches the
          whole group as ONE consignment: one box/bag, one transporter entry. */}
      {selectedReadyJobs.length > 0 && (
        <div className="sticky top-2 z-40 flex flex-wrap items-center gap-2 bg-gray-900 text-white rounded-md px-3 py-2.5 shadow-lg">
          <Package className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            {selectedReadyJobs.length} job{selectedReadyJobs.length > 1 ? 's' : ''} · {anchorClientName} — one box/bag, one consignment
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-medium rounded border border-white/30 hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => handleOpenDispatch(selectedReadyJobs)}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-white text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Dispatch Together →
            </button>
          </div>
        </div>
      )}

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
                  <ProductBadge category={(job as any).product_category} />
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
                  <ProductBadge category={(job as any).product_category} />
                  {isOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Overdue</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                <Link href={`/admin/dispatch/qc-check?job=${job.id}`}
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
          const isSelected = selectedIds.has(job.id);
          const selectDisabled = !isSelected && !!anchorClientId && job.client_id !== anchorClientId;
          const shipped = shippedByJob[job.id] || 0;
          return (
            <div key={job.id} ref={job.id === focusJobId ? focusCardRef : undefined} className={`bg-card rounded-md border border-border border-l-4 border-l-green-400 hover:shadow-sm transition-shadow ${job.id === focusJobId ? 'ring-2 ring-amber-400' : isSelected ? 'ring-2 ring-gray-900' : isOverdue ? 'ring-1 ring-red-200' : ''}`}>
              <div className="bg-green-50/60 px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md">
                <div className="flex items-center gap-2 min-w-0">
                  {/* One box = one client: once a client is anchored, other
                      clients' checkboxes grey out instead of disappearing. */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={selectDisabled}
                    onChange={() => toggleSelect(job)}
                    title={selectDisabled
                      ? `One box = one client — this job is for a different client than ${anchorClientName}`
                      : 'Select to club into one box/bag with other jobs of this client'}
                    className="w-4 h-4 rounded border-gray-300 accent-gray-900 disabled:opacity-30 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground truncate">#{job.job_number}</span>
                </div>
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
                  <ProductBadge category={(job as any).product_category} />
                  {isOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Overdue</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">Qty: {job.quantity} &bull; Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                {shipped > 0 && job.quantity ? (
                  <p className="text-[10px] text-amber-700 font-medium">
                    🚚 {shipped} of {job.quantity} already dispatched &bull; {Math.max((job.quantity || 0) - shipped, 0)} left
                  </p>
                ) : null}
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
                    onClick={() => handleOpenDispatch([job])}
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

      {/* Recent Dispatches — one card per consignment */}
      {recentGroups.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-section text-gray-900 font-semibold">Recent Dispatches</h2>
            <Link href="/admin/dispatch/history" className="text-sm text-gray-500 hover:text-gray-700">View All →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentGroups.map(({ key, rows }) => {
              const d = rows[0];
              const clubbed = rows.length > 1;
              return (
                <div key={key} className="bg-white rounded-md overflow-hidden border border-gray-200">
                  <div className="bg-gray-400 px-3 py-2 flex items-center justify-between">
                    <span className="text-white font-semibold text-sm">{clubbed ? (d.consignment_no || d.dispatch_number) : d.dispatch_number}</span>
                    <span className="text-xs px-2 py-0.5 bg-white/25 rounded-md text-white font-medium">
                      {getStatusLabel(d.status)}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-gray-500 text-xs mb-1">{d.client?.company || d.client?.name}</p>
                    {clubbed && (
                      <p className="text-[10px] text-gray-500 mb-1">
                        📦 {rows.length} jobs in one box/bag: {rows.map(r => r.job?.job_number).filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{d.transporter_name || 'Self'}</span>
                      <span>{d.dispatch_date ? new Date(d.dispatch_date).toLocaleDateString() : '-'}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Packages: {d.packages}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* DISPATCH MODAL — one shipment, one or many jobs */}
      {/* ═══════════════════════════════════════════════ */}
      {showDispatchModal && selectedJobs.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-section">Create Dispatch</h2>
                <p className="text-sm text-gray-500">
                  {selectedJobs.length === 1
                    ? `Order #${selectedJobs[0].job_number}`
                    : `${selectedJobs.length} orders · ${selectedJobs[0].client?.company || selectedJobs[0].client?.name} — one box/bag, one consignment`}
                </p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-4 space-y-4">
              {/* ── Per-job paperwork + quantity, shown BEFORE the shipment
                   fields: each job keeps its own invoice and e-way bill even
                   inside a shared box, so each one is verified — and can be
                   part-shipped — on its own. */}
              <div className="space-y-3">
                {selectedJobs.map(job => {
                  const rem = remainingFor(job);
                  const shipped = shippedByJob[job.id] || 0;
                  const typed = parseInt(qtyByJob[job.id] || '', 10);
                  const isPartial = rem != null && Number.isFinite(typed) && typed >= 1 && typed < rem;
                  return (
                    <div key={job.id} className={selectedJobs.length > 1 ? 'rounded-md border border-border p-2.5 space-y-2' : 'space-y-2'}>
                      {selectedJobs.length > 1 && (
                        <p className="text-xs font-semibold text-foreground">
                          #{job.job_number} <span className="font-normal text-muted-foreground">— {job.project_name}</span>
                        </p>
                      )}
                      <DispatchPaperwork
                        job={job as any}
                        verified={!!docsVerifiedByJob[job.id]}
                        onVerifiedChange={v => setDocsVerifiedByJob(prev => ({ ...prev, [job.id]: v }))}
                      />
                      {rem != null && (
                        <div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium shrink-0">Qty to dispatch</label>
                            <input
                              type="number" min={1} max={rem}
                              value={qtyByJob[job.id] ?? ''}
                              onChange={e => setQtyByJob(prev => ({ ...prev, [job.id]: e.target.value }))}
                              className="w-28 px-3 py-1.5 border rounded-md text-sm"
                            />
                            <span className="text-[11px] text-gray-500">
                              of {rem} remaining{shipped > 0 ? ` (${shipped} already sent)` : ''}
                            </span>
                          </div>
                          {isPartial && (
                            <p className="text-[11px] text-amber-700 mt-1">
                              Partial — the job stays on the board with {rem - typed} remaining.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

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
                  <p className="text-[11px] text-gray-400 mt-1">Required for courier / transport dispatch. Image or PDF. One receipt covers the whole consignment.</p>
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
                      <label className="block text-sm font-medium mb-1">
                        {dispatchForm.dispatch_mode === 'courier' ? 'Courier' : 'Transporter'}
                      </label>
                      {/* Always typeable, always showing what was used before.
                          This used to be a <select> whenever any transport
                          vendor existed — so adding the first vendor would have
                          removed the ability to enter a courier that wasn't on
                          the list, mid-dispatch, with no way round it. */}
                      <DispatchContactInput
                        kind={dispatchForm.dispatch_mode === 'courier' ? 'courier' : 'transport'}
                        value={dispatchForm.transporter_name}
                        onChange={name => setDispatchForm(f => ({ ...f, transporter_name: name }))}
                        placeholder="e.g. DTDC, Self"
                      />
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
                  {selectedJobs.length > 1 && (
                    <p className="text-[11px] text-gray-400 mt-1">Total boxes/bags for the whole consignment — usually 1.</p>
                  )}
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
                    {/* Picking a driver used before fills in his phone, so the
                        number is right without anyone remembering it. */}
                    <DispatchContactInput
                      kind="local_driver"
                      value={dispatchForm.driver_name}
                      onChange={name => setDispatchForm(f => ({ ...f, driver_name: name }))}
                      onPick={c => setDispatchForm(f => ({
                        ...f,
                        driver_name: c.name,
                        // Never wipe a number already typed for this trip.
                        driver_phone: c.phone || f.driver_phone,
                      }))}
                      placeholder="Who is driving"
                    />
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
                <span>
                  {selectedJobs.length > 1
                    ? <>One dispatch record per job, sharing one consignment number. Fully shipped jobs move to &quot;Dispatched&quot;; part-shipped jobs stay on the board with the remainder.</>
                    : <>This will move the order to &quot;Dispatched&quot; and create a dispatch record. A partial quantity keeps the job on the board with the remainder.</>}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDispatchModal(false)} className="flex-1 px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting || !allDocsVerified}
                  title={!allDocsVerified ? 'Tick the paperwork check for every job first' : undefined}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : selectedJobs.length > 1 ? `Dispatch ${selectedJobs.length} Jobs Together` : 'Create Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
