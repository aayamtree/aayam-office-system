'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  ClipboardCheck, Loader2, FileCheck, Printer
} from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { Job, JobStatus } from '@/types/database';
import { createBrowserClient } from '@supabase/ssr';
import { useConfirm } from '@/components/ConfirmModal';

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
  { id: 'packaging', label: 'Packaging Done', desc: 'Packed in boxes/sacks', critical: true },
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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { jobs, loading, updateJobStage, updateJob } = useJobs({
    filter: [{ column: 'current_stage', value: ['designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'], op: 'in' }]
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showQCModal, setShowQCModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // QC Type Toggle
  const [activeQCType, setActiveQCType] = useState<QCType>('post_print');

  // Dynamic checklists from DB
  const [prePrintItems, setPrePrintItems] = useState<ChecklistItem[]>([]);
  const [postPrintItems, setPostPrintItems] = useState<ChecklistItem[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);

  // QC Form State (Ephemeral)
  const [checkpoints, setCheckpoints] = useState<Record<string, { checked: boolean; note: string }>>({});
  const [activeTab, setActiveTab] = useState<'checklist' | 'notes'>('checklist');
  const [qcNotes, setQcNotes] = useState('');

  // Load dynamic checklists when a job is selected
  const loadChecklists = useCallback(async (job: Job) => {
    setLoadingChecklists(true);

    try {
      // Fetch pre-print checklists (category = 'design') matching product category
      const productCategory = job.product_category || '';
      const { data: designChecklists } = await supabase
        .from('job_checklists')
        .select('*')
        .eq('category', 'design');

      // Fetch post-print checklists (category = 'dispatch') matching job type
      const { data: dispatchChecklists } = await supabase
        .from('job_checklists')
        .select('*')
        .eq('category', 'dispatch');

      // Find matching checklist for this job's product category (pre-print)
      let preItems: ChecklistItem[] = [];
      if (designChecklists && designChecklists.length > 0) {
        // Try to find exact match first
        const match = designChecklists.find(c =>
          c.job_type?.toLowerCase() === productCategory.toLowerCase()
        );
        const checklist = match || designChecklists[0]; // Fall back to first checklist
        const items = typeof checklist.items === 'string' ? JSON.parse(checklist.items) : checklist.items;
        preItems = (items || []).map((item: string, idx: number) => ({
          id: `pre_${idx}`,
          label: item,
          desc: '',
          critical: idx < 2, // First 2 items are critical by default
        }));
      }
      setPrePrintItems(preItems.length > 0 ? preItems : FALLBACK_PRE_PRINT);

      // Find matching checklist for this job's job type (post-print)
      let postItems: ChecklistItem[] = [];
      const jobType = job.job_type || '';
      if (dispatchChecklists && dispatchChecklists.length > 0) {
        const match = dispatchChecklists.find(c =>
          c.job_type?.toLowerCase() === jobType.toLowerCase()
        );
        const checklist = match || dispatchChecklists[0];
        const items = typeof checklist.items === 'string' ? JSON.parse(checklist.items) : checklist.items;
        postItems = (items || []).map((item: string, idx: number) => ({
          id: `post_${idx}`,
          label: item,
          desc: '',
          critical: idx < 2,
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

  // Get the currently active checklist items
  const activeItems = activeQCType === 'pre_print' ? prePrintItems : postPrintItems;

  // Filter jobs relevant for QC
  const relevantJobs = jobs.filter(j =>
    ['finishing', 'quality_check', 'ready', 'designing', 'approval', 'printing'].includes(j.current_stage)
  );

  const filteredJobs = relevantJobs.filter(job => {
    const matchesSearch =
      job.job_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'pending' && job.current_stage === 'finishing') ||
      (statusFilter === 'in_progress' && job.current_stage === 'quality_check') ||
      (statusFilter === 'passed' && job.current_stage === 'ready') ||
      (statusFilter === 'pre_print' && ['designing', 'approval', 'printing'].includes(job.current_stage));

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'designing':
      case 'approval':
      case 'printing':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'finishing': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'quality_check': return 'bg-muted text-foreground border-border';
      case 'ready': return 'bg-gray-100 text-gray-900 border-green-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'designing':
      case 'approval':
      case 'printing':
        return 'Pre-Print QC';
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
    setShowQCModal(true);

    // Load dynamic checklists
    await loadChecklists(job);
  };

  const updateCheckpoint = (id: string, field: 'checked' | 'note', value: boolean | string) => {
    setCheckpoints(prev => ({
      ...prev,
      [id]: { ...prev[id] || { checked: false, note: '' }, [field]: value }
    }));
  };

  const handleQCSubmit = async (status: 'passed' | 'failed' | 'rework') => {
    if (!selectedJob) return;

    const qcLabel = activeQCType === 'pre_print' ? 'Pre-Print QC' : 'Post-Print QC';

    if (status === 'passed') {
      const criticalMissed = activeItems.some(cp => cp.critical && !checkpoints[cp.id]?.checked);
      if (criticalMissed) {
        const { confirmed } = await confirm({ title: 'Critical Checkpoints Missing', message: `Warning: Some critical ${qcLabel} checkpoints are not checked. Pass anyway?`, variant: 'danger', confirmLabel: 'Pass Anyway' });
        if (!confirmed) return;
      }

      if (activeQCType === 'post_print') {
        await updateJobStage(selectedJob.id, 'ready', `${qcLabel} Passed. Note: ${qcNotes}`);
      } else {
        // Pre-print QC passed — update job with qc_status
        await updateJob(selectedJob.id, { qc_status: 'passed' } as any);
        // Add a note to stage history
        await updateJobStage(selectedJob.id, selectedJob.current_stage, `${qcLabel} Passed. Note: ${qcNotes}`);
      }
    } else if (status === 'rework' || status === 'failed') {
      if (activeQCType === 'post_print') {
        await updateJobStage(selectedJob.id, 'printing', `${qcLabel} Failed/Rework. Reason: ${qcNotes}`);
      } else {
        await updateJob(selectedJob.id, { qc_status: 'failed' } as any);
        await updateJobStage(selectedJob.id, 'designing', `${qcLabel} Failed/Rework. Reason: ${qcNotes}`);
      }
    }

    setShowQCModal(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/dispatch" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl lg:text-page-title text-gray-900">QC Check</h1>
          <p className="text-sm text-gray-500">{filteredJobs.length} orders for quality check</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <p className="text-page-title text-purple-700">{jobs.filter(j => ['designing', 'approval', 'printing'].includes(j.current_stage)).length}</p>
          <p className="text-xs text-purple-600 font-medium">Pre-Print</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-page-title text-amber-700">{jobs.filter(j => j.current_stage === 'finishing').length}</p>
          <p className="text-xs text-destructive font-medium">Post-Print Pending</p>
        </div>
        <div className="bg-muted border border-border rounded-lg p-3 text-center">
          <p className="text-page-title text-foreground">{jobs.filter(j => j.current_stage === 'quality_check').length}</p>
          <p className="text-xs text-foreground font-medium">In Progress</p>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-3 text-center">
          <p className="text-page-title text-gray-900">{jobs.filter(j => j.current_stage === 'ready').length}</p>
          <p className="text-xs text-gray-900 font-medium">Passed</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 md:w-4.5 md:h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          <option value="all">All Status</option>
          <option value="pre_print">Pre-Print QC</option>
          <option value="pending">Post-Print Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="passed">Passed</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 && <div className="text-center py-10 text-gray-500">No jobs found.</div>}
        {filteredJobs.map((job) => {
          const isPrePrintStage = ['designing', 'approval', 'printing'].includes(job.current_stage);

          return (
            <div key={job.id} className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 md:gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{job.job_number}</span>
                    {job.priority && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(job.priority)}`}>
                        {job.priority}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(job.current_stage)}`}>
                      {getStatusLabel(job.current_stage)}
                    </span>
                    {job.product_category && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {job.product_category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{job.client?.company} • {job.client?.name}</p>
                  <p className="text-sm text-gray-900 font-medium mt-1">{job.project_name}</p>
                  <p className="text-xs text-gray-500 mt-1">Qty: {job.quantity}</p>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Due</p>
                    <p className="font-medium text-gray-900">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : 'N/A'}</p>
                  </div>

                  {job.current_stage === 'ready' ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg">
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Passed</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {/* Pre-Print QC Button */}
                      {isPrePrintStage && (
                        <button
                          onClick={() => handleStartQC(job, 'pre_print')}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-purple-600 hover:bg-purple-700"
                        >
                          <FileCheck className="w-4 h-4" />
                          <span className="hidden sm:inline">Pre-Print QC</span>
                        </button>
                      )}

                      {/* Post-Print QC Button */}
                      {!isPrePrintStage && (
                        <button
                          onClick={() => handleStartQC(job, 'post_print')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${job.current_stage === 'quality_check' ? 'bg-gray-900 hover:opacity-90' : 'bg-gray-900 hover:bg-gray-800'
                            }`}
                        >
                          <ClipboardCheck className="w-4 h-4" />
                          <span className="hidden sm:inline">{job.current_stage === 'quality_check' ? 'Continue QC' : 'Post-Print QC'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* QC Modal */}
      {showQCModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-section text-gray-900">{selectedJob.job_number}</h2>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${activeQCType === 'pre_print' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                    {activeQCType === 'pre_print' ? 'Pre-Print QC' : 'Post-Print QC'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{selectedJob.project_name}</p>
                {selectedJob.product_category && (
                  <p className="text-xs text-gray-400 mt-1">
                    Product: {selectedJob.product_category} • Type: {selectedJob.job_type || 'N/A'}
                  </p>
                )}
              </div>
              <button onClick={() => setShowQCModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* QC Type Toggle */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveQCType('pre_print')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 ${activeQCType === 'pre_print' ? 'text-purple-600 border-purple-600' : 'text-gray-500 border-transparent'}`}
              >
                <FileCheck className="w-4 h-4" />
                Pre-Print QC
              </button>
              <button
                onClick={() => setActiveQCType('post_print')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 ${activeQCType === 'post_print' ? 'text-orange-600 border-orange-600' : 'text-gray-500 border-transparent'}`}
              >
                <Printer className="w-4 h-4" />
                Post-Print QC
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-gray-100">
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
              ) : activeTab === 'checklist' ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                    {activeQCType === 'pre_print'
                      ? `Based on product: ${selectedJob.product_category || 'Default'}`
                      : `Based on job type: ${selectedJob.job_type || 'Default'}`
                    }
                  </p>
                  {activeItems.map((cp) => (
                    <div key={cp.id} className={`p-4 rounded-lg border ${checkpoints[cp.id]?.checked ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200'
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
                    className="w-full px-4 py-3 border rounded-lg h-32"
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                title="Send back for Rework"
              >
                <AlertTriangle className="w-4 h-4" /> Rework
              </button>
              <button
                onClick={() => handleQCSubmit('passed')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg hover:opacity-90 transition-colors ${activeQCType === 'pre_print' ? 'bg-purple-600' : 'bg-gray-900'
                  }`}
              >
                <CheckCircle className="w-4 h-4" /> Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
