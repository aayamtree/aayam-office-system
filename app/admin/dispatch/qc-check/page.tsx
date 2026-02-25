'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  ClipboardCheck, Loader2, FileCheck, Printer, Image, Clock, User
} from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Job, JobStatus } from '@/types/database';
import { createBrowserClient } from '@supabase/ssr';
import { Package } from 'lucide-react';
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
  const { profile } = useAuth();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { jobs, loading, updateJobStage, updateJob } = useJobs({
    filter: [{ column: 'current_stage', value: ['finishing', 'quality_check', 'ready'], op: 'in' }]
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  // Packing details step (shown after QC passes)
  const [showPackingStep, setShowPackingStep] = useState(false);
  const [packingForm, setPackingForm] = useState({
    verified_qty: '',
    package_type: 'box' as 'box' | 'sack' | 'bundle' | 'pallet' | 'other',
    package_count: '',
    approx_weight_kg: '',
    packing_notes: '',
  });

  // QC history for selected job
  const [qcHistory, setQcHistory] = useState<any[]>([]);

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
    setShowQCModal(true);

    // Load dynamic checklists
    await loadChecklists(job);

    // Load QC history
    try {
      const { data } = await supabase
        .from('qc_records')
        .select('*')
        .eq('job_id', job.id)
        .order('performed_at', { ascending: false });
      setQcHistory(data || []);
    } catch {
      setQcHistory([]);
    }
  };

  const updateCheckpoint = (id: string, field: 'checked' | 'note', value: boolean | string) => {
    setCheckpoints(prev => ({
      ...prev,
      [id]: { ...prev[id] || { checked: false, note: '' }, [field]: value }
    }));
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
    setPackingForm(prev => ({ ...prev, verified_qty: String(selectedJob.quantity || '') }));
    setShowPackingStep(true);
  };

  // Final submit with packing details
  const handleFinalSubmit = async () => {
    if (!selectedJob) return;

    const packingInfo = {
      verified_qty: Number(packingForm.verified_qty) || selectedJob.quantity || 0,
      package_type: packingForm.package_type,
      package_count: Number(packingForm.package_count) || 0,
      approx_weight_kg: Number(packingForm.approx_weight_kg) || 0,
      packing_notes: packingForm.packing_notes || '',
    };

    // Save packing info to job + move to ready
    await updateJob(selectedJob.id, { packing_info: packingInfo } as any);
    await updateJobStage(selectedJob.id, 'ready', `QC-Dispatch Passed. Qty: ${packingInfo.verified_qty} | ${packingInfo.package_count} ${packingInfo.package_type}(s) | ~${packingInfo.approx_weight_kg}kg. Note: ${qcNotes}`);

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

    // Rich notification to admin with packing details
    try {
      const checkedCount = activeItems.filter(cp => checkpoints[cp.id]?.checked).length;
      await supabase.from('broadcast_notifications').insert({
        message: `📋 ${selectedJob.job_number} passed QC — Invoice & E-Way Bill needed\n` +
          `Client: ${selectedJob.client?.company || selectedJob.client?.name || 'N/A'}\n` +
          `Project: ${selectedJob.project_name}\n` +
          `Qty: ${packingInfo.verified_qty} | ${packingInfo.package_count} ${packingInfo.package_type}(s) | ~${packingInfo.approx_weight_kg} kg\n` +
          `QC: ${checkedCount}/${activeItems.length} checks passed\n` +
          `QC By: ${profile?.full_name || 'Unknown'}`,
        target_audience: 'admin',
        priority: 'urgent',
      });
    } catch (err) {
      console.warn('Could not send invoice notification:', err);
    }

    setShowPackingStep(false);
    setShowQCModal(false);
  };

  // Handle rework/fail — no packing needed
  const handleQCSubmit = async (status: 'failed' | 'rework') => {
    if (!selectedJob) return;

    await updateJobStage(selectedJob.id, 'printing', `QC-Dispatch Failed/Rework. Reason: ${qcNotes}`);

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
      <div className="bg-white rounded-lg border border-gray-100 p-3 md:p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-page-title text-amber-700">{jobs.filter(j => j.current_stage === 'finishing').length}</p>
            <p className="text-xs text-amber-600 font-medium">Pending QC</p>
          </div>
          <div className="bg-muted border border-border rounded-md p-3 text-center">
            <p className="text-page-title text-foreground">{jobs.filter(j => j.current_stage === 'quality_check').length}</p>
            <p className="text-xs text-foreground font-medium">In Progress</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-page-title text-green-700">{jobs.filter(j => j.current_stage === 'ready').length}</p>
            <p className="text-xs text-green-600 font-medium">Passed</p>
          </div>
        </div>
      </div>

      {/* Orders Card */}
      <div className="bg-white rounded-lg border border-gray-100 p-3 md:p-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending QC</option>
            <option value="in_progress">In Progress</option>
            <option value="passed">Passed</option>
          </select>
        </div>

        {/* Orders Grid */}
        {filteredJobs.length === 0 && <div className="text-center py-10 text-gray-500">No jobs found.</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredJobs.map((job) => (
            <div key={job.id} className="rounded-lg p-3 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
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
                {job.product_category && (
                  <span className="px-1.5 py-0.5 text-xs rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    {job.product_category}
                  </span>
                )}
              </div>

              {/* Middle: info */}
              <p className="text-sm text-gray-600 truncate">{job.client?.company} • {job.client?.name}</p>
              <p className="text-sm text-gray-900 font-medium mt-0.5 truncate">{job.project_name}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">Qty: {job.quantity}</p>
                <p className="text-xs text-gray-500">Due: <span className="font-medium text-gray-700">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : 'N/A'}</span></p>
              </div>

              {/* Bottom: action */}
              <div className="mt-3 pt-2 border-t border-gray-50">
                {job.current_stage === 'ready' ? (
                  <div className="flex items-center justify-center gap-1.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
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
                  <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${activeQCType === 'pre_print' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                    {activeQCType === 'pre_print' ? 'Pre-Print QC' : 'QC-Dispatch'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{selectedJob.project_name}</p>
                {selectedJob.product_category && (
                  <p className="text-xs text-gray-400 mt-1">
                    Product: {selectedJob.product_category} • Type: {selectedJob.job_type || 'N/A'}
                  </p>
                )}
              </div>
              <button onClick={() => setShowQCModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>


            {/* Sub Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('design')}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 flex items-center justify-center gap-1 ${activeTab === 'design' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
              >
                <Image className="w-3 h-3" /> Design
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
                      <Image className="w-4 h-4 text-blue-500" />
                      Approved Design Files
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">Compare these files with the printed material received</p>
                    {selectedJob.files && selectedJob.files.length > 0 ? (
                      <div className="space-y-2">
                        {selectedJob.files.map((file, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
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
                      <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-lg">
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
                          <div key={record.id} className={`p-3 rounded-lg border text-xs ${record.result === 'passed' ? 'bg-green-50 border-green-200' :
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
                    className="w-full px-4 py-3 border rounded-md h-32"
                    placeholder="Add observations or rework instructions..."
                    value={qcNotes}
                    onChange={e => setQcNotes(e.target.value)}
                  ></textarea>
                </div>
              )}
            </div>

            {/* Actions / Packing Form */}
            {showPackingStep ? (
              <div className="p-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Packing Details for Invoice & E-Way Bill</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Verified Qty</label>
                    <input
                      type="number"
                      value={packingForm.verified_qty}
                      onChange={e => setPackingForm(p => ({ ...p, verified_qty: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                      placeholder="e.g. 2500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Package Type</label>
                    <select
                      value={packingForm.package_type}
                      onChange={e => setPackingForm(p => ({ ...p, package_type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                      <option value="box">Box</option>
                      <option value="sack">Sack</option>
                      <option value="bundle">Bundle</option>
                      <option value="pallet">Pallet</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">No. of Packages</label>
                    <input
                      type="number"
                      value={packingForm.package_count}
                      onChange={e => setPackingForm(p => ({ ...p, package_count: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Approx Weight (kg)</label>
                    <input
                      type="number"
                      value={packingForm.approx_weight_kg}
                      onChange={e => setPackingForm(p => ({ ...p, approx_weight_kg: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                      placeholder="e.g. 120"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Packing Notes (optional)</label>
                  <input
                    type="text"
                    value={packingForm.packing_notes}
                    onChange={e => setPackingForm(p => ({ ...p, packing_notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    placeholder="e.g. Fragile, handle with care"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowPackingStep(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleFinalSubmit}
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
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
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
          </div>
        </div>
      )}
    </div>
  );
}
