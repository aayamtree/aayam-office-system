'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  CheckCircle2, Clock, AlertTriangle, Briefcase, ArrowRight,
  Loader2, Star, Users, Layers, Calendar, X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MyJob {
  id: string;
  job_number: string;
  project_name: string;
  client_deadline: string | null;
  priority: string;
  current_stage: string;
  job_type?: string | null;
  designer_status?: string | null;
  client?: { name: string; company?: string } | any | null;
}

interface FullJob extends MyJob {
  quantity?: number | null;
  total_amount?: number | null;
  amount_received?: number | null;
  payment_status?: string | null;
  notes?: string | null;
  order_date?: string | null;
  approval_status?: string | null;
  approval_date?: string | null;
  approval_remark?: string | null;
  print_ready?: boolean | null;
  qc_status?: string | null;
  actual_quantity?: number | null;
  completed_date?: string | null;
  hold_reason?: string | null;
  is_on_hold?: boolean | null;
  file_version?: string | null;
  designer?: { full_name?: string } | any | null;
  vendor?: { name?: string; phone?: string } | any | null;
  sales_person?: { full_name?: string } | any | null;
}

interface MySubtask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  job_id: string;
  job?: { id: string; job_number: string; project_name: string } | null;
}

interface MyLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  follow_up_date: string | null;
  status: string;
}

// ─── Type-driven pipeline (mirrors queue/page.tsx) ────────────────────────────

const FLOW_DESIGN_ONLY  = ['new','designing','approval','delivered'];
const FLOW_PRINT_ONLY   = ['new','printing','finishing','quality_check','ready','dispatched','delivered'];
const FLOW_DESIGN_PRINT = ['new','designing','approval','printing','finishing','quality_check','ready','dispatched','delivered'];

function getFlowForType(jobType?: string | null) {
  if (jobType === 'Design Only') return FLOW_DESIGN_ONLY;
  if (jobType === 'Print Only')  return FLOW_PRINT_ONLY;
  return FLOW_DESIGN_PRINT;
}

const stageColors: Record<string, { bg: string; text: string; border: string }> = {
  new:           { bg: 'bg-stone-100',  text: 'text-stone-600',  border: 'border-stone-300' },
  designing:     { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  approval:      { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  printing:      { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  finishing:     { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300' },
  quality_check: { bg: 'bg-cyan-100',   text: 'text-cyan-700',   border: 'border-cyan-300' },
  ready:         { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  dispatched:    { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300' },
  delivered:     { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dayLabel(iso: string | null): { label: string; urgent: boolean; overdue: boolean } {
  if (!iso) return { label: 'No deadline', urgent: false, overdue: false };
  const today = new Date().toISOString().split('T')[0];
  const diff   = Math.round((new Date(iso).getTime() - new Date(today).getTime()) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, urgent: true, overdue: true };
  if (diff === 0) return { label: 'Due today', urgent: true, overdue: false };
  if (diff === 1) return { label: 'Due tomorrow', urgent: true, overdue: false };
  return { label: `${diff}d left`, urgent: false, overdue: false };
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  normal: 'bg-blue-400',
  low:    'bg-gray-300',
};

// ─── Job Detail Modal ─────────────────────────────────────────────────────────

function JobDetailModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [job, setJob]       = useState<FullJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('jobs')
          .select(`
            id, job_number, project_name, client_deadline, priority, current_stage,
            job_type, quantity, total_amount, amount_received, payment_status,
            notes, order_date, approval_status, approval_date, approval_remark,
            print_ready, qc_status, actual_quantity, completed_date,
            hold_reason, is_on_hold, file_version,
            client:clients!client_id(name, company, phone),
            designer:profiles!designer_id(full_name),
            vendor:vendors!vendor_id(name, phone),
            sales_person:profiles!sales_person_id(full_name)
          `)
          .eq('id', jobId)
          .single();
        setJob(data as any);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const flow = job ? getFlowForType(job.job_type) : [];
  const currentIdx = job ? flow.indexOf(job.current_stage) : -1;
  const sc = job ? (stageColors[job.current_stage] || stageColors.new) : stageColors.new;
  const deadline = job ? dayLabel(job.client_deadline) : null;
  const deadlineDays = job?.client_deadline
    ? Math.ceil((new Date(job.client_deadline).getTime() - Date.now()) / 86400000)
    : null;
  const balance = (job?.total_amount || 0) - (job?.amount_received || 0);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {loading || !job ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="animate-spin text-gray-400 w-8 h-8" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className={`px-4 pt-4 pb-3 border-b border-gray-100 ${sc.bg} rounded-t-2xl sm:rounded-t-xl`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-gray-500 tracking-wide">{job.job_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${sc.bg} ${sc.text} ${sc.border}`}>
                      {job.current_stage.replace('_', ' ')}
                    </span>
                    {job.job_type && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 font-medium">
                        {job.job_type}
                      </span>
                    )}
                    {['high','urgent'].includes(job.priority) && (
                      <span className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-full font-bold uppercase">{job.priority}</span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">{job.project_name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(job.client as any)?.company || (job.client as any)?.name || '—'}
                    {(job.client as any)?.company && (job.client as any)?.name && ` · ${(job.client as any).name}`}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-black/10 rounded-full transition-colors shrink-0 mt-0.5"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Pipeline — type-driven */}
              <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {flow.map((s, idx) => {
                  const isCompleted = currentIdx !== -1 && idx <= currentIdx;
                  const isCurrent   = idx === currentIdx;
                  const c = stageColors[s] || stageColors.new;
                  return (
                    <div key={s} className="flex items-center shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold capitalize border whitespace-nowrap
                        ${isCurrent
                          ? `${c.bg} ${c.text} ${c.border} ring-1 ring-offset-1 ring-current/30`
                          : isCompleted
                            ? `${c.bg} ${c.text} ${c.border} opacity-50`
                            : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}>
                        {s.replace('_', ' ')}
                      </span>
                      {idx < flow.length - 1 && (
                        <ArrowRight className={`w-2 h-2 mx-0.5 ${isCompleted ? 'text-gray-400' : 'text-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">

              {/* Quick meta row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 mb-0.5">Qty</p>
                  <p className="text-sm font-semibold text-gray-800">{job.quantity?.toLocaleString() || '—'}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${deadlineDays !== null && deadlineDays < 0 ? 'bg-red-50' : deadlineDays !== null && deadlineDays <= 1 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <p className="text-[10px] text-gray-400 mb-0.5">Deadline</p>
                  {job.client_deadline ? (
                    <p className={`text-sm font-semibold ${deadlineDays !== null && deadlineDays < 0 ? 'text-red-600' : deadlineDays !== null && deadlineDays <= 1 ? 'text-amber-600' : 'text-gray-800'}`}>
                      {new Date(job.client_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      <span className="text-[10px] font-normal ml-1">
                        {deadline?.label}
                      </span>
                    </p>
                  ) : <p className="text-sm text-gray-400">—</p>}
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 mb-0.5">Balance</p>
                  <p className={`text-sm font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{balance.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Stage context */}
              <div className={`rounded-lg border p-3 space-y-2 text-sm ${sc.bg} border-current/10`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${sc.text}`}>
                  {job.current_stage === 'new'           && '📋 New Order'}
                  {job.current_stage === 'designing'     && '🎨 Design Stage'}
                  {job.current_stage === 'approval'      && '✅ Client Approval'}
                  {job.current_stage === 'printing'      && '🖨️ Printing'}
                  {job.current_stage === 'finishing'     && '✂️ Finishing'}
                  {job.current_stage === 'quality_check' && '🔍 Quality Check'}
                  {job.current_stage === 'ready'         && '📦 Ready for Dispatch'}
                  {job.current_stage === 'dispatched'    && '🚚 Dispatched'}
                  {job.current_stage === 'delivered'     && '✅ Delivered'}
                </p>

                {job.current_stage === 'new' && (
                  <>
                    {job.order_date && <InfoRow label="Order Date" value={new Date(job.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
                    {job.sales_person && <InfoRow label="Sales Person" value={(job.sales_person as any)?.full_name || '—'} />}
                    {job.notes && <InfoRow label="Notes" value={job.notes} />}
                  </>
                )}
                {job.current_stage === 'designing' && (
                  <>
                    <InfoRow label="Designer" value={(job.designer as any)?.full_name || '—'} warn={!(job.designer as any)?.full_name} />
                    {job.file_version && <InfoRow label="File Version" value={job.file_version} />}
                    {job.notes && <InfoRow label="Design Notes" value={job.notes} />}
                  </>
                )}
                {job.current_stage === 'approval' && (
                  <>
                    <InfoRow label="Approval Status" value={job.approval_status?.replace('_', ' ') || 'pending'} />
                    {(job.designer as any)?.full_name && <InfoRow label="Designer" value={(job.designer as any).full_name} />}
                    {job.approval_remark && <InfoRow label="Client Remark" value={`"${job.approval_remark}"`} />}
                  </>
                )}
                {job.current_stage === 'printing' && (
                  <>
                    <InfoRow label="Print Ready" value={job.print_ready ? '✅ Yes' : '⏳ Not Yet'} />
                    {(job.vendor as any)?.name
                      ? <InfoRow label="Vendor" value={(job.vendor as any).name} />
                      : <InfoRow label="Production" value="In-house" />
                    }
                  </>
                )}
                {(job.current_stage === 'finishing' || job.current_stage === 'quality_check') && (
                  <>
                    {job.qc_status && <InfoRow label="QC Status" value={job.qc_status} />}
                    {(job.vendor as any)?.name && <InfoRow label="Printed by" value={(job.vendor as any).name} />}
                    {job.actual_quantity && <InfoRow label="Actual Qty" value={job.actual_quantity.toLocaleString()} />}
                  </>
                )}
                {job.current_stage === 'ready' && (
                  <>
                    <p className="text-green-700 font-medium text-xs">✅ Ready for dispatch</p>
                    {job.actual_quantity && <InfoRow label="Final Qty" value={job.actual_quantity.toLocaleString()} />}
                  </>
                )}
                {job.current_stage === 'dispatched' && (
                  <p className="text-teal-700 font-medium text-xs">🚚 Job has been dispatched</p>
                )}
                {job.current_stage === 'delivered' && (
                  <>
                    <p className="text-green-700 font-medium text-xs">✅ Delivered successfully</p>
                    {job.completed_date && <InfoRow label="Completed" value={new Date(job.completed_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
                  </>
                )}
              </div>

              {/* Hold notice */}
              {job.is_on_hold && job.hold_reason && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-semibold">⏸ On Hold</p>
                  <p className="text-sm text-amber-800 mt-0.5">{job.hold_reason}</p>
                </div>
              )}

              {/* Financials */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Total</p>
                  <p className="text-sm font-semibold text-gray-800">₹{(job.total_amount || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Received</p>
                  <p className="text-sm font-semibold text-green-600">₹{(job.amount_received || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Balance</p>
                  <p className={`text-sm font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{balance.toLocaleString('en-IN')}</p>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-full font-semibold capitalize ${
                  job.payment_status === 'paid'    ? 'bg-green-100 text-green-700' :
                  job.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'}`}>
                  {job.payment_status || 'unpaid'}
                </span>
              </div>

              {/* Full detail link */}
              <Link
                href={`/admin/jobs/${job.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                onClick={onClose}
              >
                Open Full Detail
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-500 text-xs shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${warn ? 'text-amber-600 italic' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

// ─── Section: Designer ───────────────────────────────────────────────────────

function DesignerWork({ userId, onJobClick }: { userId: string; onJobClick: (id: string) => void }) {
  const [jobs, setJobs]         = useState<MyJob[]>([]);
  const [subtasks, setSubtasks] = useState<MySubtask[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [jobsRes, subtasksRes] = await Promise.all([
          supabase
            .from('jobs')
            .select('id, job_number, project_name, client_deadline, priority, current_stage, job_type, designer_status, client:clients!client_id(name,company)')
            .eq('designer_id', userId)
            .not('current_stage', 'in', '("delivered","cancelled")')
            .order('client_deadline', { ascending: true, nullsFirst: false }),
          fetch('/api/jobs/my-subtasks').then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        ]);
        setJobs((jobsRes.data || []) as any[]);
        setSubtasks(subtasksRes.data || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const today = new Date().toISOString().split('T')[0];
  const dueToday = jobs.filter(j => j.client_deadline === today);
  const thisWeek = jobs.filter(j => {
    if (!j.client_deadline || j.client_deadline === today) return false;
    const diff = Math.round((new Date(j.client_deadline).getTime() - new Date(today).getTime()) / 86400000);
    return diff > 0 && diff <= 7;
  });
  const overdue = jobs.filter(j => j.client_deadline && j.client_deadline < today);
  const later   = jobs.filter(j => {
    if (!j.client_deadline) return true;
    const diff = Math.round((new Date(j.client_deadline).getTime() - new Date(today).getTime()) / 86400000);
    return diff > 7;
  });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Jobs" value={jobs.length} icon={<Briefcase size={16} />} color="blue" />
        <StatCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={16} />} color={overdue.length > 0 ? 'red' : 'gray'} />
        <StatCard label="My Subtasks" value={subtasks.length} icon={<CheckCircle2 size={16} />} color="green" />
      </div>

      {subtasks.length > 0 && (
        <Section title="My Subtasks" icon={<CheckCircle2 size={15} className="text-green-600" />}>
          {subtasks.map(s => (
            <SubtaskRow key={s.id} subtask={s} onDone={(id) => setSubtasks(prev => prev.filter(x => x.id !== id))} />
          ))}
        </Section>
      )}

      {overdue.length > 0 && (
        <Section title="Overdue" icon={<AlertTriangle size={15} className="text-red-500" />} urgent>
          {overdue.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      {dueToday.length > 0 && (
        <Section title="Due Today" icon={<Star size={15} className="text-amber-500" />}>
          {dueToday.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      {thisWeek.length > 0 && (
        <Section title="This Week" icon={<Calendar size={15} className="text-blue-500" />}>
          {thisWeek.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      {later.length > 0 && (
        <Section title="Later" icon={<Clock size={15} className="text-gray-400" />} muted>
          {later.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      {jobs.length === 0 && subtasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">All clear! No active jobs assigned to you.</p>
        </div>
      )}
    </div>
  );
}

// ─── Section: Admin ──────────────────────────────────────────────────────────

function AdminWork({ onJobClick }: { onJobClick: (id: string) => void }) {
  const [overdue, setOverdue]       = useState<MyJob[]>([]);
  const [inProgress, setInProgress] = useState<MyJob[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [overdueRes, inProgRes] = await Promise.all([
          supabase
            .from('jobs')
            .select('id, job_number, project_name, client_deadline, priority, current_stage, job_type, client:clients!client_id(name,company)')
            .lt('client_deadline', today)
            .not('current_stage', 'in', '("delivered","cancelled","completed")')
            .order('client_deadline', { ascending: true })
            .limit(15),
          supabase
            .from('jobs')
            .select('id, job_number, project_name, client_deadline, priority, current_stage, job_type, client:clients!client_id(name,company)')
            .in('current_stage', ['designing', 'revision', 'proof', 'printing', 'pre_press'])
            .gte('client_deadline', today)
            .order('client_deadline', { ascending: true })
            .limit(15),
        ]);
        setOverdue((overdueRes.data || []) as any[]);
        setInProgress((inProgRes.data || []) as any[]);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Overdue Jobs" value={overdue.length} icon={<AlertTriangle size={16} />} color={overdue.length > 0 ? 'red' : 'gray'} />
        <StatCard label="In Production" value={inProgress.length} icon={<Layers size={16} />} color="blue" />
      </div>

      {overdue.length > 0 && (
        <Section title="Overdue Jobs" icon={<AlertTriangle size={15} className="text-red-500" />} urgent>
          {overdue.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      {inProgress.length > 0 && (
        <Section title="Active Production" icon={<Layers size={15} className="text-blue-500" />}>
          {inProgress.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      <div className="pt-2">
        <Link href="/admin/jobs/overdue" className="text-xs text-primary hover:underline flex items-center gap-1">
          View full overdue report <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

// ─── Section: Marketing ──────────────────────────────────────────────────────

function MarketingWork({ userId }: { userId: string }) {
  const [leads, setLeads]     = useState<MyLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('leads')
          .select('id, company_name, contact_name, follow_up_date, status')
          .eq('assigned_to', userId)
          .not('status', 'in', '("converted","lost","closed")')
          .order('follow_up_date', { ascending: true, nullsFirst: false })
          .limit(30);
        setLeads((data || []) as any[]);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;

  const today = new Date().toISOString().split('T')[0];
  const overdue  = leads.filter(l => l.follow_up_date && l.follow_up_date < today);
  const dueToday = leads.filter(l => l.follow_up_date === today);
  const upcoming = leads.filter(l => !l.follow_up_date || l.follow_up_date > today);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="My Leads" value={leads.length} icon={<Users size={16} />} color="blue" />
        <StatCard label="Follow-up Today" value={dueToday.length} icon={<Star size={16} />} color={dueToday.length > 0 ? 'amber' : 'gray'} />
        <StatCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={16} />} color={overdue.length > 0 ? 'red' : 'gray'} />
      </div>

      {overdue.length > 0 && (
        <Section title="Overdue Follow-ups" icon={<AlertTriangle size={15} className="text-red-500" />} urgent>
          {overdue.map(l => <LeadRow key={l.id} lead={l} />)}
        </Section>
      )}

      {dueToday.length > 0 && (
        <Section title="Follow up Today" icon={<Star size={15} className="text-amber-500" />}>
          {dueToday.map(l => <LeadRow key={l.id} lead={l} />)}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming" icon={<Clock size={15} className="text-gray-400" />} muted>
          {upcoming.map(l => <LeadRow key={l.id} lead={l} />)}
        </Section>
      )}

      {leads.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active leads assigned to you.</p>
          <Link href="/admin/marketing/leads" className="text-xs text-primary mt-2 inline-block hover:underline">Go to Leads →</Link>
        </div>
      )}
    </div>
  );
}

// ─── Section: Dispatch ───────────────────────────────────────────────────────

function DispatchWork({ onJobClick }: { onJobClick: (id: string) => void }) {
  const [jobs, setJobs]       = useState<MyJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('jobs')
          .select('id, job_number, project_name, client_deadline, priority, current_stage, job_type, client:clients!client_id(name,company)')
          .in('current_stage', ['ready_to_dispatch', 'dispatched', 'qc'])
          .order('client_deadline', { ascending: true, nullsFirst: false })
          .limit(30);
        setJobs((data || []) as any[]);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;

  const today = new Date().toISOString().split('T')[0];
  const overdue = jobs.filter(j => j.client_deadline && j.client_deadline < today);
  const rest    = jobs.filter(j => !j.client_deadline || j.client_deadline >= today);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pending Dispatch" value={jobs.length} icon={<Briefcase size={16} />} color="blue" />
        <StatCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={16} />} color={overdue.length > 0 ? 'red' : 'gray'} />
      </div>

      {overdue.length > 0 && (
        <Section title="Overdue Dispatches" icon={<AlertTriangle size={15} className="text-red-500" />} urgent>
          {overdue.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      {rest.length > 0 && (
        <Section title="Ready / In Dispatch" icon={<Layers size={15} className="text-blue-500" />}>
          {rest.map(j => <JobRow key={j.id} job={j} onJobClick={onJobClick} />)}
        </Section>
      )}

      {jobs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pending dispatches right now.</p>
        </div>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue:  'bg-blue-50 text-blue-700 border-blue-100',
    red:   'bg-red-50 text-red-700 border-red-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    gray:  'bg-gray-50 text-gray-500 border-gray-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.gray}`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, icon, children, urgent, muted }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; urgent?: boolean; muted?: boolean;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 ${urgent ? 'text-red-700' : muted ? 'text-gray-400' : 'text-gray-700'}`}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// JobRow — now opens inline modal instead of navigating away
function JobRow({ job, onJobClick }: { job: MyJob; onJobClick: (id: string) => void }) {
  const { label, urgent, overdue } = dayLabel(job.client_deadline);
  const clientName = (job.client as any)?.company || (job.client as any)?.name || '';
  return (
    <button
      onClick={() => onJobClick(job.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm text-left ${
        overdue ? 'bg-red-50 border-red-200 hover:border-red-300' : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[job.priority] || PRIORITY_DOT.normal}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{job.project_name}</p>
        <p className="text-[10px] text-gray-400 truncate">{job.job_number}{clientName ? ` · ${clientName}` : ''}</p>
      </div>
      <span className={`text-[11px] font-semibold shrink-0 ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-gray-400'}`}>
        {label}
      </span>
      <ArrowRight size={12} className="text-gray-300 shrink-0" />
    </button>
  );
}

function LeadRow({ lead }: { lead: MyLead }) {
  const { label, urgent, overdue } = dayLabel(lead.follow_up_date);
  return (
    <Link
      href="/admin/marketing/leads"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm ${
        overdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{lead.company_name}</p>
        {lead.contact_name && <p className="text-[10px] text-gray-400">{lead.contact_name}</p>}
      </div>
      <span className={`text-[11px] font-semibold shrink-0 ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-gray-400'}`}>
        {label}
      </span>
      <ArrowRight size={12} className="text-gray-300 shrink-0" />
    </Link>
  );
}

function SubtaskRow({ subtask, onDone }: { subtask: MySubtask; onDone: (id: string) => void }) {
  const handleDone = async () => {
    await fetch(`/api/jobs/subtasks/${subtask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    onDone(subtask.id);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white border-gray-200 hover:border-gray-300">
      <button onClick={handleDone} className="w-4 h-4 rounded border border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors shrink-0" title="Mark done" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{subtask.title}</p>
        {subtask.job && (
          <p className="text-[10px] text-gray-400 truncate">{subtask.job.job_number} · {subtask.job.project_name}</p>
        )}
      </div>
      {subtask.due_date && (
        <span className="text-[11px] text-gray-400 shrink-0">
          {new Date(subtask.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyWorkPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Hooks must be defined before any early return
  const handleJobClick = useCallback((id: string) => setSelectedJobId(id), []);
  const handleClose    = useCallback(() => setSelectedJobId(null), []);

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
  }, [profile, authLoading, router]);

  if (authLoading || !profile) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-gray-400" />
      </div>
    );
  }

  const role = profile.role;
  const name = profile.full_name?.split(' ')[0] || 'You';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-400">{greeting},</p>
        <h1 className="text-2xl font-bold text-gray-900">{name}&apos;s Work</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Role-specific content */}
      {role === 'designer'  && <DesignerWork userId={profile.id} onJobClick={handleJobClick} />}
      {role === 'admin'     && <AdminWork onJobClick={handleJobClick} />}
      {role === 'marketing' && <MarketingWork userId={profile.id} />}
      {role === 'dispatch'  && <DispatchWork onJobClick={handleJobClick} />}

      {/* Fallback for unknown roles */}
      {!['designer', 'admin', 'marketing', 'dispatch'].includes(role || '') && (
        <AdminWork onJobClick={handleJobClick} />
      )}

      {/* Inline Job Detail Modal */}
      {selectedJobId && (
        <JobDetailModal jobId={selectedJobId} onClose={handleClose} />
      )}
    </div>
  );
}
