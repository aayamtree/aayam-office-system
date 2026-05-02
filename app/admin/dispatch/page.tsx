'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { Package, CheckCircle, Truck, Clock, AlertTriangle, ClipboardCheck, Loader2, X, Camera, MapPin, Building2, Search, FileText, ShieldCheck } from 'lucide-react';
import { useJobs, useDispatches } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Job, Dispatch } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { getStageName, getStageColor } from '@/lib/job-workflow';

// ─── Transporter vendor ──────────────────────────────────────
interface TransporterVendor {
  id: string;
  name: string;
  company?: string;
}

export default function DispatchPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, updateJobStage } = useJobs({
    filter: [{ column: 'current_stage', value: ['pre_print_qc', 'quality_check', 'ready'], op: 'in' }],
    orderBy: { column: 'client_deadline', ascending: true }
  });
  const { dispatches, loading: dispatchesLoading, createDispatch } = useDispatches();

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
    packages: 1,
    notes: '',
  });

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
  const prePrintQC = jobs.filter(j => j.current_stage === 'pre_print_qc');
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
    { label: 'Pre Print QC', value: prePrintQC.length.toString(), sub: `${prePrintQC.length} awaiting file check`, icon: ShieldCheck, color: 'bg-cyan-500' },
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
      driver_name: '', driver_phone: '', packages: job.quantity || 1, notes: '',
    });
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);

    try {
      const result = await createDispatch({
        job_id: selectedJob.id,
        client_id: selectedJob.client_id,
        status: 'dispatched',
        dispatch_date: new Date().toISOString(),
        ...dispatchForm
      } as any);

      if (result.error) throw new Error(result.error);

      await updateJobStage(selectedJob.id, 'dispatched',
        `Dispatched via ${dispatchForm.transporter_name || 'Self'}. Tracking: ${dispatchForm.tracking_number || 'N/A'}`
      );

      // Save QC record for traceability
      try {
        await supabase.from('qc_records').insert({
          job_id: selectedJob.id,
          qc_type: 'post_print',
          checklist: {},
          result: 'passed',
          notes: `Dispatched via ${dispatchForm.transporter_name || 'Self'}`,
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
        {prePrintQC.length === 0 && pendingQC.length === 0 && readyToDispatch.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500">No jobs pending QC or dispatch</div>
        )}

        {/* ── Pre Print QC ── */}
        {prePrintQC.map((job) => {
          const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
          return (
            <div key={job.id} className={`bg-card rounded-md border border-border border-l-4 border-l-cyan-400 hover:shadow-sm transition-shadow ${isOverdue ? 'ring-1 ring-red-200' : ''}`}>
              <div className="bg-cyan-50/60 px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md">
                <span className="text-[10px] font-mono text-muted-foreground">#{job.job_number}</span>
                <div className="flex items-center gap-1">
                  {job.priority === 'urgent' && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">Urgent</span>}
                  <span className="text-[9px] px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded font-semibold uppercase">Pre Print QC</span>
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
                  {['design_only', 'Design Only'].includes(job.job_type || '') ? (
                    <button onClick={() => updateJobStage(job.id, 'delivered')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors">
                      <CheckCircle className="w-3 h-3" /> File OK → Deliver
                    </button>
                  ) : (
                    <button onClick={() => updateJobStage(job.id, 'printing')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 text-white rounded text-xs font-medium hover:bg-cyan-700 transition-colors">
                      <ShieldCheck className="w-3 h-3" /> File OK → Print
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* ── QC & Dispatch ── */}
        {pendingQC.map((job) => {
          const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
          return (
            <div key={job.id} className={`bg-card rounded-md border border-border border-l-4 border-l-violet-400 hover:shadow-sm transition-shadow ${isOverdue ? 'ring-1 ring-red-200' : ''}`}>
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
          const hasInvoice = (job as any).invoices && (job as any).invoices.length > 0;
          const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
          return (
            <div key={job.id} className={`bg-card rounded-md border border-border border-l-4 border-l-green-400 hover:shadow-sm transition-shadow ${isOverdue ? 'ring-1 ring-red-200' : ''}`}>
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
                    <button
                      onClick={async () => {
                        if (invoiceRequested.has(job.id)) return;
                        try {
                          await supabase.from('broadcast_notifications').insert({
                            message: `🔔 Dispatch requesting invoice for ${job.job_number}\nClient: ${job.client?.company || job.client?.name || 'N/A'}\nProject: ${job.project_name}`,
                            target_audience: 'admin',
                            priority: 'urgent',
                          });
                          setInvoiceRequested(prev => new Set(Array.from(prev).concat(job.id)));
                        } catch (err) {
                          console.warn('Failed to send invoice request:', err);
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${invoiceRequested.has(job.id)
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <FileText className="w-3 h-3" />
                      {invoiceRequested.has(job.id) ? 'Requested ✓' : 'Request Invoice'}
                    </button>
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
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-sm font-medium mb-1">Tracking / LR No</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.tracking_number} onChange={e => setDispatchForm({ ...dispatchForm, tracking_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Vehicle No</label>
                  <input type="text" placeholder="e.g. OD-02-AA-1234"
                    value={dispatchForm.vehicle_number} onChange={e => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Packages Count</label>
                  <input type="number" min="1"
                    value={dispatchForm.packages} onChange={e => setDispatchForm({ ...dispatchForm, packages: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Driver Name</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.driver_name} onChange={e => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Driver Phone</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.driver_phone} onChange={e => setDispatchForm({ ...dispatchForm, driver_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
              </div>

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
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold text-sm">
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
