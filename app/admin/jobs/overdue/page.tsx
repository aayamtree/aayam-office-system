'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle, Clock, User, Building2,
  RefreshCw, Loader2, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';

interface OverdueJob {
  id: string;
  job_number: string;
  project_name: string;
  client_deadline: string;
  current_stage: string;
  priority: string;
  designer_id: string | null;
  client_id: string | null;
  client_name: string;
  designer_name: string;
  days_overdue: number;
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  awaiting_admin: 'Awaiting Admin',
  designing: 'Designing',
  file_check: 'File Check',
  pre_print_qc: 'Pre-Print QC',
  approval: 'Client Approval',
  printing: 'Printing',
  finishing: 'Finishing',
  quality_check: 'QC',
  ready: 'Ready',
};

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

export default function OverduePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<OverdueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'days' | 'priority' | 'designer'>('days');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchOverdue = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch jobs past deadline that aren't delivered/cancelled
      const { data: jobData, error } = await supabase
        .from('jobs')
        .select('id, job_number, project_name, client_deadline, current_stage, priority, designer_id, client_id')
        .lt('client_deadline', today)
        .not('current_stage', 'in', '("delivered","cancelled","completed")')
        .order('client_deadline', { ascending: true });

      if (error) throw error;
      if (!jobData || jobData.length === 0) { setJobs([]); return; }

      // Fetch client/designer names — deduplicate without Set spread (avoids TS target issues)
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

  const sorted = useMemo(() => {
    const arr = [...jobs];
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
  }, [jobs, sortBy, sortAsc]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(p => !p);
    else { setSortBy(col); setSortAsc(false); }
  };

  // Stats
  const critical = jobs.filter(j => j.days_overdue >= 7).length;
  const warning = jobs.filter(j => j.days_overdue >= 3 && j.days_overdue < 7).length;
  const mild = jobs.filter(j => j.days_overdue < 3).length;

  // Overdue by designer
  const byDesigner = useMemo(() => {
    const map: Record<string, number> = {};
    jobs.forEach(j => {
      map[j.designer_name] = (map[j.designer_name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [jobs]);

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
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Overdue</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-2xl font-bold text-red-600">{critical}</p>
              <p className="text-xs text-red-500 mt-0.5">Critical (7+ days)</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-600">{warning}</p>
              <p className="text-xs text-orange-500 mt-0.5">Warning (3–6 days)</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-2xl font-bold text-amber-600">{mild}</p>
              <p className="text-xs text-amber-600 mt-0.5">Mild (1–2 days)</p>
            </div>
          </div>

          {/* Designer breakdown */}
          {byDesigner.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Overdue by Designer
              </h3>
              <div className="flex flex-wrap gap-2">
                {byDesigner.map(([name, count]) => (
                  <span key={name} className="flex items-center gap-1.5 bg-gray-50 border rounded-md px-3 py-1.5 text-sm">
                    <span className="font-medium text-gray-800">{name}</span>
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Jobs table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1.5fr_1fr_120px_100px_100px_48px] gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:grid">
              <span>Job</span>
              <span>Project / Client</span>
              <button
                onClick={() => toggleSort('designer')}
                className="flex items-center gap-1 hover:text-gray-800"
              >
                Designer <SortIcon col="designer" />
              </button>
              <span>Stage</span>
              <button
                onClick={() => toggleSort('days')}
                className="flex items-center gap-1 hover:text-gray-800"
              >
                Overdue <SortIcon col="days" />
              </button>
              <button
                onClick={() => toggleSort('priority')}
                className="flex items-center gap-1 hover:text-gray-800"
              >
                Priority <SortIcon col="priority" />
              </button>
              <span />
            </div>

            <div className="divide-y">
              {sorted.map(job => (
                <div
                  key={job.id}
                  className={`border-l-4 ${urgencyClass(job.days_overdue)} grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_120px_100px_100px_48px] gap-2 md:gap-0 px-4 py-3 items-center hover:bg-black/[0.02] transition-colors`}
                >
                  {/* Job number */}
                  <div>
                    <span className="font-mono text-xs font-bold text-gray-700">{job.job_number}</span>
                  </div>

                  {/* Project + Client */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{job.project_name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{job.client_name}</span>
                    </p>
                  </div>

                  {/* Designer */}
                  <div className="text-xs text-gray-600 flex items-center gap-1">
                    <User className="w-3 h-3 shrink-0 text-gray-400" />
                    <span className="truncate">{job.designer_name}</span>
                  </div>

                  {/* Stage */}
                  <div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                      {STAGE_LABELS[job.current_stage] || job.current_stage}
                    </span>
                  </div>

                  {/* Days overdue */}
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${urgencyBadge(job.days_overdue)}`}>
                      {job.days_overdue}d late
                    </span>
                  </div>

                  {/* Priority */}
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${PRIORITY_BADGE[job.priority] || PRIORITY_BADGE.normal}`}>
                      {(job.priority || 'normal').toUpperCase()}
                    </span>
                  </div>

                  {/* Go to job */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => router.push(`/admin/designers/tasks?highlight=${job.id}`)}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Open job"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            <Clock className="inline w-3 h-3 mr-1" />
            Based on client deadline. Delivered and cancelled jobs are excluded.
          </p>
        </>
      )}
    </div>
  );
}
