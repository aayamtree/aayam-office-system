'use client';

import { useState } from 'react';
import { Search, Filter, User, Calendar, Clock, FileText, Package, Users, CreditCard, Truck, Settings, Printer } from 'lucide-react';

interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
}

const demoLogs: ActivityLog[] = [
  { id: '1', timestamp: '2024-12-25 14:32:15', user: 'Admin User', action: 'Created Order', module: 'Sales', details: 'Order AAY-2024-156 created for ABC Industries', ipAddress: '192.168.1.10' },
  { id: '2', timestamp: '2024-12-25 14:28:45', user: 'Rahul Patel', action: 'Updated Client', module: 'CRM', details: 'Updated contact info for Tech Solutions', ipAddress: '192.168.1.15' },
  { id: '3', timestamp: '2024-12-25 14:15:30', user: 'Admin User', action: 'Payment Received', module: 'Finance', details: 'Payment of ₹15,000 received from XYZ Corp', ipAddress: '192.168.1.10' },
  { id: '4', timestamp: '2024-12-25 13:45:22', user: 'Priya Shah', action: 'Job Completed', module: 'CMYK', details: 'JOB-155 marked as ready', ipAddress: '192.168.1.20' },
  { id: '5', timestamp: '2024-12-25 13:30:10', user: 'Admin User', action: 'Dispatched Order', module: 'Dispatch', details: 'Order AAY-2024-154 dispatched via Om Logistics', ipAddress: '192.168.1.10' },
  { id: '6', timestamp: '2024-12-25 12:55:33', user: 'Amit Kumar', action: 'Invoice Generated', module: 'Finance', details: 'Invoice INV-2024-156 generated', ipAddress: '192.168.1.25' },
  { id: '7', timestamp: '2024-12-25 12:20:45', user: 'Rahul Patel', action: 'Lead Converted', module: 'Sales', details: 'Lead LID-089 converted to order', ipAddress: '192.168.1.15' },
  { id: '8', timestamp: '2024-12-25 11:45:18', user: 'Admin User', action: 'User Created', module: 'Settings', details: 'New user Neha Sharma added', ipAddress: '192.168.1.10' },
  { id: '9', timestamp: '2024-12-25 11:30:00', user: 'Priya Shah', action: 'Stock Updated', module: 'CMYK', details: 'A4 Paper stock updated: +50 reams', ipAddress: '192.168.1.20' },
  { id: '10', timestamp: '2024-12-25 11:15:22', user: 'Admin User', action: 'QC Passed', module: 'Dispatch', details: 'Order AAY-2024-153 passed QC check', ipAddress: '192.168.1.10' },
  { id: '11', timestamp: '2024-12-25 10:45:30', user: 'Rahul Patel', action: 'Quotation Sent', module: 'Sales', details: 'Quotation QUO-2024-089 sent to Prime Motors', ipAddress: '192.168.1.15' },
  { id: '12', timestamp: '2024-12-25 10:30:15', user: 'Admin User', action: 'Login', module: 'System', details: 'Admin logged in', ipAddress: '192.168.1.10' },
  { id: '13', timestamp: '2024-12-24 18:30:00', user: 'Priya Shah', action: 'Logout', module: 'System', details: 'User logged out', ipAddress: '192.168.1.20' },
  { id: '14', timestamp: '2024-12-24 17:45:22', user: 'Admin User', action: 'Vendor Added', module: 'CRM', details: 'New vendor Paper World added', ipAddress: '192.168.1.10' },
  { id: '15', timestamp: '2024-12-24 16:30:10', user: 'Amit Kumar', action: 'Expense Added', module: 'Finance', details: 'Expense of ₹25,000 for paper purchase', ipAddress: '192.168.1.25' },
];

const modules = ['All', 'Sales', 'CRM', 'Finance', 'Dispatch', 'CMYK', 'Settings', 'System'];
const users = ['All', 'Admin User', 'Rahul Patel', 'Priya Shah', 'Amit Kumar'];

export default function ActivityPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  const filteredLogs = demoLogs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = moduleFilter === 'All' || log.module === moduleFilter;
    const matchesUser = userFilter === 'All' || log.user === userFilter;
    const matchesDate = !dateFilter || log.timestamp.startsWith(dateFilter);
    return matchesSearch && matchesModule && matchesUser && matchesDate;
  });

  const getModuleIcon = (module: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Sales': <Package size={16} className="text-green-600" />,
      'CRM': <Users size={16} className="text-blue-600" />,
      'Finance': <CreditCard size={16} className="text-purple-600" />,
      'Dispatch': <Truck size={16} className="text-amber-600" />,
      'CMYK': <Printer size={16} className="text-cyan-600" />,
      'Settings': <Settings size={16} className="text-gray-600" />,
      'System': <FileText size={16} className="text-indigo-600" />,
    };
    return icons[module] || <FileText size={16} className="text-gray-600" />;
  };

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      'Sales': 'bg-green-100 text-green-700',
      'CRM': 'bg-blue-100 text-blue-700',
      'Finance': 'bg-purple-100 text-purple-700',
      'Dispatch': 'bg-amber-100 text-amber-700',
      'CMYK': 'bg-cyan-100 text-cyan-700',
      'Settings': 'bg-gray-100 text-gray-700',
      'System': 'bg-indigo-100 text-indigo-700',
    };
    return colors[module] || 'bg-gray-100 text-gray-700';
  };

  const getActionColor = (action: string) => {
    if (action.includes('Created') || action.includes('Added')) return 'text-green-600';
    if (action.includes('Updated') || action.includes('Completed')) return 'text-blue-600';
    if (action.includes('Deleted') || action.includes('Cancelled')) return 'text-red-600';
    if (action.includes('Login') || action.includes('Logout')) return 'text-indigo-600';
    return 'text-gray-700';
  };

  // Stats
  const todayLogs = demoLogs.filter(l => l.timestamp.startsWith('2024-12-25')).length;
  const uniqueUsers = Array.from(new Set(demoLogs.map(l => l.user))).length;
  const salesActions = demoLogs.filter(l => l.module === 'Sales').length;
  const financeActions = demoLogs.filter(l => l.module === 'Finance').length;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Activity Logs</h1>
        <p className="text-sm text-gray-500">Track all system activities</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-indigo-600" />
            <span className="text-sm text-gray-500">Today&apos;s Activity</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{todayLogs}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <User size={18} className="text-blue-600" />
            <span className="text-sm text-gray-500">Active Users</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{uniqueUsers}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Package size={18} className="text-green-600" />
            <span className="text-sm text-gray-500">Sales Actions</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{salesActions}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={18} className="text-purple-600" />
            <span className="text-sm text-gray-500">Finance Actions</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{financeActions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl"
          >
            {modules.map(m => (
              <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>
            ))}
          </select>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl"
          >
            {users.map(u => (
              <option key={u} value={u}>{u === 'All' ? 'All Users' : u}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          <span className="text-sm text-gray-500">{filteredLogs.length} entries</span>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {getModuleIcon(log.module)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${getActionColor(log.action)}`}>{log.action}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getModuleColor(log.module)}`}>
                      {log.module}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {log.user}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {log.timestamp}
                    </span>
                    <span className="hidden sm:block">{log.ipAddress}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
