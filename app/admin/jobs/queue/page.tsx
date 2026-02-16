'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, Eye, X, Clock,
  Printer, CheckCircle, AlertTriangle, Play, ArrowRight, Loader2
} from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { Job, JobStatus } from '@/types/database';
import { useConfirm } from '@/components/ConfirmModal';

// Mapping DB statuses to a display flow
const statusFlow: JobStatus[] = ['new', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready', 'dispatched', 'delivered'];

export default function JobQueuePage() {
  const { jobs, loading, updateJobStage, updateJob } = useJobs({
    filter: [{ column: 'current_stage', value: ['new', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready', 'dispatched'], op: 'in' }],
    limit: 100
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const confirm = useConfirm();

  // Filter for active print-relevant jobs if needed, but for now we show all
  const filteredJobs = jobs.filter(job => {
    const clientName = job.client?.name || '';
    const clientCompany = job.client?.company || '';
    const matchesSearch =
      job.job_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientCompany.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || job.current_stage === statusFilter;

    // Optional: Filter out 'delivered' or 'cancelled' if we only want active queue?
    // For now, let's keep them but maybe default filter could be 'active'
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-gray-100 text-gray-700 border-gray-200',
      'designing': 'bg-gray-800 text-white border-gray-700',
      'approval': 'bg-gray-600 text-white border-gray-500',
      'printing': 'bg-gray-700 text-white border-gray-600',
      'finishing': 'bg-gray-500 text-white border-gray-400',
      'dispatched': 'bg-gray-300 text-gray-900 border-gray-400',
      'delivered': 'bg-gray-100 text-gray-900 border-gray-200',
      'cancelled': 'bg-red-50 text-red-700 border-red-200',
      'on_hold': 'bg-gray-200 text-gray-800 border-gray-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-600',
      'normal': 'bg-gray-200 text-gray-700',
      'high': 'bg-gray-600 text-white',
      'urgent': 'bg-red-100 text-red-600',
    };
    return colors[priority] || 'bg-gray-100 text-gray-600';
  };

  const getNextStatus = (currentStatus: JobStatus): JobStatus | null => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex !== -1 && currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const handleView = (job: Job) => {
    setSelectedJob(job);
    setShowViewModal(true);
  };

  const handleMoveToNext = async (job: Job) => {
    const nextStatus = getNextStatus(job.current_stage);
    if (nextStatus) {
      await updateJobStage(job.id, nextStatus);
    }
  };

  // Stats Logic Refined
  const designCount = jobs.filter(j => ['new', 'designing', 'approval'].includes(j.current_stage)).length;
  const productionCount = jobs.filter(j => ['printing', 'finishing', 'quality_check', 'ready'].includes(j.current_stage)).length;
  const dispatchedCount = jobs.filter(j => j.current_stage === 'dispatched').length;
  const urgentCount = jobs.filter(j => ['high', 'urgent'].includes(j.priority) && j.current_stage !== 'delivered').length;

  const handleStageSelect = async (newStage: string) => {
    if (!selectedJob) return;
    const { confirmed } = await confirm({ title: 'Move Job', message: `Move job to ${newStage}?`, confirmLabel: 'Move' });
    if (confirmed) {
      await updateJobStage(selectedJob.id, newStage as JobStatus);
      setSelectedJob({ ...selectedJob, current_stage: newStage as JobStatus });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-3">
        <Link href="/admin/jobs" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-page-title text-gray-900">Job Queue</h1>
          <p className="text-xs md:text-sm text-gray-500">{filteredJobs.length} jobs in system</p>
        </div>
      </div>

      {/* Stats Cards - Updated Layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Clock className="w-4 h-4 text-white md:hidden" />
            <Clock className="w-4 h-4 text-white hidden md:block" />
            <span className="text-xs md:text-xs text-white font-medium">Design Stage</span>
          </div>
          <p className="text-page-title text-white">{designCount}</p>
        </div>
        <div className="bg-muted border border-border rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Printer className="w-4 h-4 text-foreground md:hidden" />
            <Printer className="w-4 h-4 text-foreground hidden md:block" />
            <span className="text-xs md:text-xs text-foreground font-medium">In Production</span>
          </div>
          <p className="text-page-title text-foreground">{productionCount}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-gray-900 md:hidden" />
            <CheckCircle className="w-4 h-4 text-gray-900 hidden md:block" />
            <span className="text-xs md:text-xs text-gray-900 font-medium">Dispatched</span>
          </div>
          <p className="text-page-title text-gray-900">{dispatchedCount}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600 md:hidden" />
            <AlertTriangle className="w-4 h-4 text-red-600 hidden md:block" />
            <span className="text-xs md:text-xs text-red-600 font-medium">High Priority</span>
          </div>
          <p className="text-page-title text-red-700">{urgentCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* ... (keep search filters same) */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 md:w-4.5 md:h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          <option value="all">All Status</option>
          {statusFlow.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Jobs Grid - Compact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredJobs.length === 0 && <div className="col-span-full text-center py-10 text-gray-500">No jobs found matching criteria.</div>}
        {filteredJobs.map((job) => {
          const headerColors: Record<string, string> = {
            'new': 'bg-gray-800',
            'designing': 'bg-gray-900',
            'approval': 'bg-gray-700',
            'printing': 'bg-gray-800',
            'finishing': 'bg-gray-600',
            'quality_check': 'bg-gray-700',
            'ready': 'bg-gray-500',
            'dispatched': 'bg-gray-400',
            'delivered': 'bg-gray-200',
            'cancelled': 'bg-red-500',
            'on_hold': 'bg-gray-600',
          };
          const headerBg = headerColors[job.current_stage] || 'bg-gray-500';
          const headerTextColor = job.current_stage === 'delivered' ? 'text-gray-900' : 'text-white';
          const isUrgent = ['high', 'urgent'].includes(job.priority);

          return (
            <div key={job.id} className={`bg-white rounded-md overflow-hidden border hover:shadow-sm transition-all ${isUrgent ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}>
              {/* Header */}
              <div className={`${headerBg} px-3 py-2 flex items-center justify-between`}>
                <span className={`${headerTextColor} font-semibold text-sm`}>
                  {job.job_number}
                </span>
                <div className="flex items-center gap-1.5">
                  {isUrgent && (
                    <span className="text-xs px-2 py-0.5 bg-white/25 rounded-md font-bold uppercase text-white">
                      {job.priority}
                    </span>
                  )}
                  <span className={`${headerTextColor}/90 text-xs px-2 py-0.5 bg-white/15 rounded-md font-medium capitalize`}>
                    {job.current_stage.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-3">
                <p className="text-gray-500 text-xs mb-0.5">
                  {job.client?.company || job.client?.name || 'Unknown Client'}
                </p>
                <h3 className="text-gray-900 font-semibold text-sm mb-2 line-clamp-1">
                  {job.job_type}: {job.project_name}
                </h3>

                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span>Qty: {job.quantity}</span>
                  <span>Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : 'N/A'}</span>
                  {job.designer?.name && <span className="text-gray-700 font-medium ml-auto">🎨 {job.designer.name}</span>}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleView(job)}
                    className="flex-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                  {job.current_stage !== 'delivered' && job.current_stage !== 'cancelled' && (
                    <button
                      onClick={() => handleMoveToNext(job)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 bg-gray-900 text-white hover:bg-gray-800"
                    >
                      {job.current_stage === 'new' && <Play className="w-3.5 h-3.5" />}
                      {job.current_stage !== 'new' && job.current_stage !== 'dispatched' && <ArrowRight className="w-3.5 h-3.5" />}
                      {job.current_stage === 'dispatched' && <CheckCircle className="w-3.5 h-3.5" />}
                      {job.current_stage === 'new' ? 'Start' : job.current_stage === 'dispatched' ? 'Delivered' : 'Next'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enhanced Job Details Modal */}
      {showViewModal && selectedJob && (() => {
        const stage = selectedJob.current_stage;
        const deadlineDays = selectedJob.client_deadline
          ? Math.ceil((new Date(selectedJob.client_deadline).getTime() - Date.now()) / 86400000)
          : null;
        const balance = (selectedJob.total_amount || 0) - (selectedJob.amount_received || 0);

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowViewModal(false)}>
            <div className="bg-card rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-section text-foreground font-bold">{selectedJob.job_number}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium capitalize ${getStatusColor(stage)}`}>
                    {stage.replace('_', ' ')}
                  </span>
                  {['high', 'urgent'].includes(selectedJob.priority) && (
                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${getPriorityColor(selectedJob.priority)}`}>
                      {selectedJob.priority}
                    </span>
                  )}
                  {selectedJob.is_on_hold && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-medium">⏸ ON HOLD</span>
                  )}
                </div>
                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Basic Info */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start p-2.5 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground">Client</span>
                    <div className="text-right">
                      <p className="font-medium text-sm text-foreground">{selectedJob.client?.company || selectedJob.client?.name || '—'}</p>
                      {selectedJob.client?.company && selectedJob.client?.name && (
                        <p className="text-xs text-muted-foreground">{selectedJob.client.name}</p>
                      )}
                      {selectedJob.client?.phone && (
                        <p className="text-xs text-muted-foreground">{selectedJob.client.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground">Project</span>
                    <p className="font-medium text-sm text-foreground mt-0.5">{selectedJob.project_name || '—'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="p-2.5 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground block">Type</span>
                      <span className="font-medium text-sm text-foreground capitalize">{selectedJob.job_type?.replace('_', ' ') || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground block">Qty</span>
                      <span className="font-medium text-sm text-foreground">
                        {selectedJob.quantity?.toLocaleString()}
                        {selectedJob.actual_quantity && selectedJob.actual_quantity !== selectedJob.quantity && (
                          <span className="text-xs text-muted-foreground ml-1">(actual: {selectedJob.actual_quantity})</span>
                        )}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-md ${deadlineDays !== null && deadlineDays < 0 ? 'bg-red-50' : deadlineDays !== null && deadlineDays <= 1 ? 'bg-amber-50' : 'bg-muted'}`}>
                      <span className="text-xs text-muted-foreground block">Deadline</span>
                      {selectedJob.client_deadline ? (
                        <>
                          <span className="font-medium text-sm text-foreground">{new Date(selectedJob.client_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          <span className={`text-xs ml-1 ${deadlineDays !== null && deadlineDays < 0 ? 'text-red-600 font-semibold' : deadlineDays !== null && deadlineDays <= 1 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {deadlineDays !== null && deadlineDays < 0 ? `${Math.abs(deadlineDays)}d overdue` : deadlineDays === 0 ? 'Today' : deadlineDays === 1 ? 'Tomorrow' : `${deadlineDays}d left`}
                          </span>
                        </>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </div>
                </div>

                {/* Hold Reason */}
                {selectedJob.is_on_hold && selectedJob.hold_reason && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md">
                    <span className="text-xs text-amber-700 font-semibold">⏸ Hold Reason</span>
                    <p className="text-sm text-amber-800 mt-0.5">{selectedJob.hold_reason}</p>
                  </div>
                )}

                {/* Stage-Specific Context Panel */}
                <div className="border border-border rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-muted border-b border-border">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      {stage === 'new' && '📋 New Order'}
                      {stage === 'designing' && '🎨 Design Stage'}
                      {stage === 'approval' && '✅ Client Approval'}
                      {stage === 'printing' && '🖨️ Production'}
                      {stage === 'finishing' && '✂️ Finishing'}
                      {stage === 'quality_check' && '🔍 Quality Check'}
                      {stage === 'ready' && '📦 Ready for Dispatch'}
                      {stage === 'dispatched' && '🚚 Dispatched'}
                      {stage === 'delivered' && '✅ Delivered'}
                    </p>
                  </div>
                  <div className="p-3 space-y-2 text-sm">
                    {/* NEW */}
                    {stage === 'new' && (
                      <>
                        <div className="flex justify-between"><span className="text-muted-foreground">Order Date</span><span className="font-medium">{selectedJob.order_date ? new Date(selectedJob.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></div>
                        {selectedJob.sales_person && <div className="flex justify-between"><span className="text-muted-foreground">Sales Person</span><span className="font-medium">{selectedJob.sales_person.full_name || '—'}</span></div>}
                        {selectedJob.notes && <div><span className="text-muted-foreground">Notes</span><p className="mt-0.5 text-foreground">{selectedJob.notes}</p></div>}
                        {!selectedJob.notes && !selectedJob.sales_person && <p className="text-muted-foreground text-xs italic">Order received. Ready to start design or production.</p>}
                      </>
                    )}

                    {/* DESIGNING */}
                    {stage === 'designing' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Designer</span>
                          <span className="font-semibold text-foreground">{selectedJob.designer?.name || <span className="text-amber-600 italic">Not assigned</span>}</span>
                        </div>
                        {selectedJob.designer?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Designer Phone</span><span className="font-medium">{selectedJob.designer.phone}</span></div>}
                        {selectedJob.file_version && <div className="flex justify-between"><span className="text-muted-foreground">File Version</span><span className="font-medium">{selectedJob.file_version}</span></div>}
                        {selectedJob.notes && <div><span className="text-muted-foreground">Design Notes</span><p className="mt-0.5 text-foreground">{selectedJob.notes}</p></div>}
                        {!selectedJob.designer?.name && <p className="text-amber-600 text-xs">⚠ No designer assigned. Please assign one from the Jobs page.</p>}
                      </>
                    )}

                    {/* APPROVAL */}
                    {stage === 'approval' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Approval Status</span>
                          <span className={`font-semibold px-2 py-0.5 rounded text-xs ${selectedJob.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                              selectedJob.approval_status === 'changes_requested' ? 'bg-red-100 text-red-700' :
                                selectedJob.approval_status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                            }`}>
                            {selectedJob.approval_status?.replace('_', ' ') || 'pending'}
                          </span>
                        </div>
                        {selectedJob.designer?.name && <div className="flex justify-between"><span className="text-muted-foreground">Designer</span><span className="font-medium">{selectedJob.designer.name}</span></div>}
                        {selectedJob.approval_date && <div className="flex justify-between"><span className="text-muted-foreground">Sent On</span><span className="font-medium">{new Date(selectedJob.approval_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>}
                        {selectedJob.approval_remark && <div><span className="text-muted-foreground">Client Remark</span><p className="mt-0.5 text-foreground italic">"{selectedJob.approval_remark}"</p></div>}
                        {selectedJob.file_version && <div className="flex justify-between"><span className="text-muted-foreground">File Version</span><span className="font-medium">{selectedJob.file_version}</span></div>}
                      </>
                    )}

                    {/* PRINTING */}
                    {stage === 'printing' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Print Ready</span>
                          <span className={`font-semibold ${selectedJob.print_ready ? 'text-green-600' : 'text-amber-600'}`}>
                            {selectedJob.print_ready ? '✅ Yes' : '⏳ Not Yet'}
                          </span>
                        </div>
                        {selectedJob.vendor?.name && (
                          <>
                            <div className="flex justify-between"><span className="text-muted-foreground">Vendor / Printer</span><span className="font-semibold text-foreground">{selectedJob.vendor.name}</span></div>
                            {selectedJob.vendor?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Vendor Phone</span><span className="font-medium">{selectedJob.vendor.phone}</span></div>}
                          </>
                        )}
                        {!selectedJob.vendor?.name && <div className="flex justify-between"><span className="text-muted-foreground">Production</span><span className="font-medium text-foreground">In-house</span></div>}
                        {selectedJob.designer?.name && <div className="flex justify-between"><span className="text-muted-foreground">Designed by</span><span className="font-medium">{selectedJob.designer.name}</span></div>}
                      </>
                    )}

                    {/* FINISHING / QUALITY CHECK */}
                    {(stage === 'finishing' || stage === 'quality_check') && (
                      <>
                        {selectedJob.qc_status && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">QC Status</span>
                            <span className={`font-semibold px-2 py-0.5 rounded text-xs capitalize ${selectedJob.qc_status === 'passed' ? 'bg-green-100 text-green-700' :
                                selectedJob.qc_status === 'failed' ? 'bg-red-100 text-red-700' :
                                  selectedJob.qc_status === 'hold' ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-700'
                              }`}>
                              {selectedJob.qc_status}
                            </span>
                          </div>
                        )}
                        {selectedJob.vendor?.name && <div className="flex justify-between"><span className="text-muted-foreground">Printed by</span><span className="font-medium">{selectedJob.vendor.name}</span></div>}
                        {selectedJob.actual_quantity && <div className="flex justify-between"><span className="text-muted-foreground">Actual Output</span><span className="font-medium">{selectedJob.actual_quantity.toLocaleString()}</span></div>}
                        {!selectedJob.qc_status && <p className="text-muted-foreground text-xs italic">QC check pending.</p>}
                      </>
                    )}

                    {/* READY */}
                    {stage === 'ready' && (
                      <>
                        <p className="text-green-700 font-medium">✅ Job is ready for dispatch</p>
                        {selectedJob.actual_quantity && <div className="flex justify-between"><span className="text-muted-foreground">Final Quantity</span><span className="font-medium">{selectedJob.actual_quantity.toLocaleString()}</span></div>}
                        {selectedJob.client?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Client Phone</span><span className="font-medium">{selectedJob.client.phone}</span></div>}
                      </>
                    )}

                    {/* DISPATCHED */}
                    {stage === 'dispatched' && (
                      <>
                        <p className="text-blue-700 font-medium">🚚 Job has been dispatched</p>
                        {selectedJob.client?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Client Phone</span><span className="font-medium">{selectedJob.client.phone}</span></div>}
                      </>
                    )}

                    {/* DELIVERED */}
                    {stage === 'delivered' && (
                      <>
                        <p className="text-green-700 font-medium">✅ Job delivered successfully</p>
                        {selectedJob.completed_date && <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="font-medium">{new Date(selectedJob.completed_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}
                      </>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-md text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold text-foreground">₹{(selectedJob.total_amount || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Received</p>
                    <p className="font-semibold text-green-600">₹{(selectedJob.amount_received || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{balance.toLocaleString('en-IN')}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium capitalize ${selectedJob.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      selectedJob.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                    }`}>
                    {selectedJob.payment_status || 'unpaid'}
                  </span>
                </div>

                {/* Status Progress - Interactive */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Workflow (Click to change)</p>
                  <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
                    {statusFlow.map((status, idx) => {
                      const currentIdx = statusFlow.indexOf(selectedJob.current_stage);
                      const isCompleted = currentIdx !== -1 && idx <= currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <button
                          key={status}
                          type="button"
                          className="flex items-center group cursor-pointer focus:outline-none"
                          onClick={() => handleStageSelect(status)}
                          title={`Move to ${status}`}
                        >
                          <div className={`px-3 py-1.5 rounded-lg text-label whitespace-nowrap capitalize transition-all transform group-hover:scale-105 ${isCurrent ? 'bg-primary text-primary-foreground ring-2 ring-ring/30' :
                            isCompleted ? 'bg-primary/80 text-primary-foreground hover:bg-primary/70' :
                              'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}>
                            {status.replace('_', ' ')}
                          </div>
                          {idx < statusFlow.length - 1 && (
                            <ArrowRight className={`w-3 h-3 mx-1 ${isCompleted ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={() => setShowViewModal(false)} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
