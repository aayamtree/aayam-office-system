'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, CheckCircle, Truck, Clock, AlertTriangle, ClipboardCheck, Loader2, X, Camera, MapPin, Building2, Search, FileText } from 'lucide-react';
import { useJobs, useDispatches } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Job, Dispatch } from '@/types/database';
import { supabase } from '@/lib/supabase';

// ─── Print Run type (minimal for dispatch view) ──────────────
interface PrintRunForDispatch {
  id: string;
  print_run_number: string;
  status: string;
  delivery_mode?: string;
  delivery_address?: string;
  vendor_id?: string;
  transporter_name?: string;
  eway_bill_number?: string;
  dispatch_date?: string;
  invoice_reference?: string;
  qc_checklist?: Record<string, boolean>;
  qc_notes?: string;
  created_at: string;
  updated_at?: string;
  vendor?: { name: string; company?: string };
  print_run_jobs?: {
    id: string;
    client_name?: string;
    item_name?: string;
    quantity_needed?: number;
    job?: { job_number?: string; client_deadline?: string; priority?: string; client?: { company?: string; name?: string } };
  }[];
}

// ─── Transporter vendor ──────────────────────────────────────
interface TransporterVendor {
  id: string;
  name: string;
  company?: string;
}

export default function DispatchPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, updateJobStage } = useJobs({
    filter: [{ column: 'current_stage', value: ['quality_check', 'ready'], op: 'in' }],
    orderBy: { column: 'client_deadline', ascending: true }
  });
  const { dispatches, loading: dispatchesLoading, createDispatch } = useDispatches();

  // Print runs data
  const [printRuns, setPrintRuns] = useState<PrintRunForDispatch[]>([]);
  const [printRunsLoading, setPrintRunsLoading] = useState(true);

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

  // Tab
  const [activeTab, setActiveTab] = useState<'jobs' | 'print_runs'>('jobs');

  const loading = jobsLoading || dispatchesLoading || printRunsLoading;

  // ─── Fetch print runs that dispatch team cares about ──────
  useEffect(() => {
    const fetchPrintRuns = async () => {
      setPrintRunsLoading(true);
      try {
        const { data } = await supabase
          .from('print_runs')
          .select('*, vendor:vendors!print_runs_vendor_id_fkey(name, company), print_run_jobs(*, job:jobs(job_number, client_deadline, priority, client:clients(company, name)))')
          .in('status', ['printing_done', 'qc', 'dispatched'])
          .order('created_at', { ascending: false });
        setPrintRuns(data || []);
      } catch (err) {
        console.error('Error fetching print runs:', err);
      } finally {
        setPrintRunsLoading(false);
      }
    };
    fetchPrintRuns();

    // Fetch transporters
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
  // Jobs
  const pendingQC = jobs.filter(j => j.current_stage === 'quality_check');
  const readyToDispatch = jobs.filter(j => j.current_stage === 'ready');

  // Print Runs
  const printRunsQC = printRuns.filter(pr => pr.status === 'qc');
  const printRunsReady = printRuns.filter(pr => pr.status === 'printing_done' && pr.delivery_mode === 'warehouse');
  const printRunsDispatched = printRuns.filter(pr => pr.status === 'dispatched');

  const sentDispatches = dispatches.slice(0, 5);

  // Delayed count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delayedCount = jobs.filter(j => {
    if (!j.client_deadline) return false;
    const deadline = new Date(j.client_deadline);
    return deadline < today && !['delivered', 'completed', 'cancelled', 'dispatched'].includes(j.current_stage);
  }).length;

  // Combined stats
  const totalPendingQC = pendingQC.length + printRunsQC.length;
  const totalReady = readyToDispatch.length + printRunsReady.length;
  const totalDispatched = dispatches.length + printRunsDispatched.length;

  const stats = [
    { label: 'Pending QC', value: totalPendingQC.toString(), sub: `${pendingQC.length} jobs · ${printRunsQC.length} runs`, icon: ClipboardCheck, color: 'bg-purple-500' },
    { label: 'Ready to Dispatch', value: totalReady.toString(), sub: `${readyToDispatch.length} jobs · ${printRunsReady.length} runs`, icon: Package, color: 'bg-primary' },
    { label: 'Dispatched', value: totalDispatched.toString(), sub: 'All time', icon: Truck, color: 'bg-green-500' },
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
      case 'printing_done': return 'Printing Done';
      case 'qc': return 'In QC';
      default: return status;
    }
  };

  const getPrintRunStatusColor = (status: string) => {
    switch (status) {
      case 'printing_done': return 'bg-blue-100 text-blue-800';
      case 'qc': return 'bg-purple-100 text-purple-800';
      case 'dispatched': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-700';
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
      alert('Order marked as Dispatched!');
    } catch (err: any) {
      alert('Error dispatching: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-page-title text-gray-900">Dispatch Command Center</h1>
          <p className="text-sm md:text-base text-gray-500">Welcome, {profile?.full_name || 'Dispatcher'} | QC & Logistics</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/dispatch/qc-check"
            className="flex items-center gap-2 bg-purple-600 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-lg hover:bg-purple-700 transition-colors shadow-sm font-semibold text-sm"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Start QC</span>
          </Link>
          <Link
            href="/admin/print-runs"
            className="flex items-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm font-semibold text-sm"
          >
            <Package className="w-4 h-4" />
            <span>Print Runs</span>
          </Link>
        </div>
      </div>

      {/* Stats — now unified */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className={`w-8 h-8 md:w-10 md:h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
            </div>
            <p className="text-page-title text-gray-900">{loading ? '...' : stat.value}</p>
            <p className="text-xs lg:text-sm text-gray-500 mt-1">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'jobs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Individual Jobs ({pendingQC.length + readyToDispatch.length})
        </button>
        <button
          onClick={() => setActiveTab('print_runs')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'print_runs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Print Runs ({printRunsQC.length + printRunsReady.length})
        </button>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* JOBS TAB                                        */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'jobs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {/* Pending QC */}
          <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section text-gray-900 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-purple-500" />
                Pending QC
              </h2>
              <Link href="/admin/dispatch/qc-check" className="text-sm text-primary hover:underline">View All →</Link>
            </div>
            <div className="space-y-2">
              {pendingQC.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">No jobs pending QC</div>
              ) : pendingQC.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{job.job_number}</p>
                      {job.priority === 'urgent' && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full font-medium">Urgent</span>}
                    </div>
                    <p className="text-xs text-gray-600">{job.client?.company || job.client?.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{job.project_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-500">Due</p>
                    <p className="text-xs font-medium text-gray-900">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ready to Dispatch */}
          <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-green-500" />
                Ready to Dispatch
              </h2>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">{readyToDispatch.length} ready</span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {readyToDispatch.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">No jobs ready for dispatch</div>
              ) : readyToDispatch.map((job) => {
                const hasInvoice = (job as any).invoices && (job as any).invoices.length > 0;
                return (
                  <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-green-100 rounded-lg gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{job.job_number}</p>
                      <p className="text-xs text-gray-600">{job.client?.company || job.client?.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{job.project_name} · Qty: {job.quantity}</p>
                      {(job as any).packing_info && (
                        <p className="text-[11px] text-green-700 mt-0.5 font-medium">
                          📦 {(job as any).packing_info.package_count} {(job as any).packing_info.package_type}(s) · ~{(job as any).packing_info.approx_weight_kg}kg
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right hidden sm:block">
                        <p className="text-[11px] text-gray-500">Due</p>
                        <p className="text-xs font-medium">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : '-'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!hasInvoice && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
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
                            className={`px-2 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${invoiceRequested.has(job.id)
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            title={invoiceRequested.has(job.id) ? 'Invoice request sent' : 'Send invoice request to admin'}
                          >
                            <FileText className="w-3 h-3 inline mr-1" />
                            {invoiceRequested.has(job.id) ? 'Requested ✓' : 'Request Invoice'}
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDispatch(job)}
                          className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg whitespace-nowrap ${hasInvoice ? 'bg-gray-900 hover:bg-gray-800' : 'bg-amber-500 hover:bg-amber-600'}`}
                          title={hasInvoice ? 'Proceed to Dispatch' : 'No invoice yet — can still dispatch'}
                        >
                          {hasInvoice ? 'Dispatch Now' : '⚠️ Dispatch (No Invoice)'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* PRINT RUNS TAB                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'print_runs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {/* Print Runs in QC */}
          <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section text-gray-900 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-purple-500" />
                Print Runs — QC
              </h2>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">{printRunsQC.length} in QC</span>
            </div>
            <div className="space-y-2">
              {printRunsQC.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">No print runs in QC</div>
              ) : printRunsQC.map(pr => (
                <div key={pr.id} className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{pr.print_run_number}</p>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full ${getPrintRunStatusColor(pr.status)}`}>
                        {getStatusLabel(pr.status)}
                      </span>
                    </div>
                    <Link href="/admin/print-runs" className="text-xs text-primary hover:underline">Open →</Link>
                  </div>
                  <p className="text-xs text-gray-500">Printer: {pr.vendor?.name || pr.vendor?.company || '-'}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {pr.print_run_jobs?.slice(0, 3).map(j => (
                      <span key={j.id} className="px-2 py-0.5 bg-white border text-[10px] rounded text-gray-600">
                        {j.job?.job_number || j.client_name || j.item_name}
                      </span>
                    ))}
                    {(pr.print_run_jobs?.length || 0) > 3 && (
                      <span className="text-[10px] text-gray-400">+{(pr.print_run_jobs?.length || 0) - 3} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Print Runs Ready / Printing Done */}
          <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                Print Runs — Printing Done
              </h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">{printRunsReady.length} waiting</span>
            </div>
            <div className="space-y-2">
              {printRunsReady.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">No print runs waiting for dispatch</div>
              ) : printRunsReady.map(pr => (
                <div key={pr.id} className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{pr.print_run_number}</p>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full ${getPrintRunStatusColor(pr.status)}`}>
                        Printing Done
                      </span>
                    </div>
                    <Link href="/admin/print-runs" className="text-xs text-primary hover:underline">Open →</Link>
                  </div>
                  <p className="text-xs text-gray-500">Printer: {pr.vendor?.name || pr.vendor?.company || '-'}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {pr.print_run_jobs?.slice(0, 3).map(j => (
                      <span key={j.id} className="px-2 py-0.5 bg-white border text-[10px] rounded text-gray-600">
                        {j.job?.job_number || j.client_name || j.item_name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Dispatches (unified) */}
      <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section text-gray-900">Recent Dispatches</h2>
          <Link href="/admin/dispatch/history" className="text-sm text-primary hover:underline">View All →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
          {/* Job dispatches */}
          {sentDispatches.length === 0 && printRunsDispatched.length === 0 && (
            <div className="col-span-3 text-center text-gray-400 py-4 text-sm">No recent dispatches</div>
          )}
          {sentDispatches.map((dispatch) => (
            <div key={dispatch.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900 text-sm">{dispatch.dispatch_number}</p>
                <span className={`px-2 py-0.5 text-[10px] rounded-full ${getStatusColor(dispatch.status)}`}>
                  {getStatusLabel(dispatch.status)}
                </span>
              </div>
              <p className="text-xs text-gray-600">{dispatch.client?.company || dispatch.client?.name}</p>
              <p className="text-[11px] text-gray-400 mt-1">Packages: {dispatch.packages}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-[11px] text-gray-500">{dispatch.transporter_name || 'Self'}</span>
                <span className="text-[11px] text-gray-500">{dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString() : '-'}</span>
              </div>
            </div>
          ))}
          {/* Print run dispatches */}
          {printRunsDispatched.slice(0, 3).map((pr) => (
            <div key={pr.id} className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900 text-sm">{pr.print_run_number}</p>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-100 text-green-800">
                  Print Run
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {pr.print_run_jobs?.map(j => j.client_name || j.job?.job_number).filter(Boolean).slice(0, 2).join(', ') || 'No jobs'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {pr.delivery_mode === 'direct_to_client' ? '📦 Direct to Client' : '🏭 Via Warehouse'}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-[11px] text-gray-500">{pr.transporter_name || 'Self'}</span>
                <span className="text-[11px] text-gray-500">{pr.dispatch_date ? new Date(pr.dispatch_date).toLocaleDateString() : new Date(pr.updated_at || pr.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* DISPATCH MODAL                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {showDispatchModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-section">Create Dispatch</h2>
                <p className="text-sm text-gray-500">Order #{selectedJob.job_number}</p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Transporter</label>
                  {transporters.length > 0 ? (
                    <select
                      value={dispatchForm.transporter_name}
                      onChange={e => setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Self / Manual</option>
                      {transporters.map(t => (
                        <option key={t.id} value={t.name}>{t.name}{t.company ? ` (${t.company})` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="e.g. DTDC, Self"
                      value={dispatchForm.transporter_name} onChange={e => setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tracking / LR No</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.tracking_number} onChange={e => setDispatchForm({ ...dispatchForm, tracking_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Vehicle No</label>
                  <input type="text" placeholder="e.g. OD-02-AA-1234"
                    value={dispatchForm.vehicle_number} onChange={e => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Packages Count</label>
                  <input type="number" min="1"
                    value={dispatchForm.packages} onChange={e => setDispatchForm({ ...dispatchForm, packages: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Driver Name</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.driver_name} onChange={e => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Driver Phone</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.driver_phone} onChange={e => setDispatchForm({ ...dispatchForm, driver_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea rows={2} placeholder="Any delivery instructions..."
                  value={dispatchForm.notes} onChange={e => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-500 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                This will move the order to &quot;Dispatched&quot; and create a dispatch record.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDispatchModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 shadow-sm font-semibold text-sm">
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
