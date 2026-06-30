'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, Eye, X, Clock,
  Printer, CheckCircle, AlertTriangle, Play, ArrowRight,
  Loader2, Palette, ClipboardCheck, Package, Truck,
  ChevronDown, ChevronUp, Send, UserCheck
} from 'lucide-react';
import { useJobs, useDesigners } from '@/lib/hooks';
import { Job, JobStatus } from '@/types/database';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { getWorkflowForJobType, getNextStage, normalizeJobType } from '@/lib/job-workflow';

// ─── Type-driven Stage Flows ─────────────────────────────────────────────────
// Single source of truth: lib/job-workflow.ts. Each job type is a filtered view
// of the one master pipeline.
function getFlowForJob(job: Job): JobStatus[] {
  return getWorkflowForJobType(job.job_type) as JobStatus[];
}

/** Human-readable label for the next pipeline action on a card. */
function getNextLabel(job: Job): string {
  const next = getNextStage(job.job_type, job.current_stage);
  if (!next) return '';
  const labels: Record<string, string> = {
    designing:         'Start Designing',
    approval:          'Send for Approval',
    pre_print_qc:      'Pre-Print QC',
    print_file_ready:  'Print File Ready',
    file_sent_client:  'Send File to Client',
    file_check:        'Verify Print File',
    ready_to_print:    'Ready to Print',
    printing:          'Send to Print',
    material_received: 'Material Received',
    quality_check:     'Material QC',
    ready:             'Mark Ready',
    dispatched:        'Dispatch',
    delivered:         'Mark Delivered',
  };
  return labels[next] || next.replace(/_/g, ' ');
}

/** Group a job into the correct sidebar section based on its type + stage. */
function getGroupForJob(job: Job): string {
  const stage = job.current_stage;
  if (job.job_type === 'Print Only') {
    // 'file_received' + 'file_check' sit with the design team (verify the client's file)
    // → Design Stage. Once ready it enters the Print Planner / production.
    if (['new', 'file_received', 'file_check'].includes(stage)) return 'Design Stage';
    if (['ready_to_print', 'printing', 'material_received', 'finishing', 'quality_check'].includes(stage)) return 'In Production';
    if (['ready', 'dispatched'].includes(stage)) return 'Dispatch';
    return 'Done';
  }
  // Design Only and Design+Print use the stageConfig group as-is
  return stageConfig[stage]?.group || 'Other';
}

// ─── Stage Config ─────────────────────────────────────────────────────────────
// Colors chosen to be muted/pastel, harmonious with the warm-cream theme.
// Left border: medium-toned. Card tint: very light wash. Badge: same light wash + dark text.
const stageConfig: Record<string, {
  label: string;
  borderColor: string;    // left-border 4px accent
  tintBg: string;         // card header area tint (very light)
  badgeBg: string;        // stage badge background
  badgeText: string;      // stage badge text
  actionBg: string;       // action button background
  actionText: string;     // action button text
  actionHover: string;    // action button hover
  groupHeaderColor: string; // group header text+icon color
  icon: React.ReactNode;
  group: string;
  nextLabel: string;
}> = {
  new: {
    label: 'New',
    borderColor: 'border-l-stone-400',
    tintBg: 'bg-stone-50',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-600',
    actionBg: 'bg-stone-700',
    actionText: 'text-white',
    actionHover: 'hover:bg-stone-800',
    groupHeaderColor: 'text-stone-600',
    icon: <Clock className="w-3 h-3" />,
    group: 'Design Stage',
    nextLabel: 'Start Designing',
  },
  file_check: {
    label: 'File Check',
    borderColor: 'border-l-purple-400',
    tintBg: 'bg-purple-50/60',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    actionBg: 'bg-purple-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-purple-700',
    groupHeaderColor: 'text-purple-700',
    icon: <ClipboardCheck className="w-3 h-3" />,
    group: 'Design Stage',
    nextLabel: 'Send to Print Planner',
  },
  file_received: {
    label: 'File Received',
    borderColor: 'border-l-stone-400',
    tintBg: 'bg-stone-50',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-600',
    actionBg: 'bg-stone-700',
    actionText: 'text-white',
    actionHover: 'hover:bg-stone-800',
    groupHeaderColor: 'text-stone-600',
    icon: <Clock className="w-3 h-3" />,
    group: 'Design Stage',
    nextLabel: 'Verify Print File',
  },
  designing: {
    label: 'Designing',
    borderColor: 'border-l-violet-400',
    tintBg: 'bg-violet-50/60',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    actionBg: 'bg-violet-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-violet-700',
    groupHeaderColor: 'text-violet-700',
    icon: <Palette className="w-3 h-3" />,
    group: 'Design Stage',
    nextLabel: 'Client Approval',
  },
  approval: {
    label: 'Approval',
    borderColor: 'border-l-blue-400',
    tintBg: 'bg-blue-50/60',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    actionBg: 'bg-blue-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-blue-700',
    groupHeaderColor: 'text-blue-700',
    icon: <ClipboardCheck className="w-3 h-3" />,
    group: 'Design Stage',
    nextLabel: 'Pre-Print QC',
  },
  pre_print_qc: {
    label: 'Pre-Print QC',
    borderColor: 'border-l-cyan-400',
    tintBg: 'bg-cyan-50/60',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-700',
    actionBg: 'bg-cyan-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-cyan-700',
    groupHeaderColor: 'text-cyan-700',
    icon: <ClipboardCheck className="w-3 h-3" />,
    group: 'Design Stage',
    nextLabel: 'Print File Ready',
  },
  print_file_ready: {
    label: 'Print File Ready',
    borderColor: 'border-l-blue-400',
    tintBg: 'bg-blue-50/60',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    actionBg: 'bg-blue-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-blue-700',
    groupHeaderColor: 'text-blue-700',
    icon: <CheckCircle className="w-3 h-3" />,
    group: 'Design Stage',
    nextLabel: 'Ready to Print',
  },
  file_sent_client: {
    label: 'File Sent to Client',
    borderColor: 'border-l-green-400',
    tintBg: 'bg-green-50/60',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    actionBg: 'bg-green-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-green-700',
    groupHeaderColor: 'text-green-700',
    icon: <CheckCircle className="w-3 h-3" />,
    group: 'Done',
    nextLabel: '',
  },
  ready_to_print: {
    label: 'Ready to Print',
    borderColor: 'border-l-indigo-400',
    tintBg: 'bg-indigo-50/60',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    actionBg: 'bg-indigo-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-indigo-700',
    groupHeaderColor: 'text-indigo-700',
    icon: <Printer className="w-3 h-3" />,
    group: 'In Production',
    nextLabel: 'Send to Print',
  },
  printing: {
    label: 'In Print',
    borderColor: 'border-l-orange-400',
    tintBg: 'bg-orange-50/60',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    actionBg: 'bg-orange-500',
    actionText: 'text-white',
    actionHover: 'hover:bg-orange-600',
    groupHeaderColor: 'text-orange-700',
    icon: <Printer className="w-3 h-3" />,
    group: 'In Production',
    nextLabel: 'Material Received',
  },
  material_received: {
    label: 'Material Received',
    borderColor: 'border-l-teal-400',
    tintBg: 'bg-teal-50/60',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
    actionBg: 'bg-teal-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-teal-700',
    groupHeaderColor: 'text-teal-700',
    icon: <Package className="w-3 h-3" />,
    group: 'In Production',
    nextLabel: 'Material QC',
  },
  finishing: {
    label: 'Finishing',
    borderColor: 'border-l-amber-400',
    tintBg: 'bg-amber-50/60',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    actionBg: 'bg-amber-500',
    actionText: 'text-white',
    actionHover: 'hover:bg-amber-600',
    groupHeaderColor: 'text-amber-700',
    icon: <Package className="w-3 h-3" />,
    group: 'In Production',
    nextLabel: 'Quality Check',
  },
  quality_check: {
    label: 'Material QC',
    borderColor: 'border-l-cyan-400',
    tintBg: 'bg-cyan-50/60',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-700',
    actionBg: 'bg-cyan-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-cyan-700',
    groupHeaderColor: 'text-cyan-700',
    icon: <CheckCircle className="w-3 h-3" />,
    group: 'In Production',
    nextLabel: 'Mark Ready',
  },
  ready: {
    label: 'Ready',
    borderColor: 'border-l-green-400',
    tintBg: 'bg-green-50/60',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    actionBg: 'bg-green-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-green-700',
    groupHeaderColor: 'text-green-700',
    icon: <Package className="w-3 h-3" />,
    group: 'Dispatch',
    nextLabel: 'Dispatch',
  },
  dispatched: {
    label: 'Dispatched',
    borderColor: 'border-l-teal-400',
    tintBg: 'bg-teal-50/60',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
    actionBg: 'bg-teal-600',
    actionText: 'text-white',
    actionHover: 'hover:bg-teal-700',
    groupHeaderColor: 'text-teal-700',
    icon: <Truck className="w-3 h-3" />,
    group: 'Dispatch',
    nextLabel: 'Mark Delivered',
  },
  delivered: {
    label: 'Delivered',
    borderColor: 'border-l-gray-300',
    tintBg: 'bg-gray-50',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-500',
    actionBg: 'bg-gray-400',
    actionText: 'text-white',
    actionHover: 'hover:bg-gray-500',
    groupHeaderColor: 'text-gray-500',
    icon: <CheckCircle className="w-3 h-3" />,
    group: 'Done',
    nextLabel: '',
  },
};

// ─── Groups ───────────────────────────────────────────────────────────────────
const groupOrder = ['Design Stage', 'In Production', 'Dispatch'];

const groupMeta: Record<string, {
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
  textColor: string;
}> = {
  'Design Stage': {
    icon: <Palette className="w-3.5 h-3.5" />,
    borderColor: 'border-violet-200',
    bgColor: 'bg-violet-50/50',
    textColor: 'text-violet-700',
  },
  'In Production': {
    icon: <Printer className="w-3.5 h-3.5" />,
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50/50',
    textColor: 'text-orange-700',
  },
  'Dispatch': {
    icon: <Truck className="w-3.5 h-3.5" />,
    borderColor: 'border-teal-200',
    bgColor: 'bg-teal-50/50',
    textColor: 'text-teal-700',
  },
};

// ─── Deadline badge ───────────────────────────────────────────────────────────
function getDeadlineBadge(deadline: string | null | undefined) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'bg-red-50 text-red-600 border border-red-200' };
  if (days === 0) return { label: 'Due Today', cls: 'bg-amber-50 text-amber-600 border border-amber-200' };
  if (days === 1) return { label: 'Tomorrow', cls: 'bg-amber-50 text-amber-500 border border-amber-200' };
  return { label: `${days}d left`, cls: 'bg-stone-100 text-stone-500 border border-stone-200' };
}

// ─── Designer avatar ──────────────────────────────────────────────────────────
function DesignerAvatar({ name }: { name?: string }) {
  if (!name) return null;
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold shrink-0 border border-violet-200"
    >
      {initials}
    </span>
  );
}

// ─── Filter chip options ──────────────────────────────────────────────────────
const filterOptions = [
  { label: 'All', value: 'all' },
  { label: '🎨 Design', value: '_design' },
  { label: '🖨 Production', value: '_production' },
  { label: '⚠️ Urgent', value: '_urgent' },
  { label: 'Brief & Assets', value: 'new' },
  { label: 'Designing', value: 'designing' },
  { label: 'Approval', value: 'approval' },
  { label: 'Pre-Print QC', value: 'pre_print_qc' },
  { label: 'Print File Ready', value: 'print_file_ready' },
  { label: 'File Sent to Client', value: 'file_sent_client' },
  { label: 'File Received', value: 'file_received' },
  { label: 'Printability QC', value: 'file_check' },
  { label: 'Ready to Print', value: 'ready_to_print' },
  { label: 'In Print', value: 'printing' },
  { label: 'Material Received', value: 'material_received' },
  { label: 'Material QC', value: 'quality_check' },
  { label: 'Ready for Dispatch', value: 'ready' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
];

export default function JobQueuePage() {
  const { jobs, loading, updateJobStage, refetch } = useJobs({
    select: 'id, job_number, project_name, client_id, priority, current_stage, job_type, product_category, parent_job_id, client_deadline, total_amount, amount_received, payment_status, quantity, designer_id, print_ready, client:clients(id, name, company)',
    filter: [{ column: 'current_stage', value: ['new', 'file_received', 'file_check', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready', 'dispatched'], op: 'in' }],
    limit: 100,
  });
  const { designers } = useDesigners();
  const designerMap: Record<string, string> = Object.fromEntries(
    (designers || []).map((d: any) => [d.id, d.full_name || d.name])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Send-to-designer (Print-Only file verification)
  const [assignJob, setAssignJob] = useState<Job | null>(null);
  const [assignDesignerId, setAssignDesignerId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const confirm = useConfirm();

  const handleSendToDesigner = async () => {
    if (!assignJob || !assignDesignerId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/jobs/${assignJob.id}/assign-print-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designer_id: assignDesignerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send');
      toast.success(`Sent to ${data?.designer?.full_name || 'designer'} for print-ready verification`);
      setAssignJob(null);
      setAssignDesignerId('');
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Could not send file to designer');
    } finally {
      setSending(false);
    }
  };

  // ─── Filter ──────────────────────────────────────────────────────────────
  const filteredJobs = jobs.filter(job => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (job.job_number || '').toLowerCase().includes(q) ||
      (job.client?.name || '').toLowerCase().includes(q) ||
      (job.client?.company || '').toLowerCase().includes(q) ||
      (job.project_name || '').toLowerCase().includes(q);

    let matchesFilter = true;
    if (statusFilter === '_design') matchesFilter = ['new', 'file_check', 'designing', 'approval'].includes(job.current_stage);
    else if (statusFilter === '_production') matchesFilter = ['printing', 'finishing', 'quality_check', 'ready'].includes(job.current_stage);
    else if (statusFilter === '_urgent') matchesFilter = ['high', 'urgent'].includes(job.priority);
    else if (statusFilter !== 'all') matchesFilter = job.current_stage === statusFilter;

    return matchesSearch && matchesFilter;
  });

  // ─── Stats ────────────────────────────────────────────────────────────────
  const total = jobs.length;
  const designCount = jobs.filter(j => ['new', 'file_check', 'designing', 'approval'].includes(j.current_stage)).length;
  const productionCount = jobs.filter(j => ['printing', 'finishing', 'quality_check', 'ready'].includes(j.current_stage)).length;
  const dispatchedCount = jobs.filter(j => j.current_stage === 'dispatched').length;
  const urgentCount = jobs.filter(j => ['high', 'urgent'].includes(j.priority)).length;

  // ─── Group jobs ───────────────────────────────────────────────────────────
  const grouped: Record<string, Job[]> = {};
  groupOrder.forEach(g => { grouped[g] = []; });
  filteredJobs.forEach(job => {
    const g = getGroupForJob(job);
    if (grouped[g]) grouped[g].push(job);
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleView = (job: Job) => { setSelectedJob(job); setShowViewModal(true); };

  const handleMoveToNext = async (job: Job) => {
    const flow = getFlowForJob(job);
    const idx = flow.indexOf(job.current_stage as JobStatus);
    if (idx !== -1 && idx < flow.length - 1) {
      await updateJobStage(job.id, flow[idx + 1]);
    }
  };

  const handleStageSelect = async (newStage: string) => {
    if (!selectedJob) return;
    const { confirmed } = await confirm({
      title: 'Move Job',
      message: `Move to "${newStage.replace('_', ' ')}"?`,
      confirmLabel: 'Move',
    });
    if (confirmed) {
      await updateJobStage(selectedJob.id, newStage as JobStatus);
      setSelectedJob({ ...selectedJob, current_stage: newStage as JobStatus });
    }
  };

  const toggleGroup = (g: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
        <p className="text-xs text-muted-foreground">Loading job queue…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Link href="/admin/jobs" className="p-2 hover:bg-muted rounded-md lg:hidden">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-page-title text-foreground">Job Queue</h1>
          <p className="text-xs text-muted-foreground">{filteredJobs.length} of {total} jobs</p>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Design Stage', value: designCount, icon: <Palette className="w-3.5 h-3.5 text-violet-500" />, countCls: 'text-violet-700', barCls: 'bg-violet-200' },
          { label: 'In Production', value: productionCount, icon: <Printer className="w-3.5 h-3.5 text-orange-500" />, countCls: 'text-orange-700', barCls: 'bg-orange-200' },
          { label: 'Dispatched', value: dispatchedCount, icon: <Truck className="w-3.5 h-3.5 text-teal-500" />, countCls: 'text-teal-700', barCls: 'bg-teal-200' },
          { label: 'High Priority', value: urgentCount, icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />, countCls: 'text-red-700', barCls: 'bg-red-200' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-md p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              {s.icon}
              <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.countCls}`}>{s.value}</p>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${s.barCls}`}
                style={{ width: total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + Filter Chips ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by job #, client, or project…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map(opt => {
            const count = opt.value.startsWith('_') || opt.value === 'all'
              ? null
              : jobs.filter(j => j.current_stage === opt.value).length;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${statusFilter === opt.value
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card border-border text-muted-foreground hover:border-foreground/30'
                  }`}
              >
                {opt.label}
                {count !== null && <span className="ml-1 opacity-50">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grouped Job Cards ──────────────────────────────────────────────── */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">No jobs found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adjust your search or filter</p>
        </div>
      ) : (
        groupOrder.map(group => {
          const groupJobs = grouped[group] || [];
          if (!groupJobs.length) return null;
          const meta = groupMeta[group];
          const isCollapsed = collapsedGroups.has(group);

          return (
            <div key={group} className="space-y-2">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md border ${meta.borderColor} ${meta.bgColor} transition-all`}
              >
                <div className="flex items-center gap-2">
                  <span className={meta.textColor}>{meta.icon}</span>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${meta.textColor}`}>{group}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${meta.bgColor} ${meta.textColor} border ${meta.borderColor}`}>
                    {groupJobs.length}
                  </span>
                </div>
                {isCollapsed
                  ? <ChevronDown className={`w-3.5 h-3.5 ${meta.textColor}`} />
                  : <ChevronUp className={`w-3.5 h-3.5 ${meta.textColor}`} />
                }
              </button>

              {/* Cards grid — 4 columns on large screens */}
              {!isCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-2">
                  {groupJobs.map(job => {
                    const cfg = stageConfig[job.current_stage] || stageConfig['new'];
                    const isUrgent = ['high', 'urgent'].includes(job.priority);
                    const deadline = getDeadlineBadge(job.client_deadline);
                    const isOverdue = deadline?.label.includes('overdue');
                    const designer = (job.designer as any)?.full_name;

                    return (
                      <div
                        key={job.id}
                        className={`
                          bg-card rounded-md border border-border border-l-4 ${cfg.borderColor}
                          hover:shadow-sm transition-shadow
                          ${isOverdue ? 'ring-1 ring-red-200' : isUrgent ? 'ring-1 ring-amber-200' : ''}
                        `}
                      >
                        {/* Card top: tinted strip with job # and stage badge */}
                        <div className={`${cfg.tintBg} px-3 py-2 flex items-center justify-between rounded-tr-md border-b border-border/50`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`${cfg.badgeText} opacity-60`}>{cfg.icon}</span>
                            <span className="text-xs font-bold text-foreground tracking-wide truncate">{job.job_number}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {isUrgent && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded font-bold uppercase tracking-wider">
                                {job.priority}
                              </span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${cfg.badgeBg} ${cfg.badgeText}`}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="px-3 pt-2 pb-3 space-y-2">
                          {/* Client + project */}
                          <div>
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              {job.client?.company || job.client?.name || 'Unknown'}
                            </p>
                            <h3 className="text-sm font-semibold text-foreground line-clamp-1 leading-snug mt-0.5">
                              {job.project_name}
                            </h3>
                          </div>

                          {/* Meta chips */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 border border-border">
                              Qty {job.quantity?.toLocaleString()}
                            </span>
                            {deadline && (
                              <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${deadline.cls}`}>
                                {deadline.label}
                              </span>
                            )}
                            {designer && (
                              <span className="flex items-center gap-1 ml-auto">
                                <DesignerAvatar name={designer} />
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              onClick={() => handleView(job)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-card border border-border text-muted-foreground rounded text-xs font-medium hover:text-foreground hover:border-foreground/30 transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                            {(() => {
                              // ── Print-Only files awaiting designer verification ──
                              const isPO = normalizeJobType(job.job_type) === 'print_only';
                              const inReviewWindow = ['new', 'file_received', 'file_check'].includes(job.current_stage);
                              if (isPO && inReviewWindow) {
                                const assignedId = (job as any).designer_id as string | undefined;
                                if (assignedId) {
                                  // Already sent → show "Sent to X · Verifying" badge
                                  const name = designerMap[assignedId] || 'designer';
                                  return (
                                    <span className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      <UserCheck className="w-3 h-3" />
                                      Sent to {name} · Verifying
                                    </span>
                                  );
                                }
                                // Not yet sent → "Send to Designer"
                                return (
                                  <button
                                    onClick={() => { setAssignJob(job); setAssignDesignerId(''); }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors bg-purple-600 text-white hover:bg-purple-700"
                                  >
                                    <Send className="w-3 h-3" />
                                    Send to Designer
                                  </button>
                                );
                              }
                              // ── Default: advance to next stage ──
                              if (job.current_stage === 'delivered' || job.current_stage === 'cancelled') return null;
                              const nextLbl = getNextLabel(job);
                              if (!nextLbl) return null;
                              const flow = getFlowForJob(job);
                              const isLast = flow.indexOf(job.current_stage as JobStatus) === flow.length - 2;
                              return (
                                <button
                                  onClick={() => handleMoveToNext(job)}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${cfg.actionBg} ${cfg.actionText} ${cfg.actionHover}`}
                                >
                                  {job.current_stage === 'new'
                                    ? <Play className="w-3 h-3" />
                                    : isLast
                                      ? <CheckCircle className="w-3 h-3" />
                                      : <ArrowRight className="w-3 h-3" />
                                  }
                                  {nextLbl}
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ═══════════════════ JOB DETAIL MODAL ════════════════════════════════ */}
      {showViewModal && selectedJob && (() => {
        const stage = selectedJob.current_stage;
        const cfg = stageConfig[stage] || stageConfig['new'];
        const deadlineDays = selectedJob.client_deadline
          ? Math.ceil((new Date(selectedJob.client_deadline).getTime() - Date.now()) / 86400000)
          : null;
        const balance = (selectedJob.total_amount || 0) - (selectedJob.amount_received || 0);

        return (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowViewModal(false)}
          >
            <div
              className="bg-card rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in border border-border shadow-lg"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header — uses stage left-border accent + light tint */}
              <div className={`${cfg.tintBg} px-4 py-3 border-b border-border flex items-center justify-between rounded-t-md border-l-4 ${cfg.borderColor}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-foreground text-base">{selectedJob.job_number}</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${cfg.badgeBg} ${cfg.badgeText}`}>
                    {stage.replace('_', ' ')}
                  </span>
                  {['high', 'urgent'].includes(selectedJob.priority) && (
                    <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">{selectedJob.priority}</span>
                  )}
                  {selectedJob.is_on_hold && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">⏸ On Hold</span>
                  )}
                </div>
                <button onClick={() => setShowViewModal(false)} className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Basic info grid */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start p-2.5 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground">Client</span>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-foreground">{selectedJob.client?.company || selectedJob.client?.name || '—'}</p>
                      {selectedJob.client?.company && selectedJob.client?.name && <p className="text-xs text-muted-foreground">{selectedJob.client.name}</p>}
                      {selectedJob.client?.phone && <p className="text-xs text-muted-foreground">{selectedJob.client.phone}</p>}
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
                      <span className="font-medium text-sm text-foreground">{selectedJob.quantity?.toLocaleString()}</span>
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

                {/* Hold reason */}
                {selectedJob.is_on_hold && selectedJob.hold_reason && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md">
                    <span className="text-xs text-amber-700 font-semibold">⏸ Hold Reason</span>
                    <p className="text-sm text-amber-800 mt-0.5">{selectedJob.hold_reason}</p>
                  </div>
                )}

                {/* Stage context panel */}
                <div className={`border border-border rounded-md overflow-hidden border-l-4 ${cfg.borderColor}`}>
                  <div className={`px-3 py-2 border-b border-border ${cfg.tintBg}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.badgeText}`}>
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
                    {stage === 'new' && (<>
                      <div className="flex justify-between"><span className="text-muted-foreground">Order Date</span><span className="font-medium">{selectedJob.order_date ? new Date(selectedJob.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></div>
                      {selectedJob.sales_person && <div className="flex justify-between"><span className="text-muted-foreground">Sales Person</span><span className="font-medium">{selectedJob.sales_person.full_name || '—'}</span></div>}
                      {selectedJob.notes && <div><span className="text-muted-foreground">Notes</span><p className="mt-0.5 text-foreground">{selectedJob.notes}</p></div>}
                      {!selectedJob.notes && !selectedJob.sales_person && <p className="text-muted-foreground text-xs italic">Order received. Ready to start.</p>}
                    </>)}
                    {stage === 'designing' && (<>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Designer</span>
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {(selectedJob.designer as any)?.full_name
                            ? <><DesignerAvatar name={(selectedJob.designer as any)?.full_name} />{(selectedJob.designer as any)?.full_name}</>
                            : <span className="text-amber-600 italic text-xs">Not assigned</span>}
                        </span>
                      </div>
                      {selectedJob.file_version && <div className="flex justify-between"><span className="text-muted-foreground">File Version</span><span className="font-medium">{selectedJob.file_version}</span></div>}
                      {selectedJob.notes && <div><span className="text-muted-foreground">Design Notes</span><p className="mt-0.5 text-foreground">{selectedJob.notes}</p></div>}
                    </>)}
                    {stage === 'approval' && (<>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Approval Status</span>
                        <span className={`font-semibold px-2 py-0.5 rounded text-xs capitalize ${selectedJob.approval_status === 'approved' ? 'bg-green-100 text-green-700' : selectedJob.approval_status === 'changes_requested' ? 'bg-red-100 text-red-700' : selectedJob.approval_status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                          {selectedJob.approval_status?.replace('_', ' ') || 'pending'}
                        </span>
                      </div>
                      {(selectedJob.designer as any)?.full_name && <div className="flex justify-between"><span className="text-muted-foreground">Designer</span><span className="font-medium">{(selectedJob.designer as any)?.full_name}</span></div>}
                      {selectedJob.approval_date && <div className="flex justify-between"><span className="text-muted-foreground">Sent On</span><span className="font-medium">{new Date(selectedJob.approval_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>}
                      {selectedJob.approval_remark && <div><span className="text-muted-foreground">Client Remark</span><p className="mt-0.5 text-foreground italic">&ldquo;{selectedJob.approval_remark}&rdquo;</p></div>}
                    </>)}
                    {stage === 'printing' && (<>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Print Ready</span>
                        <span className={`font-semibold ${selectedJob.print_ready ? 'text-green-600' : 'text-amber-600'}`}>{selectedJob.print_ready ? '✅ Yes' : '⏳ Not Yet'}</span>
                      </div>
                      {selectedJob.vendor?.name ? (<>
                        <div className="flex justify-between"><span className="text-muted-foreground">Vendor</span><span className="font-semibold text-foreground">{selectedJob.vendor.name}</span></div>
                        {selectedJob.vendor?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{selectedJob.vendor.phone}</span></div>}
                      </>) : <div className="flex justify-between"><span className="text-muted-foreground">Production</span><span className="font-medium text-foreground">In-house</span></div>}
                    </>)}
                    {(stage === 'finishing' || stage === 'quality_check') && (<>
                      {selectedJob.qc_status && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">QC Status</span>
                          <span className={`font-semibold px-2 py-0.5 rounded text-xs capitalize ${selectedJob.qc_status === 'passed' ? 'bg-green-100 text-green-700' : selectedJob.qc_status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{selectedJob.qc_status}</span>
                        </div>
                      )}
                      {selectedJob.vendor?.name && <div className="flex justify-between"><span className="text-muted-foreground">Printed by</span><span className="font-medium">{selectedJob.vendor.name}</span></div>}
                      {selectedJob.actual_quantity && <div className="flex justify-between"><span className="text-muted-foreground">Actual Qty</span><span className="font-medium">{selectedJob.actual_quantity.toLocaleString()}</span></div>}
                      {!selectedJob.qc_status && <p className="text-muted-foreground text-xs italic">QC check pending.</p>}
                    </>)}
                    {stage === 'ready' && (<>
                      <p className="text-green-700 font-medium text-xs">✅ Job is ready for dispatch</p>
                      {selectedJob.actual_quantity && <div className="flex justify-between"><span className="text-muted-foreground">Final Qty</span><span className="font-medium">{selectedJob.actual_quantity.toLocaleString()}</span></div>}
                      {selectedJob.client?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Client Phone</span><span className="font-medium">{selectedJob.client.phone}</span></div>}
                    </>)}
                    {stage === 'dispatched' && (<>
                      <p className="text-teal-700 font-medium text-xs">🚚 Job has been dispatched</p>
                      {selectedJob.client?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Client Phone</span><span className="font-medium">{selectedJob.client.phone}</span></div>}
                    </>)}
                    {stage === 'delivered' && (<>
                      <p className="text-green-700 font-medium text-xs">✅ Job delivered successfully</p>
                      {selectedJob.completed_date && <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="font-medium">{new Date(selectedJob.completed_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}
                    </>)}
                  </div>
                </div>

                {/* Financials */}
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
                  <span className={`text-xs px-2 py-1 rounded font-medium capitalize ${selectedJob.payment_status === 'paid' ? 'bg-green-100 text-green-700' : selectedJob.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedJob.payment_status || 'unpaid'}
                  </span>
                </div>

                {/* Pipeline steps — rendered for THIS job's type only */}
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">Pipeline — click to move</p>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {(() => {
                      const flow = getFlowForJob(selectedJob);
                      const currentIdx = flow.indexOf(selectedJob.current_stage as JobStatus);
                      return flow.map((s, idx) => {
                        const isCompleted = currentIdx !== -1 && idx <= currentIdx;
                        const isCurrent = idx === currentIdx;
                        const sCfg = stageConfig[s];
                        return (
                          <button
                            key={s}
                            onClick={() => handleStageSelect(s)}
                            className="flex items-center group focus:outline-none shrink-0"
                            title={`Move to ${s.replace('_', ' ')}`}
                          >
                            <div className={`px-2 py-0.5 rounded text-[9px] font-semibold capitalize whitespace-nowrap transition-all group-hover:scale-105 border ${isCurrent
                                ? `${sCfg.badgeBg} ${sCfg.badgeText} border-current ring-1 ring-offset-1 ring-current/30`
                                : isCompleted
                                  ? `${sCfg.badgeBg} ${sCfg.badgeText} border-current/20 opacity-60`
                                  : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                              }`}>
                              {s.replace('_', ' ')}
                            </div>
                            {idx < flow.length - 1 && (
                              <ArrowRight className={`w-2 h-2 mx-0.5 shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/30'}`} />
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full px-4 py-2 bg-foreground text-background rounded-md font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════ SEND-TO-DESIGNER (Print-Only verify) ═══════════════ */}
      {assignJob && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !sending && setAssignJob(null)}
        >
          <div
            className="bg-card rounded-md w-full max-w-md animate-scale-in border border-border shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-purple-50/60 rounded-t-md border-l-4 border-l-purple-400">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-600" />
                <h2 className="font-bold text-foreground text-base">Send to Designer</h2>
              </div>
              <button onClick={() => !sending && setAssignJob(null)} className="p-1.5 hover:bg-muted rounded text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">{assignJob.client?.company || assignJob.client?.name || 'Client'}</p>
                <p className="font-semibold text-foreground">{assignJob.job_number} — {assignJob.project_name}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                The selected designer will see this print file on their dashboard to verify it is print-ready. The designer is notified in-app and on Telegram with a direct link.
              </p>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Choose designer</label>
                <select
                  value={assignDesignerId}
                  onChange={e => setAssignDesignerId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select a designer —</option>
                  {(designers || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.full_name || d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setAssignJob(null)}
                  disabled={sending}
                  className="flex-1 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendToDesigner}
                  disabled={sending || !assignDesignerId}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sending ? 'Sending…' : 'Send File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
