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
      'designing': 'bg-oms-blue text-white border-[rgba(0,0,255,0.2)]-200',
      'approval': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'printing': 'bg-blue-100 text-blue-700 border-blue-200',
      'finishing': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'dispatched': 'bg-orange-100 text-orange-700 border-orange-200',
      'delivered': 'bg-gray-100 text-gray-900 border-green-200',
      'cancelled': 'bg-red-50 text-red-700 border-red-200',
      'on_hold': 'bg-gray-200 text-gray-800 border-gray-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-600',
      'normal': 'bg-blue-50 text-blue-600',
      'high': 'bg-orange-100 text-orange-600',
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
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-oms-blue" /></div>;
  }

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-3">
        <Link href="/admin/jobs" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg md:text-xl lg:text-page-title text-gray-900">Job Queue</h1>
          <p className="text-xs md:text-sm text-gray-500">{filteredJobs.length} jobs in system</p>
        </div>
      </div>

      {/* Stats Cards - Updated Layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-oms-blue border border-[rgba(0,0,255,0.2)]-200 rounded-lg md:rounded-xl p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Clock size={14} className="text-oms-blue md:hidden" />
            <Clock size={16} className="text-oms-blue hidden md:block" />
            <span className="text-[10px] md:text-xs text-oms-blue font-medium">Design Stage</span>
          </div>
          <p className="text-xl md:text-page-title text-oms-blue">{designCount}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg md:rounded-xl p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Printer size={14} className="text-blue-600 md:hidden" />
            <Printer size={16} className="text-blue-600 hidden md:block" />
            <span className="text-[10px] md:text-xs text-blue-600 font-medium">In Production</span>
          </div>
          <p className="text-xl md:text-page-title text-blue-700">{productionCount}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-lg md:rounded-xl p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <CheckCircle size={14} className="text-gray-900 md:hidden" />
            <CheckCircle size={16} className="text-gray-900 hidden md:block" />
            <span className="text-[10px] md:text-xs text-gray-900 font-medium">Dispatched</span>
          </div>
          <p className="text-xl md:text-page-title text-gray-900">{dispatchedCount}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg md:rounded-xl p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-600 md:hidden" />
            <AlertTriangle size={16} className="text-red-600 hidden md:block" />
            <span className="text-[10px] md:text-xs text-red-600 font-medium">High Priority</span>
          </div>
          <p className="text-xl md:text-page-title text-red-700">{urgentCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* ... (keep search filters same) */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
        >
          <option value="all">All Status</option>
          {statusFlow.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Jobs List Render - Modern Card Design */}
      <div className="space-y-4">
        {filteredJobs.length === 0 && <div className="text-center py-10 text-gray-500">No jobs found matching criteria.</div>}
        {filteredJobs.map((job) => {
          // Determine header color based on status
          const headerColors: Record<string, string> = {
            'new': 'bg-gradient-to-r from-blue-500 to-blue-600',
            'designing': 'bg-gradient-to-r from-oms-blue to-blue-600',
            'approval': 'bg-gradient-to-r from-yellow-400 to-yellow-500',
            'printing': 'bg-gradient-to-r from-purple-500 to-purple-600',
            'finishing': 'bg-gradient-to-r from-pink-500 to-pink-600',
            'quality_check': 'bg-gradient-to-r from-orange-500 to-orange-600',
            'ready': 'bg-gradient-to-r from-green-500 to-green-600',
            'dispatched': 'bg-gradient-to-r from-cyan-500 to-cyan-600',
            'delivered': 'bg-gradient-to-r from-gray-400 to-gray-500',
            'cancelled': 'bg-gradient-to-r from-red-500 to-red-600',
            'on_hold': 'bg-gradient-to-r from-gray-500 to-gray-600',
          };
          const headerBg = headerColors[job.current_stage] || 'bg-gradient-to-r from-gray-400 to-gray-500';
          const headerTextColor = job.current_stage === 'approval' ? 'text-gray-900' : 'text-white';
          const isUrgent = ['high', 'urgent'].includes(job.priority);

          return (
            <div key={job.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border ${isUrgent ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'}`}>
              {/* Colored Header Tab */}
              <div className={`${headerBg} px-5 py-3 flex items-center justify-between`}>
                <span className={`${headerTextColor} font-semibold text-sm md:text-base`}>
                  {job.job_number}
                </span>
                <div className="flex items-center gap-2">
                  {isUrgent && (
                    <span className={`${headerTextColor}/90 text-xs px-3 py-1 bg-white/30 rounded-full font-bold uppercase`}>
                      {job.priority}
                    </span>
                  )}
                  <span className={`${headerTextColor}/90 text-xs px-3 py-1 bg-white/20 rounded-full font-medium capitalize`}>
                    {job.current_stage.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* White Card Body */}
              <div className="p-5">
                {/* Client/Subtitle */}
                <p className="text-gray-500 text-sm mb-1">
                  {job.client?.company || job.client?.name || 'Unknown Client'}
                </p>

                {/* Project Name */}
                <h3 className="text-gray-900 font-bold text-lg mb-3">
                  {job.job_type}: {job.project_name}
                </h3>

                {/* Details Row */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-medium">Qty: {job.quantity}</span>
                    <span>Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  {job.designer?.name && (
                    <span className="text-oms-blue text-sm font-medium">
                      🎨 {job.designer.name}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleView(job)}
                    className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    <span className="hidden sm:inline">View Details</span>
                  </button>
                  {job.current_stage !== 'delivered' && job.current_stage !== 'cancelled' && (
                    <button
                      onClick={() => handleMoveToNext(job)}
                      className={`px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 ${job.current_stage === 'dispatched'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-oms-blue text-white hover:bg-blue-700'
                        }`}
                    >
                      {job.current_stage === 'new' && <Play size={18} />}
                      {job.current_stage !== 'new' && job.current_stage !== 'dispatched' && <ArrowRight size={18} />}
                      {job.current_stage === 'dispatched' && <CheckCircle size={18} />}
                      <span className="hidden md:inline">
                        {job.current_stage === 'new' ? 'Start' : job.current_stage === 'dispatched' ? 'Mark Delivered' : 'Next Stage'}
                      </span>
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
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-section text-gray-900">Job Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className={`p-4 rounded-xl text-center capitalize ${selectedJob.current_stage === 'delivered' ? 'bg-white text-gray-900' : selectedJob.current_stage === 'dispatched' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                <p className="text-section">{selectedJob.current_stage}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Job No.</span><span className="font-medium text-gray-900">{selectedJob.job_number}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Client</span><span className="font-medium text-gray-900">{selectedJob.client?.name}</span></div>
                <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-500 text-sm">Description</span><p className="font-medium text-gray-900 mt-1">{selectedJob.project_name}</p></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Quantity</span><span className="font-medium text-gray-900">{selectedJob.quantity}</span></div>
                {selectedJob.designer?.name && <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Designer</span><span className="font-medium text-oms-blue">{selectedJob.designer.name}</span></div>}
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
                        <div className={`px-3 py-1.5 rounded-lg text-label whitespace-nowrap capitalize transition-all transform group-hover:scale-105 ${isCurrent ? 'bg-oms-blue text-white ring-2 ring-oms-blue/20' :
                          isCompleted ? 'bg-gray-100 text-gray-900 hover:bg-green-200' :
                            'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                          }`}>
                          {status}
                        </div>
                        {idx < statusFlow.length - 1 && (
                          <ArrowRight size={12} className={`mx-1 ${isCompleted ? 'text-green-500' : 'text-gray-300'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={() => setShowViewModal(false)} className="w-full px-4 py-2.5 bg-oms-blue text-white rounded-xl hover:bg-blue-600">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
