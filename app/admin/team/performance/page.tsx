'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Palette, Truck, Trophy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type Profile = { id: string; full_name: string; role: string };
type TabKey = 'marketing' | 'designers' | 'dispatch';
type RangeKey = 'month' | 'quarter' | 'fy' | 'all';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Inclusive lower bound for the selected range.
function rangeStart(range: RangeKey): Date | null {
  const now = new Date();
  if (range === 'all') return null;
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  // Indian financial year starts 1 April
  return now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)
    : new Date(now.getFullYear() - 1, 3, 1);
}

export default function TeamPerformancePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabKey>('marketing');
  const [range, setRange] = useState<RangeKey>('month');
  const [loading, setLoading] = useState(true);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [designTasks, setDesignTasks] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [p, q, d, dp] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role').order('full_name'),
        supabase.from('quotations').select('id, created_by, total_amount, status, converted_to_job_id, created_at, client:clients(source, assigned_marketing_user_id, created_by)'),
        supabase.from('design_tasks').select('id, assigned_to, current_status, status, actual_hours, estimated_hours, rework_count, deadline, created_at, updated_at'),
        supabase.from('dispatches').select('id, dispatched_by, dispatch_date, created_at, expected_delivery, actual_delivery, status'),
      ]);
      if (!active) return;
      setProfiles(p.data || []);
      setQuotations(q.data || []);
      setDesignTasks(d.data || []);
      setDispatches(dp.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const start = useMemo(() => rangeStart(range), [range]);
  const inRange = (iso?: string | null) => {
    if (!start) return true;
    if (!iso) return false;
    return new Date(iso) >= start;
  };
  const nameFor = (id?: string | null) =>
    id ? (profiles.find(p => p.id === id)?.full_name || 'Unknown') : 'Unknown';

  // Resolve a quote's marketing owner (client's assigned marketing person,
  // else whoever created the quote) — same rule as the Quotations page.
  const quoteOwner = (q: any): string | null => {
    const c = q.client || {};
    if (c.source === 'marketing' && c.assigned_marketing_user_id) return c.assigned_marketing_user_id;
    return q.created_by || c.created_by || null;
  };

  // ---- Marketing leaderboard ----
  const marketingRows = useMemo(() => {
    const map = new Map<string, { id: string; quotes: number; pipeline: number; converted: number; revenue: number }>();
    profiles.filter(p => p.role === 'marketing').forEach(p =>
      map.set(p.id, { id: p.id, quotes: 0, pipeline: 0, converted: 0, revenue: 0 }));
    quotations.filter(q => inRange(q.created_at)).forEach(q => {
      const owner = quoteOwner(q);
      if (!owner) return;
      if (!map.has(owner)) map.set(owner, { id: owner, quotes: 0, pipeline: 0, converted: 0, revenue: 0 });
      const r = map.get(owner)!;
      r.quotes += 1;
      r.pipeline += q.total_amount || 0;
      if (q.converted_to_job_id || q.status === 'accepted') {
        r.converted += 1;
        r.revenue += q.total_amount || 0;
      }
    });
    return Array.from(map.values())
      .map(r => ({ ...r, conversion: r.quotes ? Math.round((r.converted / r.quotes) * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue || b.quotes - a.quotes);
  }, [profiles, quotations, start]);

  // ---- Designer leaderboard (centred on execution time) ----
  const designerRows = useMemo(() => {
    const map = new Map<string, { id: string; assigned: number; completed: number; hoursSum: number; hoursCount: number; estSum: number; estCount: number; reworkSum: number; onTime: number; onTimeBase: number }>();
    profiles.filter(p => p.role === 'designer').forEach(p =>
      map.set(p.id, { id: p.id, assigned: 0, completed: 0, hoursSum: 0, hoursCount: 0, estSum: 0, estCount: 0, reworkSum: 0, onTime: 0, onTimeBase: 0 }));
    designTasks.filter(t => inRange(t.created_at)).forEach(t => {
      const who = t.assigned_to;
      if (!who) return;
      if (!map.has(who)) map.set(who, { id: who, assigned: 0, completed: 0, hoursSum: 0, hoursCount: 0, estSum: 0, estCount: 0, reworkSum: 0, onTime: 0, onTimeBase: 0 });
      const r = map.get(who)!;
      r.assigned += 1;
      r.reworkSum += t.rework_count || 0;
      const done = t.current_status === 'end' || t.status === 'completed';
      if (done) {
        r.completed += 1;
        if (t.actual_hours != null) { r.hoursSum += Number(t.actual_hours); r.hoursCount += 1; }
        if (t.actual_hours != null && t.estimated_hours) { r.estSum += Number(t.actual_hours); r.estCount += Number(t.estimated_hours); }
        if (t.deadline) {
          r.onTimeBase += 1;
          if (t.updated_at && new Date(t.updated_at) <= new Date(t.deadline)) r.onTime += 1;
        }
      }
    });
    return Array.from(map.values())
      .map(r => ({
        id: r.id,
        assigned: r.assigned,
        completed: r.completed,
        avgHours: r.hoursCount ? r.hoursSum / r.hoursCount : null,
        estAccuracy: r.estCount ? Math.round((r.estSum / r.estCount) * 100) : null,
        avgRework: r.assigned ? r.reworkSum / r.assigned : 0,
        onTimePct: r.onTimeBase ? Math.round((r.onTime / r.onTimeBase) * 100) : null,
      }))
      .sort((a, b) => b.completed - a.completed);
  }, [profiles, designTasks, start]);

  // ---- Dispatch leaderboard (turnaround + on-time) ----
  const dispatchRows = useMemo(() => {
    const map = new Map<string, { id: string; dispatched: number; turnSum: number; turnCount: number; delivered: number; onTime: number; onTimeBase: number }>();
    profiles.filter(p => p.role === 'dispatch').forEach(p =>
      map.set(p.id, { id: p.id, dispatched: 0, turnSum: 0, turnCount: 0, delivered: 0, onTime: 0, onTimeBase: 0 }));
    dispatches.filter(d => inRange(d.dispatch_date || d.created_at)).forEach(d => {
      const who = d.dispatched_by;
      if (!who) return;
      if (!map.has(who)) map.set(who, { id: who, dispatched: 0, turnSum: 0, turnCount: 0, delivered: 0, onTime: 0, onTimeBase: 0 });
      const r = map.get(who)!;
      r.dispatched += 1;
      if (d.dispatch_date && d.created_at) {
        const days = (new Date(d.dispatch_date).getTime() - new Date(d.created_at).getTime()) / 86400000;
        if (days >= 0) { r.turnSum += days; r.turnCount += 1; }
      }
      if (d.actual_delivery) {
        r.delivered += 1;
        if (d.expected_delivery) {
          r.onTimeBase += 1;
          if (new Date(d.actual_delivery) <= new Date(d.expected_delivery)) r.onTime += 1;
        }
      }
    });
    return Array.from(map.values())
      .map(r => ({
        id: r.id,
        dispatched: r.dispatched,
        avgTurn: r.turnCount ? r.turnSum / r.turnCount : null,
        delivered: r.delivered,
        onTimePct: r.onTimeBase ? Math.round((r.onTime / r.onTimeBase) * 100) : null,
      }))
      .sort((a, b) => b.dispatched - a.dispatched);
  }, [profiles, dispatches, start]);

  if (profile && profile.role !== 'admin') {
    return (
      <div className="p-12 text-center text-gray-500 bg-white rounded-md border border-gray-200">
        This report is available to admins only.
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'marketing', label: 'Marketing', icon: TrendingUp },
    { key: 'designers', label: 'Designers', icon: Palette },
    { key: 'dispatch', label: 'Dispatch', icon: Truck },
  ];

  const th = 'text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider';
  const td = 'px-4 py-3 text-sm text-gray-800';
  const rankBadge = (i: number) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="p-2 hover:bg-gray-100 rounded-md lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-page-title text-gray-900 flex items-center gap-2">
              <Trophy size={22} /> Team Performance
            </h1>
            <p className="text-sm text-gray-500">Per-person scorecards across marketing, design and dispatch</p>
          </div>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          className="w-auto px-3 py-2 border border-gray-200 rounded-md bg-white text-sm"
        >
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="fy">This Financial Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-md border border-gray-200">Loading…</div>
      ) : (
        <div className="bg-white rounded-md border border-gray-200 overflow-x-auto">
          {/* MARKETING */}
          {tab === 'marketing' && (
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Marketing Person</th>
                  <th className={th}>Quotes</th>
                  <th className={th}>Pipeline Value</th>
                  <th className={th}>Converted</th>
                  <th className={th}>Conversion</th>
                  <th className={th}>Order Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {marketingRows.length === 0 ? (
                  <tr><td className={td} colSpan={7}>No marketing data in this period yet.</td></tr>
                ) : marketingRows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={td}>{rankBadge(i)}</td>
                    <td className={`${td} font-medium text-gray-900`}>{nameFor(r.id)}</td>
                    <td className={td}>{r.quotes}</td>
                    <td className={td}>{formatCurrency(r.pipeline)}</td>
                    <td className={td}>{r.converted}</td>
                    <td className={td}>{r.conversion}%</td>
                    <td className={`${td} font-semibold text-green-700`}>{formatCurrency(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* DESIGNERS */}
          {tab === 'designers' && (
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Designer</th>
                  <th className={th}>Assigned</th>
                  <th className={th}>Completed</th>
                  <th className={th} title="Average actual hours per completed task — your execution-time rating">Avg Time / Task</th>
                  <th className={th} title="Actual hours ÷ estimated hours (100% = on estimate)">Est. Accuracy</th>
                  <th className={th}>Avg Rework</th>
                  <th className={th}>On-time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {designerRows.length === 0 ? (
                  <tr><td className={td} colSpan={8}>No design tasks in this period yet.</td></tr>
                ) : designerRows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={td}>{rankBadge(i)}</td>
                    <td className={`${td} font-medium text-gray-900`}>{nameFor(r.id)}</td>
                    <td className={td}>{r.assigned}</td>
                    <td className={td}>{r.completed}</td>
                    <td className={`${td} font-semibold text-gray-900`}>{r.avgHours != null ? `${r.avgHours.toFixed(1)} h` : '—'}</td>
                    <td className={td}>{r.estAccuracy != null ? `${r.estAccuracy}%` : '—'}</td>
                    <td className={td}>{r.avgRework.toFixed(1)}</td>
                    <td className={td}>{r.onTimePct != null ? `${r.onTimePct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* DISPATCH */}
          {tab === 'dispatch' && (
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Dispatch Person</th>
                  <th className={th}>Dispatched</th>
                  <th className={th} title="Average days from dispatch record created to dispatched">Avg Turnaround</th>
                  <th className={th}>Delivered</th>
                  <th className={th} title="Delivered on or before expected date">On-time Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dispatchRows.length === 0 ? (
                  <tr><td className={td} colSpan={6}>No dispatches in this period yet.</td></tr>
                ) : dispatchRows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={td}>{rankBadge(i)}</td>
                    <td className={`${td} font-medium text-gray-900`}>{nameFor(r.id)}</td>
                    <td className={td}>{r.dispatched}</td>
                    <td className={`${td} font-semibold text-gray-900`}>{r.avgTurn != null ? `${r.avgTurn.toFixed(1)} d` : '—'}</td>
                    <td className={td}>{r.delivered}</td>
                    <td className={td}>{r.onTimePct != null ? `${r.onTimePct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Numbers build up as work flows through the system. Designer timing comes from the design-task
        timer and hours logged; dispatch turnaround from dispatch dates; marketing from quotes that
        convert to orders.
      </p>
    </div>
  );
}
