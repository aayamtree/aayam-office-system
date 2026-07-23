'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getStageName, ALL_WORKFLOW_STAGES } from '@/lib/job-workflow';
import {
  AlertTriangle, Clock, User, Building2,
  RefreshCw, Loader2, ArrowRight, ChevronDown, ChevronUp, X, Filter
} from 'lucide-react';

interface OverdueJob {
  id: string;
  job_number: string;
  project_name: string;
  client_deadline: string;
  current_stage: string;
  priority: string;
  job_type: string | null;
  designer_id: string | null;
  client_id: string | null;
  client_name: string;
  designer_name: string;
  days_overdue: number;
}

// Stage labels from the single source of truth (lib/job-workflow.ts)
const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  [...ALL_WORKFLOW_STAGES, 'awaiting_admin'].map(s => [s, getStageName(s)])
);

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border border-red-200',
  high: 'bg-orange-100 text-orange-700 border border-orange-200',
  normal: 'bg-gray-100 text-gray-600 border border-gray-200',
};

function urgencyClass(days: number) {
  if (days >= 7) return 'bg-red-50 border-l-red-600';
  if (days >= 3) return 'bg-orange-50 border-l-orange-500';
  return 'bg-amber-50 border-l-amber-400';
}

function urgencyBadge(days: number) {
  if (days >= 7) return 'bg-red-600 text-white';
  if (days >= 3) return 'bg-orange-500 text-white';
  return 'bg-amber-400 text-white';
}

type UrgencyFilter = 'all' | 'critical' | 'warning' | 'mild';

export default function OverduePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<OverdueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'days' | 'priority' | 'designer'>('days');
  const [sortAsc, setSortAsc] = useState(false);

  // ── Filters ─────────────────────────────────────────────────────────
  const [filterDesigner, setFilterDesigner] = useState<string | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<UrgencyFilter>('all');
  const [filterStage, setFilterStage] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterJobType, setFilterJobType] = useState<string | null>(null);

  const hasAnyFilter = filterDesigner || filterUrgency !== 'all' || filterStage || filterPriority || filterJobType;

  const clearAllFilters = () => {
    setFilterDesigner(null);
    setFilterUrgency('all');
    setFilterStage(null);
    setFilterPriority(null);
    setFilterJobType(null);
  };

  const fetchOverdue = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: jobData, error } = await supabase
        .from('jobs')
        .select('id, job_number, project_name, client_deadline, current_stage, priority, job_type, designer_id, client_id')
        .lt('client_deadline', today)
        .not('current_stage', 'in', '("delivered","cancelled","completed","file_sent_client")')
        .order('client_deadline', { ascending: true });

      if (error) throw error;
      if (!jobData || jobData.length === 0) { setJobs([]); return; }

      const clientIds: string[] = [];
      const designerIds: string[] = [];
      const seenC = new Set<string>();
      const seenD = new Set<string>();
      for (const j of jobData as any[]) {
        if (j.client_id && !seenC.has(j.client_id))  { seenC.add(j.client_id);  clientIds.push(j.client_id); }
        if (j.designer_id && !seenD.has(j.designer_id)) { seenD.add(j.designer_id); designerIds.push(j.designer_id); }
      }

      const [clientsRes, designersRes] = await Promise.all([
        clientIds.length > 0
          ? supabase.from('clients').select('id, name, company').in('id', clientIds as string[])
          : Promise.resolve({ data: [] }),
        designerIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', designerIds as string[])
          : Promise.resolve({ data: [] }),
      ]);

      const clientMap: Record<string, string> = {};
      (clientsRes.data || []).forEach((c: any) => {
        clientMap[c.id] = c.company || c.name || '—';
      });
      const designerMap: Record<string, string> = {};
      (designersRes.data || []).forEach((p: any) => {
        designerMap[p.id] = p.full_name || '—';
      });

      const enriched: OverdueJob[] = (jobData as any[]).map((j: any) => {
        const deadline = new Date(j.client_deadline);
        const now = new Date();
        const diffMs = now.getTime() - deadline.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return {
          ...j,
          client_name: j.client_id ? (clientMap[j.client_id] || '—') : '—',
          designer_name: j.designer_id ? (designerMap[j.designer_id] || 'Unassigned') : 'Unassigned',
          days_overdue: daysOverdue,
        };
      });

      setJobs(enriched);
    } catch (e) {
      console.error('Error fetching overdue jobs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverdue(); }, []);

  // ── Derived lists for filter chips ──────────────────────────────────
  const byDesigner = useMemo(() => {
    const map: Record<string, number> = {};
    jobs.forEach(j => { map[j.designer_name] = (map[j.designer_name] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const availableStages = useMemo(() => {
    const seen = new Set<string>();
    jobs.forEach(j => seen.add(j.current_stage));
    return Array.from(seen).sort();
  }, [jobs]);

  const availableJobTypes = useMemo(() => {
    const seen = new Set<string>();
    jobs.forEach(j => { if (j.job_type) seen.add(j.job_type); });
    return Array.from(seen).sort();
  }, [jobs]);

  // ── Stats (always on full list) ──────────────────────────────────────
  const critical = jobs.filter(j => j.days_overdue >= 7).length;
  const warning  = jobs.filter(j => j.days_overdue >= 3 && j.days_overdue < 7).length;
  const mild     = jobs.filter(j => j.days_overdue < 3).length;

  // ── Filtered + sorted ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = [...jobs];
    if (filterDesigner) arr = arr.filter(j => j.designer_name === filterDesigner);
    if (filterUrgency === 'critical') arr = arr.filter(j => j.days_overdue >= 7);
    else if (filterUrgency === 'warning') arr = arr.filter(j => j.days_overdue >= 3 && j.days_overdue < 7);
    else if (filterUrgency === 'mild') arr = arr.filter(j => j.days_overdue < 3);
    if (filterStage) arr = arr.filter(j => j.current_stage === filterStage);
    if (filterPriority) arr = arr.filter(j => j.priority === filterPriority);
    if (filterJobType) arr = arr.filter(j => j.job_type === filterJobType);

    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'days') cmp = b.days_overdue - a.days_overdue;
      else if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, normal: 2 };
        cmp = (order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2);
      } else if (sortBy === 'designer') {
        cmp = a.designer_name.localeCompare(b.designer_name);
      }
      return sortAsc ? -cmp : cmp;
    });
    return arr;
  }, [jobs, filterDesigner, filterUrgency, filterStage, filterPriority, filterJobType, sortBy, sortAsc]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(p => !p);
    else { setSortBy(col); setSortAsc(false); }
  };

  const toggleUrgency = (u: UrgencyFilter) => setFilterUrgency(prev => prev === u ? 'all' : u);
  const toggleDesigner = (name: string) => setFilterDesigner(prev => prev === name ? null : name);

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Overdue Jobs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Jobs that have passed their client deadline and are still in progress.
          </p>
        </div>
        <button
          onClick={fetchOverdue}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border rounded-md px-3 py-1.5 hover:bg-gray-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">All clear!</h2>
          <p className="text-sm text-gray-500 mt-1">No jobs are past their deadline right now.</p>
        </div>
      ) : (
        <>
          {/* ── Summary cards (click to filter by urgency) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={clearAllFilters}
              className={`text-left bg-white border rounded-lg p-4 transition-all hover:shadow-sm ${filterUrgency === 'all' && !hasAnyFilter ? 'ring-2 ring-gray-400' : 'opacity-80 hover:opacity-100'}`}
            >
              <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Overdue</p>
            </button>
            <button
              onClick={() => toggleUrgency('critical')}
              className={`text-left rounded-lg p-4 border transition-all hover:shadow-sm ${filterUrgency === 'critical' ? 'bg-red-100 border-red-400 ring-2 ring-red-400' : 'bg-red-50 border-red-100'}`}
            >
              <p className="text-2xl font-bold text-red-600">{critical}</p>
              <p className="text-xs text-red-500 mt-0.5">Critical (7+ days)</p>
            </button>
            <button
              onClick={() => toggleUrgency('warning')}
              className={`text-left rounded-lg p-4 border transition-all hover:shadow-sm ${filterUrgency === 'warning' ? 'bg-orange-100 border-orange-400 ring-2 ring-orange-400' : 'bg-orange-50 border-orange-100'}`}
            >
              <p className="text-2xl font-bold text-orange-600">{warning}</p>
              <p className="text-xs text-orange-500 mt-0.5">Warning (3–6 days)</p>
            </button>
            <button
              onClick={() => toggleUrgency('mild')}
              className={`text-left rounded-lg p-4 border transition-all hover:shadow-sm ${filterUrgency === 'mild' ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400' : 'bg-amber-50 border-amber-100'}`}
            >
              <p className="text-2xl font-bold text-amber-600">{mild}</p>
              <p className="text-xs text-amber-600 mt-0.5">Mild (1–2 days)</p>
            </button>
          </div>

          {/* ── Filter panel ── */}
          <div className="bg-white border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Filters
              </h3>
              {hasAnyFilter && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>

            {/* Designer filter */}
            {byDesigner.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> By Designer
                </p>
                <div className="flex flex-wrap gap-2">
                  {byDesigner.map(([name, count]) => {
                    const active = filterDesigner === name;
                    return (
                      <button
                        key={name}
                        onClick={() => toggleDesigner(name)}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition-all ${
                          active
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                      >
                        {name}
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Priority filter */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">By Priority</p>
              <div className="flex flex-wrap gap-2">
                {(['urgent', 'high', 'normal'] as const).map(p => {
                  const count = jobs.filter(j => j.priority === p).length;
                  if (count === 0) return null;
                  const active = filterPriority === p;
                  const colors: Record<string, string> = {
                    urgent: active ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                    high:   active ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
                    normal: active ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
                  };
                  return (
                    <button
                      key={p}
                      onClick={() => setFilterPriority(prev => prev === p ? null : p)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition-all ${colors[p]}`}
                    >
                      {p.toUpperCase()}
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-black/10'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage + Job Type on same row */}
            <div className="flex flex-wrap gap-4">
              {/* Stage dropdown */}
              {availableStages.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">By Stage</p>
                  <select
                    value={filterStage || ''}
                    onChange={e => setFilterStage(e.target.value || null)}
                    className={`text-sm border rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 ${filterStage ? 'border-gray-800 font-semibold' : 'border-gray-200 text-gray-600'}`}
                  >
                    <option value="">All Stages</option>
                    {availableStages.map(s => (
                      <option key={s} value={s}>{STAGE_LABELS[s] || s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Job Type dropdown */}
              {availableJobTypes.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">By Job Type</p>
                  <select
                    value={filterJobType || ''}
                    onChange={e => setFilterJobType(e.target.value || null)}
                    className={`text-sm border rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 ${filterJobType ? 'border-gray-800 font-semibold' : 'border-gray-200 text-gray-600'}`}
                  >
                    <option value="">All Job Types</option>
                    {availableJobTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── Jobs table ── */}
          <div className="bg-white border rounded-lg overflow-hidden">
            {/* Results count */}
            <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Showing <span className="font-bold text-gray-800">{filtered.length}</span> of <span className="font-semibold">{jobs.length}</span> overdue jobs
                {hasAnyFilter && (
                  <button onClick={clearAllFilters} className="ml-2 text-red-500 hover:text-red-700 underline">clear filters</button>
                )}
              </span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_1.5fr_1fr_120px_100px_100px_48px] gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:grid">
              <span>Job</span>
              <span>Project / Client</span>
              <button onClick={() => toggleSort('designer')} className="flex items-center gap-1 hover:text-gray-800">
                Designer <SortIcon col="designer" />
              </button>
              <span>Stage</span>
              <button onClick={() => toggleSort('days')} className="flex items-center gap-1 hover:text-gray-800">
                Overdue <SortIcon col="days" />
              </button>
              <button onClick={() => toggleSort('priority')} className="flex items-center gap-1 hover:text-gray-800">
                Priority <SortIcon col="priority" />
              </button>
              <span />
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No jobs match the selected filters.{' '}
                <button onClick={clearAllFilters} className="text-blue-500 hover:underline">Clear filters</button>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map(job => (
                  <div
                    key={job.id}
                    className={`border-l-4 ${urgencyClass(job.days_overdue)} grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_120px_100px_100px_48px] gap-2 md:gap-0 px-4 py-3 items-center hover:bg-black/[0.02] transition-colors`}
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-gray-700">{job.job_number}</span>
                      {job.job_type && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{job.job_type}</p>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{job.project_name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{job.client_name}</span>
                      </p>
                    </div>

                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <User className="w-3 h-3 shrink-0 text-gray-400" />
                      <button
                        onClick={() => toggleDesigner(job.designer_name)}
                        className={`truncate hover:underline hover:text-gray-900 transition-colors ${filterDesigner === job.designer_name ? 'font-bold text-gray-900' : ''}`}
                        title={`Filter by ${job.designer_name}`}
                      >
                        {job.designer_name}
                      </button>
                    </div>

                    <div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                        {STAGE_LABELS[job.current_stage] || job.current_stage}
                      </span>
                    </div>

                    <div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${urgencyBadge(job.days_overdue)}`}>
                        {job.days_overdue}d late
                      </span>
                    </div>

                    <div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${PRIORITY_BADGE[job.priority] || PRIORITY_BADGE.normal}`}>
                        {(job.priority || 'normal').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => router.push(`/admin/designers/tasks?task=${job.id}`)}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Open job"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            <Clock className="inline w-3 h-3 mr-1" />
            Based on client deadline. Delivered, cancelled, and design files sent to client are excluded.
          </p>
        </>
      )}
    </div>
  );
}
