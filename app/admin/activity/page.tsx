'use client';

import { useState } from 'react';
import { Search, Loader2, Bell, Activity, FileUp, CheckSquare, ArrowRight, Package, MessageSquare, DollarSign } from 'lucide-react';
import { useActivityLogs } from '@/lib/hooks';
import { createBrowserClient } from '@supabase/ssr';
import useSWR from 'swr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const formatDateTime = (dateString: string): string => {
  const d = new Date(dateString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const modules = ['All', 'Sales', 'CRM', 'Finance', 'Dispatch', 'Design', 'Print Planner', 'Settings', 'System', 'Notification'];
const actions = ['All', 'create', 'update', 'delete', 'login', 'logout', 'upload', 'stage_change', 'checklist', 'qc', 'payment', 'notification'];

const actionColor = (a: string) => {
  if (['create', 'CREATE'].includes(a)) return 'text-green-700 bg-green-50 border-green-200';
  if (['update', 'UPDATE', 'stage_change'].includes(a)) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (['delete', 'DELETE'].includes(a)) return 'text-red-700 bg-red-50 border-red-200';
  if (['login', 'logout', 'LOGIN', 'LOGOUT'].includes(a)) return 'text-gray-400 bg-gray-50 border-gray-200';
  if (a === 'upload') return 'text-violet-700 bg-violet-50 border-violet-200';
  if (a === 'checklist') return 'text-teal-700 bg-teal-50 border-teal-200';
  if (a === 'qc') return 'text-orange-700 bg-orange-50 border-orange-200';
  if (a === 'payment') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (a === 'notification') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-gray-500 bg-gray-50 border-gray-200';
};

const moduleColor = (m: string) => {
  const map: Record<string, string> = {
    'CRM': 'bg-blue-50 text-blue-700',
    'Finance': 'bg-amber-50 text-amber-700',
    'Sales': 'bg-gray-100 text-gray-700',
    'Design': 'bg-violet-50 text-violet-700',
    'Print Planner': 'bg-cyan-50 text-cyan-700',
    'Dispatch': 'bg-orange-50 text-orange-700',
    'Settings': 'bg-gray-100 text-gray-600',
    'System': 'bg-gray-100 text-gray-500',
    'Notification': 'bg-amber-50 text-amber-600',
  };
  return map[m] || 'bg-gray-100 text-gray-600';
};

const actionIcon = (a: string) => {
  if (a === 'upload') return <FileUp size={13} />;
  if (a === 'stage_change') return <ArrowRight size={13} />;
  if (a === 'checklist') return <CheckSquare size={13} />;
  if (a === 'qc') return <Package size={13} />;
  if (a === 'payment') return <DollarSign size={13} />;
  if (a === 'notification') return <Bell size={13} />;
  if (['login', 'logout'].includes(a)) return <Activity size={13} />;
  if (a === 'create') return <span className="text-xs font-bold">+</span>;
  if (['update', 'stage_change'].includes(a)) return <ArrowRight size={13} />;
  if (a === 'delete') return <span className="text-xs font-bold">×</span>;
  return <MessageSquare size={13} />;
};

// Fetch broadcast_notifications and merge as "virtual" activity entries
function useNotificationsAsActivity(limit = 100) {
  return useSWR('broadcast-notifs-activity', async () => {
    const { data } = await supabase
      .from('broadcast_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map((n: any) => ({
      id: `notif-${n.id}`,
      user_name: n.sender_name || 'System',
      description: n.message,
      module: 'Notification',
      action: 'notification',
      created_at: n.created_at,
      entity_type: null,
      _source: 'notification',
      _priority: n.priority || 'normal',
    }));
  }, { revalidateOnFocus: false });
}

export default function ActivityPage() {
  const { logs, loading } = useActivityLogs(200);
  const { data: notifLogs = [], isLoading: notifLoading } = useNotificationsAsActivity(100);

  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showLogins, setShowLogins] = useState(false);

  // Merge and sort activity logs + notifications
  const activityLogs = (logs || []).map((l: any) => ({ ...l, _source: 'activity' }));
  const merged = [...activityLogs, ...notifLogs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Stats (from activity only)
  const totalLogs = merged.length;
  const uniqueUsers = new Set(merged.map((l: any) => l.user_name || l.user_id)).size;
  const loginCount = activityLogs.filter((l: any) => ['login', 'LOGIN', 'logout', 'LOGOUT'].includes(l.action)).length;
  const dataChanges = activityLogs.filter((l: any) =>
    !['login', 'LOGIN', 'logout', 'LOGOUT'].includes(l.action)
  ).length;

  const uniqueUserNames = ['', ...Array.from(new Set(merged.map((l: any) => l.user_name).filter(Boolean)))];

  const filtered = merged.filter((log: any) => {
    // Optionally hide logins
    if (!showLogins && ['login', 'LOGIN', 'logout', 'LOGOUT'].includes(log.action)) return false;

    const desc = (log.description || '').toLowerCase();
    const matchSearch = !search || desc.includes(search.toLowerCase()) ||
      (log.user_name || '').toLowerCase().includes(search.toLowerCase());
    const matchModule = moduleFilter === 'All' || log.module === moduleFilter;
    const matchAction = actionFilter === 'All' || log.action === actionFilter || log.action === actionFilter.toLowerCase();
    const matchUser = !userFilter || log.user_name === userFilter;
    const matchDate = !dateFilter || new Date(log.created_at).toISOString().split('T')[0] === dateFilter;
    return matchSearch && matchModule && matchAction && matchUser && matchDate;
  });

  if (loading && notifLoading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" size={28} />
        <span className="text-gray-500">Loading activity...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Activity Logs</h1>
        <p className="text-sm text-gray-500">Full audit trail — activity logs + notifications, newest first</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Total Events', value: totalLogs, sub: 'Logs + notifications' },
          { label: 'Active Users', value: uniqueUsers, sub: 'Unique users' },
          { label: 'Logins', value: loginCount, sub: 'Session events' },
          { label: 'Data Changes', value: dataChanges, sub: 'Create / Update / Stage / Upload' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-md p-3 border border-gray-100">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md p-2.5 border border-gray-100 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[150px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search description, user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-sm"
          />
        </div>
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white">
          {modules.map(m => <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>)}
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white">
          {actions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>)}
        </select>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white">
          {(uniqueUserNames as string[]).map(u => <option key={u} value={u}>{u || 'All Users'}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-sm" />
        {/* Show/hide logins toggle */}
        <button
          onClick={() => setShowLogins(v => !v)}
          className={`px-2 py-1.5 text-xs border rounded-md transition-colors ${showLogins ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-400 border-gray-200 hover:text-gray-700'}`}
        >
          {showLogins ? '✓ Logins' : 'Show Logins'}
        </button>
        {(search || moduleFilter !== 'All' || actionFilter !== 'All' || userFilter || dateFilter) && (
          <button onClick={() => { setSearch(''); setModuleFilter('All'); setActionFilter('All'); setUserFilter(''); setDateFilter(''); }}
            className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-md">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">Recent Activity</span>
          <span className="text-xs text-gray-400">{filtered.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium w-28">User</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-left px-4 py-2 font-medium w-28">Module</th>
                <th className="text-left px-4 py-2 font-medium w-28">Action</th>
                <th className="text-left px-4 py-2 font-medium w-36">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((log: any) => (
                <tr key={log.id} className={`hover:bg-gray-50/70 transition-colors ${log._source === 'notification' ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-700">
                    {log._source === 'notification' && (
                      <Bell size={10} className="inline mr-1 text-amber-500" />
                    )}
                    {log.user_name || 'System'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-900 max-w-md">
                    <span className="line-clamp-2">{log.description || log.action}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 text-xs rounded-md ${moduleColor(log.module || 'System')}`}>
                      {log.module || 'System'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border inline-flex items-center gap-1 ${actionColor(log.action)}`}>
                      {actionIcon(log.action)}
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                    {merged.length === 0
                      ? 'No activity logged yet.'
                      : 'No entries match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
