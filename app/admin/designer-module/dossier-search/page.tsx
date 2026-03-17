'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Search, Clock, ChevronRight, Loader2, Filter, ShieldOff } from 'lucide-react';

const DOSSIER_ICON: Record<string, string> = {
  TASK_CREATED: '🆕', LIVE_STARTED: '▶️', HOLD_APPLIED: '⏳',
  REVIEW_STARTED: '👁️', REWORK_CREATED: '🔄', TASK_ENDED: '✅',
  TASK_TRANSFERRED: '🔀', STATUS_CHANGED: '🔁',
};

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  live:    'bg-green-100 text-green-700',
  hold:    'bg-orange-100 text-orange-700',
  review:  'bg-blue-100 text-blue-700',
  rework:  'bg-red-100 text-red-700',
  end:     'bg-emerald-100 text-emerald-700',
};

export default function DossierSearchPage() {
  const { profile, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/design-tasks');
      const json = await res.json();
      setTasks(json.data || []);
      setFiltered(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentDossier = useCallback(async () => {
    try {
      // Fetch recent dossier entries across all tasks by getting the last 10
      // We do this via design-tasks and then aggregate
      // For now, use individual task dossier data from the tasks list
    } catch (e) { }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter
  useEffect(() => {
    let result = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.task_code?.toLowerCase().includes(q) ||
        t.client?.company?.toLowerCase().includes(q) ||
        t.client?.name?.toLowerCase().includes(q) ||
        t.assigned_user?.full_name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    if (dateFrom) result = result.filter(t => t.created_at >= dateFrom);
    if (dateTo) result = result.filter(t => t.created_at <= dateTo + 'T23:59:59');
    setFiltered(result);
  }, [search, tasks, dateFrom, dateTo]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <ShieldOff size={32} className="text-red-400" />
        <p className="text-gray-600">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dossier Search</h1>
        <p className="text-sm text-gray-500 mt-0.5">Search task audit trails by code, client, or designer</p>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Task Code, Client, Designer..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''} found
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Search size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No tasks match your search</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(task => (
                <Link
                  key={task.id}
                  href={`/admin/designer-module/tasks/${task.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-gray-400">{task.task_code}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[task.current_status]}`}>
                        {task.current_status}
                      </span>
                      {task.rework_count > 0 && (
                        <span className="text-xs text-red-500">Rework #{task.rework_count}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 truncate">{task.description}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      {task.client && <span>{task.client.company || task.client.name}</span>}
                      {task.assigned_user && <span>👤 {task.assigned_user.full_name}</span>}
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(task.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
