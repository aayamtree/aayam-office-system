'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useActivityLogs } from '@/lib/hooks';

const formatDateTime = (dateString: string): string => {
  const d = new Date(dateString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const modules = ['All', 'Sales', 'CRM', 'Finance', 'Dispatch', 'Print Planner', 'Settings', 'System'];
const actions = ['All', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE'];

const actionColor = (a: string) => {
  if (a === 'CREATE') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'UPDATE') return 'text-blue-700 bg-blue-50 border-blue-200';
  if (a === 'DELETE') return 'text-red-700 bg-red-50 border-red-200';
  if (a === 'LOGIN' || a === 'LOGOUT') return 'text-gray-500 bg-gray-50 border-gray-200';
  if (a === 'STATUS_CHANGE') return 'text-purple-700 bg-purple-50 border-purple-200';
  // legacy lowercase actions
  if (a === 'create') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'update') return 'text-blue-700 bg-blue-50 border-blue-200';
  if (a === 'delete') return 'text-red-700 bg-red-50 border-red-200';
  if (a === 'login' || a === 'logout') return 'text-gray-500 bg-gray-50 border-gray-200';
  return 'text-gray-500 bg-gray-50 border-gray-200';
};

const moduleColor = (m: string) => {
  const map: Record<string, string> = {
    'CRM': 'bg-blue-50 text-blue-700',
    'Finance': 'bg-amber-50 text-amber-700',
    'Sales': 'bg-gray-100 text-gray-700',
    'Print Planner': 'bg-cyan-50 text-cyan-700',
    'Dispatch': 'bg-orange-50 text-orange-700',
    'Settings': 'bg-gray-100 text-gray-600',
    'System': 'bg-gray-100 text-gray-500',
  };
  return map[m] || 'bg-gray-100 text-gray-600';
};

const humanDescription = (log: any): string => {
  // New logs have description directly
  if (log.description && log.description !== `${log.action} system` && log.description.length > 5) {
    return log.description;
  }
  // Legacy fallback
  if (log.action === 'login' || log.action === 'LOGIN') return 'User logged in';
  if (log.action === 'logout' || log.action === 'LOGOUT') return 'User logged out';
  if (log.action === 'create' || log.action === 'CREATE') return log.entity_name ? `${log.entity_name} created` : 'Record created';
  if (log.action === 'update' || log.action === 'UPDATE') return log.entity_name ? `${log.entity_name} updated` : 'Record updated';
  if (log.action === 'delete' || log.action === 'DELETE') return log.entity_name ? `${log.entity_name} deleted` : 'Record deleted';
  return log.description || log.action;
};

export default function ActivityPage() {
  const { logs, loading } = useActivityLogs(200);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const allLogs = logs || [];

  // Stats
  const totalLogs = allLogs.length;
  const uniqueUsers = new Set(allLogs.map((l: any) => l.user_name || l.user_id)).size;
  const loginCount = allLogs.filter(l => l.action === 'login' || l.action === 'LOGIN').length;
  const dataChanges = allLogs.filter(l =>
    ['create', 'CREATE', 'update', 'UPDATE', 'delete', 'DELETE', 'STATUS_CHANGE'].includes(l.action)
  ).length;

  // Unique user names for filter dropdown
  const uniqueUserNames = ['', ...Array.from(new Set(
    allLogs.map((l: any) => l.user_name).filter(Boolean)
  ))];

  const filtered = allLogs.filter((log: any) => {
    const desc = humanDescription(log).toLowerCase();
    const matchSearch = !search || desc.includes(search.toLowerCase()) ||
      (log.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.entity_name || '').toLowerCase().includes(search.toLowerCase());
    const matchModule = moduleFilter === 'All' || log.module === moduleFilter;
    const matchAction = actionFilter === 'All' || log.action === actionFilter || log.action === actionFilter.toLowerCase();
    const matchUser = !userFilter || log.user_name === userFilter;
    const matchDate = !dateFilter || new Date(log.created_at).toISOString().split('T')[0] === dateFilter;
    return matchSearch && matchModule && matchAction && matchUser && matchDate;
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" size={28} />
        <span className="text-gray-500">Loading activity logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Activity Logs</h1>
        <p className="text-sm text-gray-500">Full audit trail — last 200 entries, newest first</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Total Logged', value: totalLogs, sub: 'All time' },
          { label: 'Active Users', value: uniqueUsers, sub: 'Unique users' },
          { label: 'Logins', value: loginCount, sub: 'Session events' },
          { label: 'Data Changes', value: dataChanges, sub: 'Create / Update / Delete' },
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
            placeholder="Search description, user, entity..."
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
          {uniqueUserNames.map(u => <option key={u} value={u}>{u || 'All Users'}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-sm" />
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
                <th className="text-left px-4 py-2 font-medium w-32">User</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-left px-4 py-2 font-medium w-28">Module</th>
                <th className="text-left px-4 py-2 font-medium w-24">Action</th>
                <th className="text-left px-4 py-2 font-medium w-36">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-2 text-xs font-medium text-gray-700">
                    {log.user_name || 'System'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {humanDescription(log)}
                    {log.entity_name && log.description && !log.description.includes(log.entity_name) && (
                      <span className="ml-1 text-xs text-gray-400">({log.entity_name})</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 text-xs rounded-md ${moduleColor(log.module || 'System')}`}>
                      {log.module || 'System'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                    {allLogs.length === 0
                      ? 'No activity logged yet. Logs appear here as users interact with the system.'
                      : 'No entries match your filters. Try clearing filters.'}
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
