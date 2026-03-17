'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, FolderOpen, FileText, RefreshCw, ChevronRight, ExternalLink } from 'lucide-react';

interface TaskRow {
  id: string;
  task_code: string;
  client_name: string;
  designer_name: string;
  current_status: string;
  dossier_count: number;
  brand_name: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  created:  'bg-gray-100 text-gray-600',
  live:     'bg-green-100 text-green-700',
  hold:     'bg-orange-100 text-orange-700',
  review:   'bg-blue-100 text-blue-700',
  rework:   'bg-red-100 text-red-700',
  end:      'bg-emerald-100 text-emerald-700',
};

export default function DossierListPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/designer-module/dossier-list');
      if (res.ok) {
        const json = await res.json();
        setTasks(json.data || []);
      }
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filtered = search
    ? tasks.filter(t =>
        t.task_code?.toLowerCase().includes(search.toLowerCase()) ||
        t.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.designer_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.current_status?.toLowerCase().includes(search.toLowerCase())
      )
    : tasks;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText size={20} /> Task Dossier
          </h1>
          <p className="text-sm text-muted-foreground">All tasks with audit trail. Click any row for full timeline.</p>
        </div>
        <button onClick={fetchTasks} className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by task, client, designer..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {['Task #', 'Client', 'Designer', 'Brand', 'Status', 'Dossier Entries', ''].map(h => (
                <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Loading...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">
                <FolderOpen size={24} className="mx-auto mb-2 opacity-40" />No tasks found
              </td></tr>
            ) : filtered.map((t, i) => (
              <tr key={t.id} className={`${i % 2 === 0 ? '' : 'bg-muted/20'} border-b last:border-0 hover:bg-accent/30 cursor-pointer`}>
                <td className="py-3 px-4">
                  <span className="font-mono text-xs font-semibold text-primary">{t.task_code}</span>
                </td>
                <td className="py-3 px-4 font-medium text-foreground truncate max-w-[120px]">{t.client_name || '—'}</td>
                <td className="py-3 px-4 text-muted-foreground">{t.designer_name || '—'}</td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{t.brand_name || '—'}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[t.current_status] || 'bg-gray-100 text-gray-600'}`}>
                    {t.current_status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full">
                    {t.dossier_count} {t.dossier_count === 1 ? 'entry' : 'entries'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/designer-module/tasks/${t.id}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (
          <div className="bg-muted/30 border-t px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} of {tasks.length} tasks · <Link href="/admin/designer-module/dossier-search" className="text-primary hover:underline">Advanced Dossier Search →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
