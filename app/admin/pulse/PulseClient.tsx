'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft, RefreshCw, CheckCircle2, TrendingUp, PlusCircle,
  AlertTriangle, Clock, Wallet, Layers, Trophy, ChevronDown, FileText,
} from 'lucide-react';
import type { EodSnapshot, WeeklyScorecard, JobBrief, FinancialSnapshot, InvoiceBrief } from '@/lib/eod-metrics';

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
      className="block px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition"
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="font-semibold text-slate-800 whitespace-nowrap shrink-0">{j.job_number || '?'}</span>
        <span className="text-slate-600 truncate min-w-0" title={j.project_name ?? undefined}>{j.project_name}</span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="text-xs text-slate-500 truncate min-w-0">{j.stage_name}</span>
        {badge && <span className="text-xs font-bold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">{badge}</span>}
      </div>
    </Link>
  );
}

function InvoiceRow({ inv }: { inv: InvoiceBrief }) {
  const client = inv.client_company || inv.client_name || 'Unknown';
  const badge = inv.days_overdue
    ? `${inv.days_overdue}d overdue`
    : inv.days_until_due != null
    ? `due in ${inv.days_until_due}d`
    : '';
  return (
    <div className="px-3 py-2 rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-200 transition">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="font-semibold text-slate-800 whitespace-nowrap shrink-0">{inv.invoice_number}</span>
        <span className="text-slate-600 truncate min-w-0" title={client}>{client}</span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="text-sm text-slate-700 whitespace-nowrap">{inr(inv.total_amount)}</span>
        {badge && <span className="text-xs font-bold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">{badge}</span>}
      </div>
    </div>
  );
}

/**
 * A list section with a stable id anchor. The Telegram EOD report links straight
 * to these ids, so a section that the link points at auto-expands to show every
 * row — the whole reason this page exists is that "…and 31 more" was a dead end.
 */
function Panel<T>({
  id, title, icon, tone, items, render, preview = 12, openAll,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  tone: 'green' | 'amber' | 'red' | 'slate';
  items: T[];
  render: (item: T, i: number) => React.ReactNode;
  preview?: number;
  openAll?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || !!openAll;
  const head: Record<string, string> = {
    green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700', slate: 'text-slate-700',
  };
  const visible = showAll ? items : items.slice(0, preview);
  const hidden = items.length - visible.length;

  return (
    <div id={id} className="rounded-xl border border-slate-200 bg-white p-4 scroll-mt-4">
      <div className={`flex items-center gap-2 font-semibold mb-2 ${head[tone]}`}>
        {icon}{title}
        <span className="ml-auto text-sm bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 py-4 text-center">Nothing here — all clear.</div>
      ) : (
        <>
          <div className="space-y-0.5">{visible.map(render)}</div>
          {hidden > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg py-2"
            >
              <ChevronDown size={15} /> Show all {items.length} ({hidden} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function PulseClient({
  snapshot, weekly, financial,
}: {
  snapshot: EodSnapshot; weekly: WeeklyScorecard; financial: FinancialSnapshot;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const s = snapshot;
  const fin = financial;

  // Arriving from a Telegram "…and N more" link: open that section fully.
  const [target, setTarget] = useState<string>('');
  useEffect(() => {
    const apply = () => setTarget(window.location.hash.replace('#', ''));
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

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

      {/* Exception panels — full width so rows have room */}
      <div className="space-y-4 mb-6">
        <Panel
          id="overdue"
          title="Past deadline"
          icon={<Clock size={16} />}
          tone="red"
          items={s.overdue}
          openAll={target === 'overdue'}
          render={(j) => <JobRow key={j.id} j={j} badge={`${j.days_overdue}d over`} />}
        />
        <Panel
          id="stuck"
          title="Stuck — no movement"
          icon={<AlertTriangle size={16} />}
          tone="amber"
          items={s.stuck}
          openAll={target === 'stuck'}
          render={(j) => <JobRow key={j.id} j={j} badge={`${j.days_idle}d idle`} />}
        />
      </div>

      <div className="mb-6">
        <Panel
          id="done-today"
          title="Completed today"
          icon={<CheckCircle2 size={16} />}
          tone="green"
          items={s.doneToday}
          preview={20}
          openAll={target === 'done-today'}
          render={(j) => <JobRow key={j.id} j={j} />}
        />
      </div>

      {/* Invoices — the other half of the 7:30 PM Telegram report */}
      <div className="mb-6">
        <div className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
          <FileText size={16} /> Invoice status
          <span className="ml-auto text-sm text-slate-500">
            Outstanding <b className="text-slate-800">{inr(fin.totalOutstanding)}</b>
            <span className="mx-2 text-slate-300">|</span>
            Pending <b className="text-slate-800">{inr(fin.totalPending)}</b>
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            id="inv-overdue"
            title="Overdue"
            icon={<AlertTriangle size={16} />}
            tone="red"
            items={fin.overdue}
            preview={8}
            openAll={target === 'inv-overdue'}
            render={(inv) => <InvoiceRow key={inv.invoice_number} inv={inv} />}
          />
          <Panel
            id="inv-pending"
            title="Pending"
            icon={<Clock size={16} />}
            tone="amber"
            items={fin.pending}
            preview={8}
            openAll={target === 'inv-pending'}
            render={(inv) => <InvoiceRow key={inv.invoice_number} inv={inv} />}
          />
          <Panel
            id="inv-partial"
            title="Part paid"
            icon={<Wallet size={16} />}
            tone="slate"
            items={fin.partial}
            preview={8}
            openAll={target === 'inv-partial'}
            render={(inv) => <InvoiceRow key={inv.invoice_number} inv={inv} />}
          />
        </div>
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
