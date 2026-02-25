'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, User, Calendar, Clock, FileText, Package, Users, CreditCard, Truck, Settings, Printer, Loader2 } from 'lucide-react';
import { useActivityLogs } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

const modules = ['All', 'Sales', 'CRM', 'Finance', 'Dispatch', 'CMYK', 'Settings', 'System'];
// const users = ['All', 'Admin User', 'Rahul Patel', 'Priya Shah', 'Amit Kumar']; // Removed hardcoded users

export default function ActivityPage() {
  const { logs, loading } = useActivityLogs(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Fetch profiles separately — avoids needing FK join between activity_logs and profiles
  useEffect(() => {
    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((p: any) => { map[p.id] = p.full_name || 'User'; });
        setUserMap(map);
      }
    });
  }, []);

  // Extract unique users dynamically from userMap (not from log.user which requires FK)
  const dynamicUsers = ['All', ...Object.values(userMap)];

  const filteredLogs = (logs || []).filter(log => {
    const userName = userMap[(log as any).user_id] || 'Unknown';
    // Support both 'details' (new) and 'description' (legacy) columns
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

  const getModuleIcon = (module: string | undefined) => {
    // Safety check for undefined module
    if (!module) return <FileText size={16} className="text-gray-600" />;

    const icons: Record<string, React.ReactNode> = {
      'Sales': <Package size={16} className="text-gray-900" />,
      'CRM': <Users size={16} className="text-foreground" />,
      'Finance': <CreditCard size={16} className="text-primary" />,
      'Dispatch': <Truck size={16} className="text-destructive" />,
      'CMYK': <Printer size={16} className="text-cyan-600" />,
      'Settings': <Settings size={16} className="text-gray-600" />,
      'System': <FileText size={16} className="text-primary" />,
    };
    return icons[module] || <FileText size={16} className="text-gray-600" />;
  };

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      'Sales': 'bg-gray-100 text-gray-900',
      'CRM': 'bg-muted text-foreground',
      'Finance': 'bg-gray-900 text-white',
      'Dispatch': 'bg-amber-100 text-amber-700',
      'CMYK': 'bg-cyan-100 text-cyan-700',
      'Settings': 'bg-gray-100 text-gray-700',
      'System': 'bg-gray-900 text-white',
    };
    return colors[module] || 'bg-gray-100 text-gray-700';
  };

  const getActionColor = (action: string) => {
    if (action === 'create') return 'text-green-700 bg-green-50 border-green-200';
    if (action === 'update') return 'text-blue-700 bg-blue-50 border-blue-200';
    if (action === 'delete') return 'text-red-700 bg-red-50 border-red-200';
    if (action === 'login' || action === 'logout') return 'text-gray-600 bg-gray-100 border-gray-200';
    if (action === 'upload') return 'text-purple-700 bg-purple-50 border-purple-200';
    if (action === 'approve') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    return 'text-gray-600 bg-gray-100 border-gray-200';
  };

  // Stats calculation from actual logs
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = (logs || []).filter(l => new Date(l.created_at).toISOString().startsWith(todayStr)).length;
  const uniqueUsersCount = new Set((logs || []).map((l: any) => l.user_id)).size;
  const salesActions = (logs || []).filter(l => l.module === 'Sales').length;
  const financeActions = (logs || []).filter(l => l.module === 'Finance').length;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-gray-500 font-medium">Loading activity logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-page-title text-gray-900">Activity Logs</h1>
        <p className="text-sm text-gray-500">Track all system activities (Last 100 entries)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-primary" />
            <span className="text-sm text-gray-500">Today&apos;s Activity</span>
          </div>
          <p className="text-page-title text-gray-900">{todayLogs}</p>
        </div>
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <User size={18} className="text-foreground" />
            <span className="text-sm text-gray-500">Active Users</span>
          </div>
          <p className="text-page-title text-gray-900">{uniqueUsersCount}</p>
        </div>
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Package size={18} className="text-gray-900" />
            <span className="text-sm text-gray-500">Sales Actions</span>
          </div>
          <p className="text-page-title text-gray-900">{salesActions}</p>
        </div>
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={18} className="text-primary" />
            <span className="text-sm text-gray-500">Finance Actions</span>
          </div>
          <p className="text-page-title text-gray-900">{financeActions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <span className="font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
          >
            {modules.map(m => (
              <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>
            ))}
          </select>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
          >
            {dynamicUsers.map(u => (
              <option key={u} value={u}>{u === 'All' ? 'All Users' : u}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          <span className="text-sm text-gray-500">{filteredLogs.length} entries</span>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-2 md:gap-4">
                {/* Icon */}
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {getModuleIcon(log.module)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Description as primary title */}
                  <p className="font-medium text-gray-900 text-sm leading-snug">
                    {typeof log.details === 'object' && log.details?.description
                      ? log.details.description
                      : (log as any).description
                      || `${log.action} ${(log as any).entity_type || log.module || ''}`
                    }
                  </p>
                  {/* Action badge + module badge */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs rounded-md ${getModuleColor(log.module || 'System')}`}>
                      {log.module || 'System'}
                    </span>
                  </div>
                  {/* Meta: user + time */}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <User size={11} />
                      {userMap[(log as any).user_id] || 'System User'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {(logs || []).length === 0
                ? 'No activity has been logged yet. Activity will appear here as users interact with the system.'
                : 'No activity logs match your current filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
