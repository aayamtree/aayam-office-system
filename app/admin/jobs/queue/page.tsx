'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, Eye, X, Clock,
  Printer, CheckCircle, AlertTriangle, Play, ArrowRight, Loader2
} from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { Job, JobStatus } from '@/types/database';

// Mapping DB statuses to a display flow
const statusFlow: JobStatus[] = ['new', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready', 'dispatched', 'delivered'];

export default function JobQueuePage() {
  const { jobs, loading, updateJobStage, updateJob } = useJobs();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

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
    if (confirm(`Move job to ${newStage}?`)) {
      await updateJobStage(selectedJob.id, newStage as JobStatus);
      // Optimistically update selectedJob local state so UI reflects change immediately
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

      {/* View Modal with Interactive Workflow */}
      {showViewModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-section text-gray-900">Job Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-4 rounded-xl text-center capitalize bg-gray-100 text-gray-900">
                <p className="text-section">{selectedJob.current_stage}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-gray-50 rounded-md"><span className="text-gray-500">Job No.</span><span className="font-medium text-gray-900">{selectedJob.job_number}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-md"><span className="text-gray-500">Client</span><span className="font-medium text-gray-900">{selectedJob.client?.name}</span></div>
                <div className="p-3 bg-gray-50 rounded-md"><span className="text-gray-500 text-sm">Description</span><p className="font-medium text-gray-900 mt-1">{selectedJob.project_name}</p></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-md"><span className="text-gray-500">Quantity</span><span className="font-medium text-gray-900">{selectedJob.quantity}</span></div>
                {selectedJob.designer?.name && <div className="flex justify-between p-3 bg-gray-50 rounded-md"><span className="text-gray-500">Designer</span><span className="font-medium text-gray-900">{selectedJob.designer.name}</span></div>}
              </div>

              {/* Status Progress - Interactive */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Workflow (Click to change)</p>
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
                        <div className={`px-3 py-1.5 rounded-lg text-label whitespace-nowrap capitalize transition-all transform group-hover:scale-105 ${isCurrent ? 'bg-gray-900 text-white ring-2 ring-gray-300' :
                          isCompleted ? 'bg-gray-700 text-white hover:bg-gray-600' :
                            'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                          }`}>
                          {status}
                        </div>
                        {idx < statusFlow.length - 1 && (
                          <ArrowRight className={`w-3 h-3 mx-1 ${isCompleted ? 'text-foreground' : 'text-gray-300'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={() => setShowViewModal(false)} className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
