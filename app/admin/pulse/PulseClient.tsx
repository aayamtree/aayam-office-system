'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft, RefreshCw, CheckCircle2, TrendingUp, PlusCircle,
  AlertTriangle, Clock, Wallet, Layers, Trophy,
} from 'lucide-react';
import type { EodSnapshot, WeeklyScorecard, JobBrief } from '@/lib/eod-metrics';

const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

function Stat({
  icon, label, value, sub, tone = 'slate',
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-white border-slate-200',
    green: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wide">
        {icon}{label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function JobRow({ j, badge }: { j: JobBrief; badge?: string }) {
  return (
    <Link
      href={`/admin/jobs/${j.id}`}
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition"
    >
      <div className="min-w-0">
        <span className="font-semibold text-slate-800">{j.job_number || '?'}</span>
        <span className="text-slate-500 ml-2 truncate">{j.project_name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-500">{j.stage_name}</span>
        {badge && <span className="text-xs font-bold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">{badge}</span>}
      </div>
    </Link>
  );
}

function Panel({
  title, icon, count, tone, children,
}: {
  title: string; icon: React.ReactNode; count: number;
  tone: 'green' | 'amber' | 'red'; children: React.ReactNode;
}) {
  const head: Record<string, string> = {
    green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`flex items-center gap-2 font-semibold mb-2 ${head[tone]}`}>
        {icon}{title}<span className="ml-auto text-sm bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{count}</span>
      </div>
      {count === 0
        ? <div className="text-sm text-slate-400 py-4 text-center">Nothing here — all clear.</div>
        : <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

export default function PulseClient({
  snapshot, weekly,
}: {
  snapshot: EodSnapshot; weekly: WeeklyScorecard;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const s = snapshot;

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/admin/dashboard" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">Daily Pulse</h1>
        <button
          onClick={refresh}
          className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      <p className="text-slate-500 mb-5">{s.dateLabel} · live view</p>

      {/* Today's stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={<CheckCircle2 size={14} />} label="Done today" value={String(s.doneToday.length)} tone="green" />
        <Stat icon={<TrendingUp size={14} />} label="Moved" value={String(s.movedToday)} tone="blue" />
        <Stat icon={<PlusCircle size={14} />} label="New" value={String(s.newToday)} tone="slate" />
        <Stat icon={<Wallet size={14} />} label="Collected today" value={inr(s.collectedToday)} sub={`${s.paymentsToday} payment${s.paymentsToday !== 1 ? 's' : ''}`} tone="green" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat icon={<Layers size={14} />} label="Active jobs" value={String(s.activeJobs)} tone="slate" />
        <Stat icon={<Wallet size={14} />} label="Pending (active)" value={inr(s.pendingActive)} tone="amber" />
        <Stat icon={<AlertTriangle size={14} />} label="Stuck 3+ days" value={String(s.stuck.length)} tone={s.stuck.length ? 'amber' : 'green'} />
        <Stat icon={<Clock size={14} />} label="Overdue" value={String(s.overdue.length)} tone={s.overdue.length ? 'red' : 'green'} />
      </div>

      {/* Exception panels */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Panel title="Stuck — no movement" icon={<AlertTriangle size={16} />} count={s.stuck.length} tone="amber">
          {s.stuck.slice(0, 12).map((j) => <JobRow key={j.id} j={j} badge={`${j.days_idle}d idle`} />)}
        </Panel>
        <Panel title="Past deadline" icon={<Clock size={16} />} count={s.overdue.length} tone="red">
          {s.overdue.slice(0, 12).map((j) => <JobRow key={j.id} j={j} badge={`${j.days_overdue}d over`} />)}
        </Panel>
      </div>

      <div className="mb-6">
        <Panel title="Completed today" icon={<CheckCircle2 size={16} />} count={s.doneToday.length} tone="green">
          {s.doneToday.slice(0, 20).map((j) => <JobRow key={j.id} j={j} />)}
        </Panel>
      </div>

      {/* Weekly scorecard */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
          <Trophy size={16} /> This week <span className="text-slate-400 font-normal">· {weekly.rangeLabel}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat icon={<CheckCircle2 size={14} />} label="Completed" value={String(weekly.completed)} tone="slate" />
          <Stat icon={<PlusCircle size={14} />} label="New" value={String(weekly.newJobs)} tone="slate" />
          <Stat icon={<Wallet size={14} />} label="Collected" value={inr(weekly.revenue)} tone="green" />
          <Stat icon={<Clock size={14} />} label="On-time" value={weekly.onTimePct === null ? '—' : `${weekly.onTimePct}%`} sub={weekly.onTimeSample ? `of ${weekly.onTimeSample}` : undefined} tone="blue" />
          <Stat icon={<TrendingUp size={14} />} label="Avg pipeline" value={weekly.avgPipelineDays === null ? '—' : `${weekly.avgPipelineDays}d`} tone="slate" />
        </div>
        {weekly.byPerson.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Completions by person</div>
            <div className="flex flex-wrap gap-2">
              {weekly.byPerson.map((p, i) => (
                <span key={p.name} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1 text-sm">
                  <span>{['🥇', '🥈', '🥉'][i] || '•'}</span>
                  <span className="text-slate-700">{p.name}</span>
                  <span className="font-bold text-slate-900">{p.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
