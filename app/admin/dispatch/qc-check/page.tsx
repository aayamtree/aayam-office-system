'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  ClipboardCheck, Loader2, FileCheck, Printer, Image as ImageIcon, Clock, User
} from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Job, JobStatus } from '@/types/database';
import { createAuditedBrowserClient } from '@/lib/supabase';
import { Package } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmModal';
import { logActivity } from '@/lib/logger';
import LoadError from '@/components/LoadError';
import { toast } from '@/lib/toast';
import JobThumb from '@/components/shared/JobThumb';
import ProductBadge from '@/components/shared/ProductBadge';
import RollbackJobButton from '@/components/jobs/RollbackJobButton';
import { normalizeProductCategory } from '@/lib/product-category';

// Fallback checkpoints if no DB checklists found
const FALLBACK_PRE_PRINT = [
  { id: 'bleed_check', label: 'Bleed Check', desc: 'Bleed area is correct', critical: true },
  { id: 'colors_cmyk', label: 'Colors (CMYK)', desc: 'All colors in CMYK mode', critical: true },
  { id: 'dimensions', label: 'Dimensions', desc: 'File dimensions match job spec', critical: false },
  { id: 'fonts', label: 'Fonts Outlined', desc: 'All fonts are outlined/embedded', critical: false },
];

const FALLBACK_POST_PRINT = [
  { id: 'color_accuracy', label: 'Color Accuracy', desc: 'Colors are accurate', critical: true },
  { id: 'print_quality', label: 'Print Quality', desc: 'No smudges, sharp & aligned', critical: true },
  { id: 'paper_material', label: 'Paper/Material', desc: 'Correct paper type & GSM', critical: false },
  { id: 'quantity', label: 'Quantity Verified', desc: 'Count checked (may vary slightly)', critical: false },
  { id: 'finishing', label: 'Finishing', desc: 'Lamination, binding, cutting OK', critical: false },
  { id: 'ready_for_packing', label: 'Ready for Packing', desc: 'Counted and staged — ready to be boxed', critical: true },
];

type QCType = 'pre_print' | 'post_print';

interface ChecklistItem {
  id: string;
  label: string;
  desc: string;
  critical: boolean;
}

export default function QCCheckPage() {
  const confirm = useConfirm();
  const { profile } = useAuth();
  const supabase = createAuditedBrowserClient();

  // quantity and notes are shown on the QC card and read by the QC form; neither
  // is in the default select, so both rendered empty.
  const { jobs, loading, error: jobsError, updateJobStage, updateJob, refetch: refetchJobs } = useJobs({
    select: 'id, job_number, project_name, client_id, priority, current_stage, job_type, product_category, parent_job_id, client_deadline, quantity, notes, total_amount, amount_received, payment_status, thumbnail_url, files, client:clients(id, name, company)',
    filter: [{ column: 'current_stage', value: ['finishing', 'quality_check', 'ready'], op: 'in' }],
    limit: 500,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [focusJobId, setFocusJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Backlog clearing: select jobs that already physically shipped (before the
  // app's QC flow worked) and mark them dispatched in one honest bulk move.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // QC Type — always dispatch QC on this page
  const [activeQCType, setActiveQCType] = useState<QCType>('post_print');

  // Dynamic checklists from DB
  const [prePrintItems, setPrePrintItems] = useState<ChecklistItem[]>([]);
  const [postPrintItems, setPostPrintItems] = useState<ChecklistItem[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);

  // QC Form State (Ephemeral)
  const [checkpoints, setCheckpoints] = useState<Record<string, { checked: boolean; note: string }>>({});
  const [activeTab, setActiveTab] = useState<'design' | 'checklist' | 'notes'>('checklist');
  const [qcNotes, setQcNotes] = useState('');

  // Verified-quantity step (shown after QC passes). This is deliberately the
  // ONLY thing asked here: how many pieces were actually counted, which the
  // ordered quantity can differ from by a run's over/under-run. What box(es)
  // this job ends up in is NOT decided at QC time any more — that happens at
  // the Pack step, once it's known which other jobs (if any) will share the
  // box. Asking for a package count per single job here used to force a
  // "1 box" answer that was routinely wrong the moment two jobs got clubbed.
  const [showQtyStep, setShowQtyStep] = useState(false);
  const [verifiedQty, setVerifiedQty] = useState('');

  // QC history for selected job
  const [qcHistory, setQcHistory] = useState<any[]>([]);

  // Load dynamic checklists when a job is selected
  const loadChecklists = useCallback(async (job: Job) => {
    setLoadingChecklists(true);

    try {
      // Both pre-print AND dispatch checklists are keyed by PRODUCT category
      // (job_checklists.job_type holds "Box", "Pouch", "Label"... despite its
      // name). jobs.job_type is the WORK type ("Design + Printing") and must
      // never be used to pick a checklist — matching on it always failed and
      // silently served the first (arbitrary) checklist to every job.
      const productCategory = normalizeProductCategory(job.product_category) || '';
      const { data: designChecklists } = await supabase
        .from('job_checklists')
        .select('id, category, job_type, items')
        .eq('category', 'design');

      // Fetch post-print checklists (category = 'dispatch') — also keyed by product
      const { data: dispatchChecklists } = await supabase
        .from('job_checklists')
        .select('id, category, job_type, items')
        .eq('category', 'dispatch');

      // Find matching checklist for this job's product category (pre-print)
      let preItems: ChecklistItem[] = [];
      if (designChecklists && designChecklists.length > 0) {
        // Exact product match only — an arbitrary other product's checklist is
        // worse than the generic fallback list.
        const match = productCategory ? designChecklists.find(c =>
          c.job_type?.trim().toLowerCase() === productCategory.toLowerCase()
        ) : undefined;
        const items = match
          ? (typeof match.items === 'string' ? JSON.parse(match.items) : match.items)
          : [];
        preItems = (items || []).map((item: any, idx: number) => ({
          id: `pre_${idx}`,
          label: typeof item === 'string' ? item : item.label,
          desc: typeof item === 'string' ? '' : (item.placeholder || ''),
          critical: typeof item === 'string' ? idx < 2 : !!item.required,
        }));
      }
      setPrePrintItems(preItems.length > 0 ? preItems : FALLBACK_PRE_PRINT);

      // Find matching checklist for this job's PRODUCT category (post-print).
      // Was matched on jobs.job_type (the WORK type) — never matched, so a BOX
      // job got whatever checklist happened to come back first (Pouch).
      let postItems: ChecklistItem[] = [];
      if (dispatchChecklists && dispatchChecklists.length > 0) {
        const match = productCategory ? dispatchChecklists.find(c =>
          c.job_type?.trim().toLowerCase() === productCategory.toLowerCase()
        ) : undefined;
        const items = match
          ? (typeof match.items === 'string' ? JSON.parse(match.items) : match.items)
          : [];
        postItems = (items || []).map((item: any, idx: number) => ({
          id: `post_${idx}`,
          label: typeof item === 'string' ? item : item.label,
          desc: typeof item === 'string' ? '' : (item.placeholder || ''),
          critical: typeof item === 'string' ? idx < 2 : !!item.required,
        }));
      }
      setPostPrintItems(postItems.length > 0 ? postItems : FALLBACK_POST_PRINT);
    } catch (error) {
      console.error('Error loading checklists:', error);
      setPrePrintItems(FALLBACK_PRE_PRINT);
      setPostPrintItems(FALLBACK_POST_PRINT);
    } finally {
      setLoadingChecklists(false);
    }
  }, [supabase]);

  // Always use dispatch checklist on this page
  const activeItems = postPrintItems;

  // Filter jobs relevant for QC-Dispatch
  const relevantJobs = jobs.filter(j =>
    ['finishing', 'quality_check', 'ready'].includes(j.current_stage)
  );

  const filteredJobs = relevantJobs.filter(job => {
    const matchesSearch =
      job.job_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'pending' && job.current_stage === 'finishing') ||
      (statusFilter === 'in_progress' && job.current_stage === 'quality_check') ||
      (statusFilter === 'passed' && job.current_stage === 'ready');

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finishing': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'quality_check': return 'bg-muted text-foreground border-border';
      case 'ready': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'finishing': return 'Pending QC';
      case 'quality_check': return 'In QC';
      case 'ready': return 'Passed';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'urgent' || priority === 'high') return 'bg-red-100 text-red-700';
    if (priority === 'low') return 'bg-gray-100 text-gray-600';
    return 'bg-muted text-foreground';
  };

  const handleStartQC = async (job: Job, qcType: QCType) => {
    setActiveQCType(qcType);

    if (qcType === 'post_print' && job.current_stage === 'finishing') {
      await updateJobStage(job.id, 'quality_check');
    }

    setSelectedJob(job);
    setCheckpoints({});
    setQcNotes(job.notes || '');
    setActiveTab('checklist');
    setShowQtyStep(false);
    setShowQCModal(true);

    // Load dynamic checklists
    await loadChecklists(job);

    // Load QC history
    try {
      const { data } = await supabase
        .from('qc_records')
        .select('id, job_id, qc_type, result, performed_by, performed_by_name, performed_at, notes, checklist')
        .eq('job_id', job.id)
        .order('performed_at', { ascending: false });
      setQcHistory(data || []);
    } catch {
      setQcHistory([]);
    }
  };

  // Deep link from a Dispatch board card: /qc-check?job=<id> opens that job's
  // own QC checklist directly instead of dropping the person on the full list.
  // The job is fetched by id rather than looked up in the SWR list: that list
  // can be a stale cached snapshot, or an empty anon result on a cold load
  // (RLS returns 0 rows with no error) — and a deep link silently eaten by
  // either looks exactly like a broken button.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('job');
    if (!id) return;
    // One-shot: strip the param so refresh / back-navigation does not replay
    // the open (handleStartQC advances a `finishing` job — not something a
    // page load should redo).
    window.history.replaceState(null, '', window.location.pathname);
    setFocusJobId(id);
  }, []);
  useEffect(() => {
    if (!focusJobId) return;
    let cancelled = false;
    let ran = false;
    const openJob = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_number, project_name, client_id, priority, current_stage, job_type, product_category, parent_job_id, client_deadline, quantity, notes, total_amount, amount_received, payment_status, thumbnail_url, files, client:clients(id, name, company)')
        .eq('id', focusJobId)
        .maybeSingle();
      if (cancelled) return;
      setFocusJobId(null);
      if (error || !data) {
        toast.error('Could not open that job for QC' + (error ? ': ' + error.message : ' — it may have been removed.'));
        return;
      }
      const job = data as unknown as Job;
      if (!['finishing', 'quality_check'].includes(job.current_stage)) {
        // Passed or already moved on — show where it stands instead of
        // reopening live Pass/Rework buttons on a finished QC.
        setSearchQuery(job.job_number || '');
        toast.info(`${job.job_number} is not awaiting QC (currently: ${(job.current_stage || 'unknown').replace(/_/g, ' ')}).`);
        return;
      }
      void handleStartQC(job, 'post_print');
    };
    // Auth-race guard (same reason as the Dispatch board): on a cold load this
    // query can run as `anon`, and RLS answers with nothing rather than an
    // error. Only fetch once Supabase confirms a live session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !ran && !cancelled) { ran = true; void openJob(); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && !ran && !cancelled && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        ran = true;
        void openJob();
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusJobId]);

  const updateCheckpoint = (id: string, field: 'checked' | 'note', value: boolean | string) => {
    setCheckpoints(prev => ({
      ...prev,
      [id]: { ...prev[id] || { checked: false, note: '' }, [field]: value }
    }));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDispatch = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { confirmed } = await confirm({
      title: `Mark ${ids.length} job${ids.length > 1 ? 's' : ''} as Dispatched?`,
      message: `Use this ONLY for jobs whose goods already physically left — it skips the QC checklist and dispatch paperwork entirely. Each job gets a history note saying it was cleared from the backlog, and unpaid ones stay visible on the money side.`,
      variant: 'danger',
      confirmLabel: `Mark ${ids.length} Dispatched`,
    });
    if (!confirmed) return;
    setBulkBusy(true);
    try {
      // One transaction, Telegram notifications suppressed inside the function
      // — a backlog clear must not send one message per job.
      const { data, error } = await supabase.rpc('fn_bulk_mark_dispatched', {
        p_job_ids: ids,
        p_actor: profile?.id ?? null,
        p_actor_name: profile?.full_name ?? null,
        p_actor_role: profile?.role ?? null,
        p_note: null,
      });
      if (error) throw error;
      const moved = typeof data === 'number' ? data : ids.length;
      toast.success(`${moved} job${moved === 1 ? '' : 's'} marked dispatched.`);
      if (moved < ids.length) toast.info(`${ids.length - moved} skipped — no longer in a QC stage.`);
      setSelectedIds(new Set());
      setSelectMode(false);
      refetchJobs?.();
    } catch (err: any) {
      toast.error('Bulk update failed: ' + (err?.message || String(err)));
    } finally {
      setBulkBusy(false);
    }
  };

  // When Pass is clicked — show packing step first
  const handlePassClick = async () => {
    if (!selectedJob) return;

    const criticalMissed = activeItems.some(cp => cp.critical && !checkpoints[cp.id]?.checked);
    if (criticalMissed) {
      const { confirmed } = await confirm({ title: 'Critical Checkpoints Missing', message: 'Warning: Some critical QC-Dispatch checkpoints are not checked. Pass anyway?', variant: 'danger', confirmLabel: 'Pass Anyway' });
      if (!confirmed) return;
    }

    // Pre-fill qty from job
    setVerifiedQty(String(selectedJob.quantity || ''));
    setShowQtyStep(true);
  };

  // Final submit — quantity only. Packaging happens later, at Pack.
  const handleQCPass = async () => {
    if (!selectedJob) return;

    const qty = Number(verifiedQty) || selectedJob.quantity || 0;
    // packing_info keeps exactly this one field going forward — box/count/
    // weight now live on `packages`, created at the Pack step, once this job
    // (and whichever others join it) reaches Ready. See lib/packing-display.ts.
    const packingInfo = { verified_qty: qty };

    // Save verified qty to job + move to ready
    await updateJob(selectedJob.id, { packing_info: packingInfo } as any);
    await updateJobStage(selectedJob.id, 'ready', `QC-Dispatch Passed. Verified Qty: ${qty}. Note: ${qcNotes}`);

    // Save QC audit record
    const checklistResult: Record<string, boolean> = {};
    activeItems.forEach(cp => { checklistResult[cp.label] = !!checkpoints[cp.id]?.checked; });

    const designFileUrl = selectedJob.files?.find(f =>
      f.type?.startsWith('image/') || f.name?.match(/\.(jpg|jpeg|png|pdf|ai|psd|svg)$/i)
    )?.url || null;

    try {
      await supabase.from('qc_records').insert({
        job_id: selectedJob.id,
        qc_type: 'post_print',
        checklist: checklistResult,
        result: 'passed',
        notes: qcNotes || null,
        performed_by: profile?.id || null,
        performed_by_name: profile?.full_name || 'Unknown',
        design_file_url: designFileUrl,
      });
    } catch (err) {
      console.warn('Could not save QC record:', err);
    }

    // The admin's "invoice & e-way bill needed" alert is NOT sent from here any
    // more: the database refuses dispatch logins writing to a role, so it never
    // arrived. It is now sent by the server when the job reaches 'ready'
    // (app/api/telegram/notify-stage), together with the Telegram alert.

    // Log QC pass
    logActivity('qc', 'Dispatch', selectedJob.id,
      `QC-Dispatch PASSED for ${selectedJob.job_number} (${selectedJob.project_name}) — ${qty} pcs verified. By: ${profile?.full_name || 'dispatch'}`,
      undefined, profile?.id
    );

    setShowQtyStep(false);
    setShowQCModal(false);
  };

  // Handle rework/fail — no packing needed
  const handleQCSubmit = async (status: 'failed' | 'rework') => {
    if (!selectedJob) return;

    await updateJobStage(selectedJob.id, 'printing', `QC-Dispatch Failed/Rework. Reason: ${qcNotes}`);

    // Log to activity
    logActivity('qc', 'Dispatch', selectedJob.id,
      `QC-Dispatch ${status.toUpperCase()} for ${selectedJob.job_number} (${selectedJob.project_name}). Reason: ${qcNotes || 'N/A'}. By: ${profile?.full_name || 'dispatch'}`,
      undefined, profile?.id
    );
    // Save QC audit record
    const checklistResult: Record<string, boolean> = {};
    activeItems.forEach(cp => { checklistResult[cp.label] = !!checkpoints[cp.id]?.checked; });

    const designFileUrl = selectedJob.files?.find(f =>
      f.type?.startsWith('image/') || f.name?.match(/\.(jpg|jpeg|png|pdf|ai|psd|svg)$/i)
    )?.url || null;

    try {
      await supabase.from('qc_records').insert({
        job_id: selectedJob.id,
        qc_type: 'post_print',
        checklist: checklistResult,
        result: status === 'rework' ? 'rework' : 'failed',
        notes: qcNotes || null,
        performed_by: profile?.id || null,
        performed_by_name: profile?.full_name || 'Unknown',
        design_file_url: designFileUrl,
      });
    } catch (err) {
      console.warn('Could not save QC record:', err);
    }

    setShowQCModal(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      {/* An empty QC list reads as "nothing to check" and the operator moves on.
          If the fetch failed, jobs awaiting QC would be skipped entirely — so
          this must announce itself rather than look like a clear queue. */}
      {jobsError && (
        <LoadError variant="inline" what="jobs awaiting QC" error={jobsError} />
      )}
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/dispatch" className="p-2 hover:bg-gray-100 rounded-md lg:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl lg:text-page-title text-gray-900">QC & Dispatch</h1>
          <p className="text-sm text-gray-500">{filteredJobs.length} orders for quality check</p>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-md border border-gray-100 p-3 md:p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-center">
            <p className="text-page-title text-amber-700">{jobs.filter(j => j.current_stage === 'finishing').length}</p>
            <p className="text-xs text-amber-600 font-medium">Pending QC</p>
          </div>
          <div className="bg-muted border border-border rounded-md p-3 text-center">
            <p className="text-page-title text-foreground">{jobs.filter(j => j.current_stage === 'quality_check').length}</p>
            <p className="text-xs text-foreground font-medium">In Progress</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-md p-3 text-center">
            <p className="text-page-title text-green-700">{jobs.filter(j => j.current_stage === 'ready').length}</p>
            <p className="text-xs text-green-600 font-medium">Passed</p>
          </div>
        </div>
      </div>

      {/* Orders Card */}
      <div className="bg-white rounded-md border border-gray-100 p-3 md:p-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending QC</option>
            <option value="in_progress">In Progress</option>
            <option value="passed">Passed</option>
          </select>
          <button
            onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
            className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${selectMode ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}
            title="Select jobs whose goods already physically left and mark them dispatched without the QC checklist"
          >
            {selectMode ? 'Cancel selection' : 'Clear Backlog'}
          </button>
        </div>

        {/* Orders Grid */}
        {filteredJobs.length === 0 && <div className="text-center py-10 text-gray-500">No jobs found.</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              onClick={selectMode ? () => toggleSelected(job.id) : undefined}
              className={`rounded-md p-3 border transition-all ${selectMode
                ? (selectedIds.has(job.id) ? 'border-gray-900 ring-2 ring-gray-900/15 bg-gray-50 cursor-pointer' : 'border-gray-200 cursor-pointer hover:border-gray-400')
                : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
            >
              {/* Top: badges */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{job.job_number}</span>
                {job.priority && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-md font-medium ${getPriorityColor(job.priority)}`}>
                    {job.priority}
                  </span>
                )}
                <span className={`px-1.5 py-0.5 text-xs rounded-md border font-medium ${getStatusColor(job.current_stage)}`}>
                  {getStatusLabel(job.current_stage)}
                </span>
                <ProductBadge category={job.product_category} size="sm" />
              </div>

              {/* Middle: info */}
              <div className="flex items-start gap-2.5">
                <JobThumb job={job as any} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-600 truncate">{job.client?.company || job.client?.name}{job.client?.company && job.client?.name ? ` • ${job.client.name}` : ''}</p>
                  <p className="text-sm text-gray-900 font-medium mt-0.5 line-clamp-2">{job.project_name}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">Qty: {job.quantity}</p>
                <p className="text-xs text-gray-500">Due: <span className="font-medium text-gray-700">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : 'N/A'}</span></p>
              </div>

              {/* Bottom: action */}
              <div className="mt-3 pt-2 border-t border-gray-50">
                {selectMode ? (
                  <div className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium border ${selectedIds.has(job.id) ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    <CheckCircle className="w-4 h-4" /> {selectedIds.has(job.id) ? 'Selected' : 'Tap to select'}
                  </div>
                ) : job.current_stage === 'ready' ? (
                  <div className="flex items-center justify-center gap-1.5 py-1.5 bg-green-50 text-green-700 rounded-md text-sm font-medium">
                    <CheckCircle className="w-4 h-4" /> Passed
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartQC(job, 'post_print')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-white text-sm font-medium bg-gray-900 hover:bg-gray-800 transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    {job.current_stage === 'quality_check' ? 'Continue QC' : 'Start QC'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {selectMode && (
          <div className="sticky bottom-3 mt-4 bg-gray-900 text-white rounded-md p-3 flex flex-wrap items-center gap-2 shadow-lg">
            <p className="text-sm font-medium flex-1 min-w-[180px]">
              {selectedIds.size} selected — only for goods that already physically left
            </p>
            <button onClick={() => setSelectedIds(new Set(filteredJobs.map(j => j.id)))} className="px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 transition-colors">
              Select all ({filteredJobs.length})
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 transition-colors">
              Clear
            </button>
            <button
              disabled={bulkBusy || selectedIds.size === 0}
              onClick={handleBulkDispatch}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {bulkBusy ? 'Working…' : `Mark ${selectedIds.size} Dispatched`}
            </button>
          </div>
        )}
      </div>

      {/* QC Modal */}
      {showQCModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-section text-gray-900">{selectedJob.job_number}</h2>
                  <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${activeQCType === 'pre_print' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                    {activeQCType === 'pre_print' ? 'Pre-Print QC' : 'QC-Dispatch'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5"><JobThumb job={selectedJob as any} size={56} /><p className="text-sm text-gray-500">{selectedJob.project_name}</p></div>
                <div className="flex items-center gap-2 mt-1">
                  <ProductBadge category={selectedJob.product_category} size="sm" />
                  {selectedJob.job_type && <span className="text-xs text-gray-400">{selectedJob.job_type}</span>}
                </div>
              </div>
              <button onClick={() => { setShowQCModal(false); setShowQtyStep(false); }} className="p-2 hover:bg-gray-100 rounded-md">
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>


            {/* Sub Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('design')}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 flex items-center justify-center gap-1 ${activeTab === 'design' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
              >
                <ImageIcon className="w-3 h-3" /> Design
              </button>
              <button
                onClick={() => setActiveTab('checklist')}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 ${activeTab === 'checklist' ? 'text-primary border-primary' : 'text-gray-500 border-transparent'}`}
              >
                Checklist ({activeItems.length})
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 ${activeTab === 'notes' ? 'text-primary border-primary' : 'text-gray-500 border-transparent'}`}
              >
                Notes
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingChecklists ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-gray-500">Loading checklist...</span>
                </div>
              ) : activeTab === 'design' ? (
                <div className="space-y-4">
                  {/* Design file preview */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      Approved Design Files
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">Compare these files with the printed material received</p>
                    {selectedJob.files && selectedJob.files.length > 0 ? (
                      <div className="space-y-2">
                        {selectedJob.files.map((file, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-md overflow-hidden">
                            {file.type?.startsWith('image/') ? (
                              <div>
                                <img src={file.url} alt={file.name} className="w-full max-h-[300px] object-contain bg-gray-50" />
                                <div className="p-2 border-t bg-white">
                                  <p className="text-xs text-gray-600 font-medium">{file.name}</p>
                                  <p className="text-xs text-gray-400">{new Date(file.uploaded_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            ) : (
                              <a href={file.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                                <FileCheck className="w-5 h-5 text-blue-500" />
                                <div>
                                  <p className="text-sm font-medium text-gray-700">{file.name}</p>
                                  <p className="text-xs text-gray-400">{file.type} · {new Date(file.uploaded_at).toLocaleDateString()}</p>
                                </div>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-md">
                        No design files attached to this job
                      </div>
                    )}
                  </div>

                  {/* QC History */}
                  {qcHistory.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        QC History
                      </h3>
                      <div className="space-y-2">
                        {qcHistory.map((record: any) => (
                          <div key={record.id} className={`p-3 rounded-md border text-xs ${record.result === 'passed' ? 'bg-green-50 border-green-200' :
                            record.result === 'failed' ? 'bg-red-50 border-red-200' :
                              'bg-amber-50 border-amber-200'
                            }`}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium capitalize">
                                {record.qc_type?.replace('_', '-')} · {record.result}
                              </span>
                              <span className="text-gray-500">{new Date(record.performed_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-gray-500">
                              <User className="w-3 h-3" />
                              {record.performed_by_name || 'Unknown'}
                            </div>
                            {record.notes && <p className="mt-1 text-gray-600">{record.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'checklist' ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                    {`Based on product: ${normalizeProductCategory(selectedJob.product_category) || 'Default checklist'}`}
                  </p>
                  {activeItems.map((cp) => (
                    <div key={cp.id} className={`p-4 rounded-md border ${checkpoints[cp.id]?.checked ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkpoints[cp.id]?.checked || false}
                          onChange={(e) => updateCheckpoint(cp.id, 'checked', e.target.checked)}
                          className="w-5 h-5 mt-0.5 rounded border-gray-300 text-gray-900"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{cp.label}</span>
                            {cp.critical && <span className="text-xs text-red-500">*Required</span>}
                          </div>
                          {cp.desc && <p className="text-xs text-gray-500">{cp.desc}</p>}
                        </div>
                        {checkpoints[cp.id]?.checked && <CheckCircle className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-900" />}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block text-sm font-medium mb-1">QC / Rework Notes</label>
                  <textarea
                    className="w-full px-4 py-3 border rounded-md h-32"
                    placeholder="Add observations or rework instructions..."
                    value={qcNotes}
                    onChange={e => setQcNotes(e.target.value)}
                  ></textarea>
                </div>
              )}
            </div>

            {/* Actions / Packing Form */}
            {showQtyStep ? (
              <div className="p-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Verified Quantity</h3>
                </div>
                <p className="text-xs text-gray-500 -mt-2">
                  How many pieces did you actually count? A print run can come out a little over or under the ordered quantity.
                  Boxing — and whether this job shares a box with others — happens next, at Pack.
                </p>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Verified Qty</label>
                  <input
                    type="number"
                    value={verifiedQty}
                    onChange={e => setVerifiedQty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    placeholder="e.g. 2500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowQtyStep(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleQCPass}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" /> Complete & Notify Admin
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => handleQCSubmit('failed')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                  title="Send back for Rework"
                >
                  <AlertTriangle className="w-4 h-4" /> Rework
                </button>
                <button
                  onClick={handlePassClick}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-md hover:opacity-90 transition-colors bg-gray-900"
                >
                  <CheckCircle className="w-4 h-4" /> Pass
                </button>
              </div>
            )}
            {/* Admin-only: send the job back a stage (e.g. to Material Received for Printer → Client). */}
            <div className="px-4 pb-4 -mt-1">
              <RollbackJobButton
                jobId={selectedJob.id}
                onDone={() => { setShowQCModal(false); setSelectedJob(null); refetchJobs?.(); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
