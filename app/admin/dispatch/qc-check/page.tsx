'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  ClipboardCheck, Camera, Image, Maximize2, Loader2
} from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { Job, JobStatus } from '@/types/database';

// Checklist items (Client-side only for now)
const qcCheckpoints = [
  { id: 'color_accuracy', label: 'Color Accuracy', desc: 'Colors are accurate', critical: true },
  { id: 'print_quality', label: 'Print Quality', desc: 'No smudges, sharp & aligned', critical: true },
  { id: 'paper_material', label: 'Paper/Material', desc: 'Correct paper type & GSM', critical: false },
  { id: 'quantity', label: 'Quantity Verified', desc: 'Count checked (may vary slightly)', critical: false },
  { id: 'finishing', label: 'Finishing', desc: 'Lamination, binding, cutting OK', critical: false },
  { id: 'packaging', label: 'Packaging Done', desc: 'Packed in boxes/sacks', critical: true },
];

export default function QCCheckPage() {
  const { jobs, loading, updateJobStage, updateJob } = useJobs();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showQCModal, setShowQCModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // QC Form State (Ephemeral)
  const [checkpoints, setCheckpoints] = useState<Record<string, { checked: boolean; note: string }>>({});
  const [activeTab, setActiveTab] = useState<'checklist' | 'notes'>('checklist');
  const [qcNotes, setQcNotes] = useState('');

  // Filter jobs relevant for QC (Printing, Finishing, QC, Ready)
  // 'ready' implies passed, 'quality_check' implies in progress, 'finishing' implies pending
  const relevantJobs = jobs.filter(j =>
    ['finishing', 'quality_check', 'ready'].includes(j.current_stage)
  );

  const filteredJobs = relevantJobs.filter(job => {
    const matchesSearch =
      job.job_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    // Custom status filter mapping
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'pending' && job.current_stage === 'finishing') ||
      (statusFilter === 'in_progress' && job.current_stage === 'quality_check') ||
      (statusFilter === 'passed' && job.current_stage === 'ready');

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finishing': return 'bg-gray-100 text-gray-700 border-gray-200'; // Pending QC start
      case 'quality_check': return 'bg-blue-100 text-blue-700 border-blue-200'; // In Progress
      case 'ready': return 'bg-green-100 text-green-700 border-green-200'; // Passed
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'urgent' || priority === 'high') return 'bg-red-100 text-red-700';
    if (priority === 'low') return 'bg-gray-100 text-gray-600';
    return 'bg-blue-50 text-blue-600';
  };

  const handleStartQC = async (job: Job) => {
    if (job.current_stage === 'finishing') {
      await updateJobStage(job.id, 'quality_check');
    }
    setSelectedJob(job);
    setCheckpoints({});
    setQcNotes(job.notes || '');
    setShowQCModal(true);
  };

  const updateCheckpoint = (id: string, field: 'checked' | 'note', value: boolean | string) => {
    setCheckpoints(prev => ({
      ...prev,
      [id]: { ...prev[id] || { checked: false, note: '' }, [field]: value }
    }));
  };

  const handleQCSubmit = async (status: 'passed' | 'failed' | 'rework') => {
    if (!selectedJob) return;

    if (status === 'passed') {
      // Check critical checkpoints? (Optional enforcement)
      const criticalMissed = qcCheckpoints.some(cp => cp.critical && !checkpoints[cp.id]?.checked);
      if (criticalMissed) {
        if (!confirm('Warning: Some critical checkpoints are not checked. Pass anyway?')) return;
      }

      await updateJobStage(selectedJob.id, 'ready', `QC Passed. Note: ${qcNotes}`);
    } else if (status === 'rework' || status === 'failed') {
      await updateJobStage(selectedJob.id, 'printing', `QC Failed/Rework. Reason: ${qcNotes}`);
    }

    setShowQCModal(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-oms-blue" /></div>;

  return (
    <div className="space-y-4 lg:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/dispatch" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">QC Check</h1>
          <p className="text-sm text-gray-500">{filteredJobs.length} orders for quality check</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{jobs.filter(j => j.current_stage === 'finishing').length}</p>
          <p className="text-xs text-amber-600 font-medium">Pending (Finishing)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{jobs.filter(j => j.current_stage === 'quality_check').length}</p>
          <p className="text-xs text-blue-600 font-medium">In Progress</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{jobs.filter(j => j.current_stage === 'ready').length}</p>
          <p className="text-xs text-green-600 font-medium">Passed (Ready)</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="passed">Passed</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 && <div className="text-center py-10 text-gray-500">No jobs found.</div>}
        {filteredJobs.map((job) => (
          <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{job.job_number}</span>
                  {/* <span className="text-xs text-gray-400">• {job.invoiceNumber}</span> */}
                  {job.priority && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(job.priority)}`}>
                      {job.priority}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(job.current_stage)}`}>
                    {job.current_stage === 'finishing' ? 'Pending' : job.current_stage === 'quality_check' ? 'In QC' : 'Passed'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{job.client?.company} • {job.client?.name}</p>
                <p className="text-sm text-gray-900 font-medium mt-1">{job.project_name}</p>
                <p className="text-xs text-gray-500 mt-1">Qty: {job.quantity}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Due</p>
                  <p className="font-medium text-gray-900">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : 'N/A'}</p>
                </div>

                {job.current_stage === 'ready' ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl">
                    <CheckCircle size={16} />
                    <span className="hidden sm:inline">Passed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartQC(job)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white ${job.current_stage === 'quality_check' ? 'bg-oms-blue hover:opacity-90' : 'bg-gray-900 hover:bg-black'
                      }`}
                  >
                    <ClipboardCheck size={16} />
                    <span className="hidden sm:inline">{job.current_stage === 'quality_check' ? 'Continue QC' : 'Start QC'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QC Modal */}
      {showQCModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedJob.job_number}</h2>
                <p className="text-sm text-gray-500">{selectedJob.project_name}</p>
              </div>
              <button onClick={() => setShowQCModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <XCircle size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('checklist')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'checklist' ? 'text-oms-blue border-indigo-600' : 'text-gray-500 border-transparent'}`}
              >
                Checklist
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'notes' ? 'text-oms-blue border-indigo-600' : 'text-gray-500 border-transparent'}`}
              >
                Notes
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'checklist' && (
                <div className="space-y-3">
                  {qcCheckpoints.map((cp) => (
                    <div key={cp.id} className={`p-4 rounded-xl border ${checkpoints[cp.id]?.checked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkpoints[cp.id]?.checked || false}
                          onChange={(e) => updateCheckpoint(cp.id, 'checked', e.target.checked)}
                          className="w-5 h-5 mt-0.5 rounded border-gray-300 text-green-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{cp.label}</span>
                            {cp.critical && <span className="text-xs text-red-500">*Required</span>}
                          </div>
                          <p className="text-xs text-gray-500">{cp.desc}</p>
                        </div>
                        {checkpoints[cp.id]?.checked && <CheckCircle size={18} className="text-green-600" />}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium mb-1">QC / Rework Notes</label>
                  <textarea
                    className="w-full px-4 py-3 border rounded-xl h-32"
                    placeholder="Add observations or rework instructions..."
                    value={qcNotes}
                    onChange={e => setQcNotes(e.target.value)}
                  ></textarea>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => handleQCSubmit('failed')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                title="Send back for Rework"
              >
                <AlertTriangle size={16} /> Rework
              </button>
              <button
                onClick={() => handleQCSubmit('passed')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
              >
                <CheckCircle size={16} /> Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
