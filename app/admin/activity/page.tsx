'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, User, Calendar, FileText, Package, Users, CreditCard, Truck, Settings, Printer, Loader2 } from 'lucide-react';
import { useActivityLogs } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

const formatDateTime = (dateString: string): string => {
  const d = new Date(dateString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const modules = ['All', 'Sales', 'CRM', 'Finance', 'Dispatch', 'CMYK', 'Settings', 'System'];

export default function ActivityPage() {
  const { logs, loading } = useActivityLogs(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Fetch profiles separately — no FK join needed
  useEffect(() => {
    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((p: any) => { map[p.id] = p.full_name || 'User'; });
        setUserMap(map);
      }
    });
  }, []);

  const dynamicUsers = ['All', ...Object.values(userMap)];

  const filteredLogs = (logs || []).filter(log => {
    const userName = userMap[(log as any).user_id] || 'Unknown';
    const detailsText = typeof log.details === 'string'
      ? log.details
      : (log as any).description || log.details?.description || JSON.stringify(log.details || {});
    const matchesSearch = (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      detailsText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = moduleFilter === 'All' || log.module === moduleFilter;
    const matchesUser = userFilter === 'All' || userName === userFilter;
    const matchesDate = !dateFilter || new Date(log.created_at).toISOString().split('T')[0] === dateFilter;
    return matchesSearch && matchesModule && matchesUser && matchesDate;
  });

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      'Sales': 'bg-gray-100 text-gray-900',
      'CRM': 'bg-muted text-foreground',
      'Finance': 'bg-gray-900 text-white',
      'Dispatch': 'bg-amber-100 text-amber-700',
      'CMYK': 'bg-cyan-100 text-cyan-700',
      'Settings': 'bg-gray-100 text-gray-700',
      'System': 'bg-gray-200 text-gray-600',
    };
    return colors[module] || 'bg-gray-100 text-gray-700';
  };

  const getActionColor = (action: string) => {
    if (action === 'create') return 'text-green-700 bg-green-50 border-green-200';
    if (action === 'update') return 'text-blue-700 bg-blue-50 border-blue-200';
    if (action === 'delete') return 'text-red-700 bg-red-50 border-red-200';
    if (action === 'login' || action === 'logout') return 'text-gray-500 bg-gray-50 border-gray-200';
    if (action === 'upload') return 'text-purple-700 bg-purple-50 border-purple-200';
    if (action === 'approve') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    return 'text-gray-500 bg-gray-50 border-gray-200';
  };

  // Human-readable description
  const humanReadable = (log: any): string => {
    const rawDesc = typeof log.details === 'object' && log.details?.description
      ? log.details.description
      : log.description || '';
    if (rawDesc && rawDesc !== 'login system' && rawDesc !== `${log.action} ${log.entity_type || 'system'}` && rawDesc.length > 5) {
      return rawDesc;
    }
    const entityMap: Record<string, string> = {
      job: 'Job', invoice: 'Invoice', payment: 'Payment', client: 'Client',
      quotation: 'Quotation', user: 'User', order: 'Order', lead: 'Lead',
      delivery: 'Delivery', file: 'File',
    };
    const entity = entityMap[log.entity_type] || '';
    if (log.action === 'login') return 'User logged in';
    if (log.action === 'logout') return 'User logged out';
    if (log.action === 'create') return entity ? `${entity} added` : 'Record created';
    if (log.action === 'update') return entity ? `${entity} updated` : 'Record updated';
    if (log.action === 'delete') return entity ? `${entity} deleted` : 'Record deleted';
    if (log.action === 'upload') return 'File uploaded';
    if (log.action === 'approve') return `${entity || 'Item'} approved`;
    if (log.action === 'export') return 'Data exported';
    return rawDesc || log.action;
  };

  // Stats
  const totalLogs = (logs || []).length;
  const uniqueUsersCount = new Set((logs || []).map((l: any) => l.user_id)).size;
  const loginCount = (logs || []).filter(l => l.action === 'login' || l.action === 'logout').length;
  const dataChanges = (logs || []).filter(l => l.action === 'create' || l.action === 'update' || l.action === 'delete').length;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-gray-500 font-medium">Loading activity logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-page-title text-gray-900">Activity Logs</h1>
        <p className="text-sm text-gray-500">Last 100 entries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-white rounded-md p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Logged</p>
          <p className="text-2xl font-bold text-gray-900">{totalLogs}</p>
          <p className="text-xs text-gray-400 mt-0.5">All time entries</p>
        </div>
        <div className="bg-white rounded-md p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Active Users</p>
          <p className="text-2xl font-bold text-gray-900">{uniqueUsersCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Unique users</p>
        </div>
        <div className="bg-white rounded-md p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Logins</p>
          <p className="text-2xl font-bold text-gray-900">{loginCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Session events</p>
        </div>
        <div className="bg-white rounded-md p-3 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Data Changes</p>
          <p className="text-2xl font-bold text-gray-900">{dataChanges}</p>
          <p className="text-xs text-gray-400 mt-0.5">Add / edit / delete</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md p-3 border border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-sm"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-md bg-white text-sm"
          >
            {modules.map(m => (
              <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>
            ))}
          </select>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-md bg-white text-sm"
          >
            {dynamicUsers.map(u => (
              <option key={u} value={u}>{u === 'All' ? 'All Users' : u}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-md text-sm"
          />
          {(searchQuery || moduleFilter !== 'All' || userFilter !== 'All' || dateFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setModuleFilter('All'); setUserFilter('All'); setDateFilter(''); }}
              className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-md"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Recent Activity</h2>
          <span className="text-xs text-gray-400">{filteredLogs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-semibold w-32">User</th>
                <th className="text-left px-4 py-2 font-semibold">Activity</th>
                <th className="text-left px-4 py-2 font-semibold w-24">Module</th>
                <th className="text-left px-4 py-2 font-semibold w-20">Type</th>
                <th className="text-left px-4 py-2 font-semibold w-36">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-2 text-xs text-gray-600 font-medium">
                    {userMap[(log as any).user_id] || 'System'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {humanReadable(log)}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 text-xs rounded-md ${getModuleColor(log.module || 'System')}`}>
                      {log.module || 'System'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    {(logs || []).length === 0
                      ? 'No activity logged yet. Activity appears here as users interact with the system.'
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
