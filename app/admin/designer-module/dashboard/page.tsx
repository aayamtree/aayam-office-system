'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, AlertTriangle, Clock, Activity, BarChart3, Search,
  RefreshCw, ChevronRight, Timer, Repeat2, AlertCircle,
  CheckCircle2, TrendingUp, Calendar, Inbox
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  summary: { active: number; idle: number; offline: number; absent: number; total_tasks: number; active_tasks: number };
  designer_board: any[];
  pipeline: Record<string, any[]>;
  alerts: any[];
  top_tasks: any[];
  designer_productivity: any[];
  attendance_log: any[];
  recent_activity: any[];
  generated_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500', idle: 'bg-yellow-400', offline: 'bg-gray-400', absent: 'bg-red-400',
};
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700', idle: 'bg-yellow-100 text-yellow-700',
  offline: 'bg-gray-100 text-gray-600', absent: 'bg-red-100 text-red-600',
};
const PIPELINE_COLORS: Record<string, string> = {
  live: 'bg-green-50 border-green-200', hold: 'bg-orange-50 border-orange-200',
  review: 'bg-blue-50 border-blue-200', rework: 'bg-red-50 border-red-200',
  end: 'bg-emerald-50 border-emerald-200',
};
const PIPELINE_BADGE: Record<string, string> = {
  live: 'bg-green-500 text-white', hold: 'bg-orange-500 text-white',
  review: 'bg-blue-500 text-white', rework: 'bg-red-500 text-white',
  end: 'bg-emerald-500 text-white',
};
const ALERT_COLORS: Record<string, { bg: string; icon: string }> = {
  long_review:        { bg: 'bg-blue-50 border-blue-200 text-blue-800', icon: '⏱️' },
  high_rework:        { bg: 'bg-red-50 border-red-200 text-red-800', icon: '🔁' },
  stale_hold:         { bg: 'bg-orange-50 border-orange-200 text-orange-800', icon: '⏸️' },
  overdue:            { bg: 'bg-red-50 border-red-200 text-red-900', icon: '🚨' },
  idle_designer:      { bg: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '😴' },
  absent_with_tasks:  { bg: 'bg-purple-50 border-purple-200 text-purple-800', icon: '👤' },
};

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function SectionTitle({ icon: Icon, title, count, color = 'text-gray-700' }: any) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className={color} />
      <h2 className="font-bold text-base text-gray-800">{title}</h2>
      {count !== undefined && (
        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function DesignerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(0); // seconds ago
  const [dossierSearch, setDossierSearch] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/designer-module/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        setLastUpdated(0);
      }
    } catch (e) { console.error('Dashboard fetch failed', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => { fetchDashboard(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Tick seconds since last update
  useEffect(() => {
    const t = setInterval(() => setLastUpdated(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw size={28} className="animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-red-500 p-4">Failed to load dashboard data.</div>;
  }

  const { summary, designer_board, pipeline, alerts, top_tasks, designer_productivity, attendance_log, recent_activity } = data;

  const filteredActivity = dossierSearch
    ? recent_activity.filter(e =>
        e.task_code.toLowerCase().includes(dossierSearch.toLowerCase()) ||
        e.actor.toLowerCase().includes(dossierSearch.toLowerCase()) ||
        e.entry_type.toLowerCase().includes(dossierSearch.toLowerCase())
      )
    : recent_activity;

  return (
    <div className="space-y-8 max-w-screen-2xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Designer Command Centre</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time operations dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          {alerts.length > 0 && (
            <span className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-semibold">
              <AlertTriangle size={14} /> {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={fetchDashboard} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <span className="text-xs text-gray-400">Updated {lastUpdated}s ago</span>
        </div>
      </div>

      {/* ── Summary Bar ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Active', val: summary.active, color: 'text-green-600 bg-green-50 border-green-100' },
          { label: 'Idle',   val: summary.idle,   color: 'text-yellow-600 bg-yellow-50 border-yellow-100' },
          { label: 'Offline',val: summary.offline, color: 'text-gray-500 bg-gray-50 border-gray-100' },
          { label: 'Absent', val: summary.absent,  color: 'text-red-600 bg-red-50 border-red-100' },
          { label: 'Tasks Active', val: summary.active_tasks, color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Total Tasks', val: summary.total_tasks, color: 'text-purple-600 bg-purple-50 border-purple-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
            <div className="text-2xl font-bold">{s.val}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Row 1: Designer Status Board + Alerts ──────────────────────────── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Panel 1 — Designer Status Board */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <SectionTitle icon={Users} title="Designer Status Board" color="text-blue-600" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Designer', 'Status', 'Logged In', 'Current Task', 'Hours Today'].map(h => (
                    <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {designer_board.map((d, i) => (
                  <tr key={d.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} border-b border-gray-50`}>
                    <td className="py-2.5 font-medium text-gray-800">{d.full_name}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[d.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[d.status]}`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500">{fmtTime(d.login_time)}</td>
                    <td className="py-2.5">
                      {d.current_task
                        ? <Link href={`/admin/designer-module/tasks/${d.current_task.id}`} className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1">{d.current_task.code} <ChevronRight size={10} /></Link>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="py-2.5 font-medium text-gray-700">{d.hours_worked}h</td>
                  </tr>
                ))}
                {designer_board.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No designers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 3 — Alerts */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <SectionTitle icon={AlertTriangle} title="Alerts" count={alerts.length} color="text-red-500" />
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm">All clear!</p>
              </div>
            ) : alerts.map((a, i) => {
              const style = ALERT_COLORS[a.type] || { bg: 'bg-gray-50 border-gray-200 text-gray-700', icon: '⚠️' };
              return (
                <div key={i} className={`border rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 ${style.bg}`}>
                  <span className="flex items-center gap-1.5">
                    <span>{style.icon}</span>
                    <span className="font-medium truncate">{a.label}</span>
                  </span>
                  {a.task_id && (
                    <Link href={`/admin/designer-module/tasks/${a.task_id}`} className="shrink-0 text-xs underline opacity-70">View</Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Panel 2: Task Pipeline Kanban ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <SectionTitle icon={Activity} title="Task Pipeline" color="text-indigo-600" />
        <div className="grid grid-cols-5 gap-3">
          {(['live', 'hold', 'review', 'rework', 'end'] as const).map(status => (
            <div key={status} className={`rounded-xl border-2 p-3 ${PIPELINE_COLORS[status]}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${PIPELINE_BADGE[status]}`}>{status}</span>
                <span className="text-lg font-bold text-gray-700">{pipeline[status]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {(pipeline[status] || []).slice(0, 5).map((t: any) => (
                  <Link key={t.id} href={`/admin/designer-module/tasks/${t.id}`}
                    className="block bg-white/80 rounded-lg p-2 text-xs hover:shadow-sm transition-shadow border border-white">
                    <div className="font-mono text-gray-500 mb-0.5">{t.code}</div>
                    <div className="font-medium text-gray-800 truncate">{t.client}</div>
                    <div className="text-gray-400 truncate">{t.designer}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-400">{t.hours_in_status}h in status</span>
                      {t.rework_count > 0 && <span className="text-red-500 flex items-center gap-0.5"><Repeat2 size={10} />#{t.rework_count}</span>}
                    </div>
                  </Link>
                ))}
                {(pipeline[status] || []).length > 5 && (
                  <p className="text-xs text-center text-gray-400">+{pipeline[status].length - 5} more</p>
                )}
                {(pipeline[status] || []).length === 0 && (
                  <div className="text-center py-3 text-gray-300 text-xs">Empty</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 3: Time Summary + Attendance Log ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Panel 4 — Work Time Summary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <SectionTitle icon={Timer} title="Work Time Summary" color="text-purple-600" />

          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Top Tasks by Time</p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Task', 'Client', 'Designer', 'Hours', 'Reworks'].map(h => (
                    <th key={h} className="pb-1.5 text-left text-gray-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top_tasks.slice(0, 6).map(t => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="py-1.5"><Link href={`/admin/designer-module/tasks/${t.id}`} className="font-mono text-blue-600 hover:underline">{t.code}</Link></td>
                    <td className="py-1.5 text-gray-600 truncate max-w-[80px]">{t.client}</td>
                    <td className="py-1.5 text-gray-600 truncate max-w-[80px]">{t.designer}</td>
                    <td className="py-1.5 font-semibold text-gray-800">{t.total_hours ?? 0}h</td>
                    <td className="py-1.5 text-center">{t.rework_count > 0 ? <span className="text-red-500">#{t.rework_count}</span> : <span className="text-gray-300">0</span>}</td>
                  </tr>
                ))}
                {top_tasks.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-300">No time data yet</td></tr>}
              </tbody>
            </table>
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Designer Productivity</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Designer', 'Done', 'Total Hrs', 'Avg/Task', 'Reworks'].map(h => (
                    <th key={h} className="pb-1.5 text-left text-gray-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {designer_productivity.map(d => (
                  <tr key={d.id} className="border-b border-gray-50">
                    <td className="py-1.5 font-medium text-gray-800">{d.full_name}</td>
                    <td className="py-1.5 text-center">{d.tasks_done}</td>
                    <td className="py-1.5">{d.total_hours ?? 0}h</td>
                    <td className="py-1.5">{d.avg_per_task ?? 0}h</td>
                    <td className="py-1.5 text-center">{d.rework_count > 0 ? <span className="text-red-500">{d.rework_count}</span> : '0'}</td>
                  </tr>
                ))}
                {designer_productivity.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-300">No data yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 5 — Attendance Log */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <SectionTitle icon={Calendar} title="Attendance Log (Today)" color="text-teal-600" />
          <Link href="/admin/designer-module/attendance" className="text-xs text-blue-500 hover:underline block -mt-2 mb-3">View full history →</Link>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Designer', 'Status', 'Login', 'Logout', 'Hours'].map(h => (
                    <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendance_log.map((d, i) => (
                  <tr key={d.id} className={`${i % 2 === 0 ? '' : 'bg-gray-50/50'} border-b border-gray-50`}>
                    <td className="py-2 font-medium text-gray-800">{d.full_name}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[d.status]}`}>{d.status}</span>
                    </td>
                    <td className="py-2 text-gray-500 text-xs">{fmtTime(d.login_time)}</td>
                    <td className="py-2 text-gray-500 text-xs">{fmtTime(d.logout_time)}</td>
                    <td className="py-2 font-medium text-gray-700">{d.hours_worked}h</td>
                  </tr>
                ))}
                {attendance_log.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-300">No attendance data today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Panel 6: Quick Dossier / Recent Activity ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <SectionTitle icon={Search} title="Quick Dossier / Recent Activity" color="text-gray-600" />
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={dossierSearch}
              onChange={e => setDossierSearch(e.target.value)}
              placeholder="Search by task code, designer, or event..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <Link href="/admin/designer-module/dossier-search"
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            Full Search →
          </Link>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {filteredActivity.length === 0
            ? <div className="text-center py-6 text-gray-300"><Inbox size={24} className="mx-auto mb-1" /><p className="text-sm">No recent activity</p></div>
            : filteredActivity.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-16 shrink-0">{fmtTime(e.created_at)}</span>
                <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
                  {e.entry_type.replace(/_/g, ' ')}
                </span>
                <Link href={`/admin/designer-module/tasks/${e.task_id}`} className="font-mono text-xs text-blue-600 hover:underline shrink-0">{e.task_code}</Link>
                <span className="text-xs text-gray-500 truncate">{e.actor}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
