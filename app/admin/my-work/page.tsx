'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  CheckCircle2, Clock, AlertTriangle, Briefcase, ArrowRight,
  Loader2, Star, Users, Layers, BarChart3, Calendar,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MyJob {
  id: string;
  job_number: string;
  project_name: string;
  client_deadline: string | null;
  priority: string;
  current_stage: string;
  designer_status: string | null;
  client?: { name: string; company?: string } | null;
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

// ─── Section: Designer ───────────────────────────────────────────────────────

function DesignerWork({ userId }: { userId: string }) {
  const [jobs, setJobs]             = useState<MyJob[]>([]);
  const [subtasks, setSubtasks]     = useState<MySubtask[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];

      // Jobs assigned to this designer (via profiles join)
      // We match by designer_id which references profiles.id
      const [jobsRes, subtasksRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, job_number, project_name, client_deadline, priority, current_stage, designer_status, client:clients!client_id(name,company)')
          .eq('designer_id', userId)
          .not('current_stage', 'in', '("delivered","cancelled")')
          .order('client_deadline', { ascending: true, nullsFirst: false }),
        fetch('/api/jobs/my-subtasks').then(r => r.json()),
      ]);

      setJobs(jobsRes.data || []);
      setSubtasks(subtasksRes.data || []);
      setLoading(false);
    })();
  }, [userId]);

  const today = new Date().toISOString().split('T')[0];
  const dueToday   = jobs.filter(j => j.client_deadline === today);
  const thisWeek   = jobs.filter(j => {
    if (!j.client_deadline || j.client_deadline === today) return false;
    const diff = Math.round((new Date(j.client_deadline).getTime() - new Date(today).getTime()) / 86400000);
    return diff > 0 && diff <= 7;
  });
  const overdue    = jobs.filter(j => j.client_deadline && j.client_deadline < today);
  const later      = jobs.filter(j => {
    if (!j.client_deadline) return true;
    const diff = Math.round((new Date(j.client_deadline).getTime() - new Date(today).getTime()) / 86400000);
    return diff > 7;
  });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Jobs" value={jobs.length} icon={<Briefcase size={16} />} color="blue" />
        <StatCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={16} />} color={overdue.length > 0 ? 'red' : 'gray'} />
        <StatCard label="My Subtasks" value={subtasks.length} icon={<CheckCircle2 size={16} />} color="green" />
      </div>

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <Section title="My Subtasks" icon={<CheckCircle2 size={15} className="text-green-600" />}>
          {subtasks.map(s => (
            <SubtaskRow key={s.id} subtask={s} onDone={(id) => setSubtasks(prev => prev.filter(x => x.id !== id))} />
          ))}
        </Section>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <Section title="Overdue" icon={<AlertTriangle size={15} className="text-red-500" />} urgent>
          {overdue.map(j => <JobRow key={j.id} job={j} />)}
        </Section>
      )}

      {/* Due today */}
      {dueToday.length > 0 && (
        <Section title="Due Today" icon={<Star size={15} className="text-amber-500" />}>
          {dueToday.map(j => <JobRow key={j.id} job={j} />)}
        </Section>
      )}

      {/* This week */}
      {thisWeek.length > 0 && (
        <Section title="This Week" icon={<Calendar size={15} className="text-blue-500" />}>
          {thisWeek.map(j => <JobRow key={j.id} job={j} />)}
        </Section>
      )}

      {/* Later */}
      {later.length > 0 && (
        <Section title="Later" icon={<Clock size={15} className="text-gray-400" />} muted>
          {later.map(j => <JobRow key={j.id} job={j} />)}
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

function AdminWork() {
  const [overdue, setOverdue]         = useState<MyJob[]>([]);
  const [inProgress, setInProgress]   = useState<MyJob[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const [overdueRes, inProgRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, job_number, project_name, client_deadline, priority, current_stage, client:clients!client_id(name,company)')
          .lt('client_deadline', today)
          .not('current_stage', 'in', '("delivered","cancelled","completed")')
          .order('client_deadline', { ascending: true })
          .limit(15),
        supabase
          .from('jobs')
          .select('id, job_number, project_name, client_deadline, priority, current_stage, client:clients!client_id(name,company)')
          .in('current_stage', ['designing', 'revision', 'proof', 'printing', 'pre_press'])
          .gte('client_deadline', today)
          .order('client_deadline', { ascending: true })
          .limit(15),
      ]);
      setOverdue(overdueRes.data || []);
      setInProgress(inProgRes.data || []);
      setLoading(false);
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
          {overdue.map(j => <JobRow key={j.id} job={j} />)}
        </Section>
      )}

      {inProgress.length > 0 && (
        <Section title="Active Production" icon={<Layers size={15} className="text-blue-500" />}>
          {inProgress.map(j => <JobRow key={j.id} job={j} />)}
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
  const [leads, setLeads]   = useState<MyLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('leads')
        .select('id, company_name, contact_name, follow_up_date, status')
        .eq('assigned_to', userId)
        .not('status', 'in', '("converted","lost","closed")')
        .order('follow_up_date', { ascending: true, nullsFirst: false })
        .limit(30);
      setLeads(data || []);
      setLoading(false);
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

function DispatchWork() {
  const [jobs, setJobs]   = useState<MyJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, job_number, project_name, client_deadline, priority, current_stage, client:clients!client_id(name,company)')
        .in('current_stage', ['ready_to_dispatch', 'dispatched', 'qc'])
        .order('client_deadline', { ascending: true, nullsFirst: false })
        .limit(30);
      setJobs(data || []);
      setLoading(false);
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
          {overdue.map(j => <JobRow key={j.id} job={j} />)}
        </Section>
      )}

      {rest.length > 0 && (
        <Section title="Ready / In Dispatch" icon={<Layers size={15} className="text-blue-500" />}>
          {rest.map(j => <JobRow key={j.id} job={j} />)}
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

function JobRow({ job }: { job: MyJob }) {
  const { label, urgent, overdue } = dayLabel(job.client_deadline);
  const clientName = (job.client as any)?.company || (job.client as any)?.name || '';
  return (
    <Link
      href={`/admin/jobs?highlight=${job.id}`}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm ${
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
    </Link>
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
      {role === 'designer' && <DesignerWork userId={profile.id} />}
      {role === 'admin'    && <AdminWork />}
      {role === 'marketing' && <MarketingWork userId={profile.id} />}
      {role === 'dispatch'  && <DispatchWork />}

      {/* Fallback for unknown roles */}
      {!['designer', 'admin', 'marketing', 'dispatch'].includes(role || '') && (
        <AdminWork />
      )}
    </div>
  );
}
