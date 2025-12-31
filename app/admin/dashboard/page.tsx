'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import {
  TrendingUp,
  Package,
  Printer,
  Truck,
  ArrowUpRight,
  Plus,
  AlertCircle
} from 'lucide-react';
import { useDashboardStats, useJobs } from '@/lib/hooks';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { stats: dashboardStats, loading: statsLoading } = useDashboardStats();
  const { jobs: recentJobs, loading: jobsLoading } = useJobs({
    limit: 5,
    orderBy: { column: 'created_at', ascending: false }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Stat Cards Data
  const stats = [
    { label: 'Total Revenue', value: formatCurrency(dashboardStats.totalRevenue), subtext: 'Lifetime Invoice Total', positive: true, icon: TrendingUp },
    { label: 'Active Jobs', value: dashboardStats.activeJobs.toString(), change: '', positive: true, icon: Package },
    { label: 'Pending Payments', value: formatCurrency(dashboardStats.pendingPayments), subtext: 'Outstanding', icon: Printer },
    { label: 'Leads This Month', value: dashboardStats.leadsThisMonth.toString(), subtext: 'New Opportunities', urgent: false, icon: Truck },
  ];

  // Pipeline Data - Dynamic
  // Stages: new, designing, approval, printing, finishing, quality_check, ready, dispatched, delivered
  const pipeline = [
    { label: 'In Design', count: (dashboardStats.pipeline?.designing || 0) + (dashboardStats.pipeline?.approval || 0), color: 'bg-indigo-500' },
    { label: 'Production', count: (dashboardStats.pipeline?.printing || 0) + (dashboardStats.pipeline?.finishing || 0), color: 'bg-amber-500' },
    { label: 'QC Check', count: dashboardStats.pipeline?.quality_check || 0, color: 'bg-purple-500' },
    { label: 'Ready/Packed', count: (dashboardStats.pipeline?.ready || 0) + (dashboardStats.pipeline?.packed || 0), color: 'bg-green-500' },
    { label: 'Dispatched', count: (dashboardStats.pipeline?.dispatched || 0) + (dashboardStats.pipeline?.in_transit || 0), color: 'bg-blue-500' },
  ];

  // Alerts - Dynamic
  const alerts = [
    { label: 'Overdue Payments', count: dashboardStats.alerts?.overduePayments || 0, color: 'bg-red-50 text-red-700', iconBg: 'bg-red-100', icon: '₹' },
    { label: 'Follow-ups Due', count: dashboardStats.alerts?.followUpsDue || 0, color: 'bg-amber-50 text-amber-700', iconBg: 'bg-amber-100', icon: '!' },
    { label: 'Low Stock Items', count: dashboardStats.alerts?.lowStock || 0, color: 'bg-orange-50 text-orange-700', iconBg: 'bg-orange-100', icon: '⚠' },
  ];

  const getStatusColor = (stage: string) => {
    const map: any = {
      'new': 'bg-blue-100 text-blue-700',
      'designing': 'bg-indigo-100 text-indigo-700',
      'approval': 'bg-purple-100 text-purple-700',
      'printing': 'bg-amber-100 text-amber-700',
      'finishing': 'bg-orange-100 text-orange-700',
      'quality_check': 'bg-pink-100 text-pink-700',
      'ready': 'bg-green-100 text-green-700',
      'dispatched': 'bg-cyan-100 text-cyan-700',
      'delivered': 'bg-gray-100 text-gray-700'
    };
    return map[stage] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#4338ca] rounded-2xl p-6 lg:p-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}
            </h1>
            <p className="text-indigo-200 text-sm mt-1">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 w-fit">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse-soft"></span>
            <span className="text-sm font-medium">Live Dashboard</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-indigo-200 text-xs font-medium">{stat.label}</p>
                  <Icon size={16} className="text-indigo-300" />
                </div>
                <p className="text-2xl lg:text-3xl font-bold tracking-tight">
                  {statsLoading ? '...' : stat.value}
                </p>
                {stat.subtext && (
                  <span className={`text-xs ${stat.urgent === false ? 'text-indigo-300' : 'text-indigo-300'}`}>
                    {stat.subtext}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions - Mobile */}
      <div className="lg:hidden grid grid-cols-4 gap-2">
        <Link href="/admin/sales/orders" className="flex flex-col items-center justify-center p-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors">
          <Plus size={20} />
          <span className="text-xs mt-1.5 font-medium">Order</span>
        </Link>
        <Link href="/admin/cmyk-print" className="flex flex-col items-center justify-center p-4 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors">
          <Printer size={20} />
          <span className="text-xs mt-1.5 font-medium">Print</span>
        </Link>
        <Link href="/admin/dispatch" className="flex flex-col items-center justify-center p-4 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors">
          <Truck size={20} />
          <span className="text-xs mt-1.5 font-medium">Dispatch</span>
        </Link>
        <Link href="/admin/crm/clients" className="flex flex-col items-center justify-center p-4 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors">
          <Package size={20} />
          <span className="text-xs mt-1.5 font-medium">Clients</span>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">

          {/* Sales Performance */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sales Performance</h2>
                <p className="text-sm text-gray-500">Monthly revenue</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg font-medium">Monthly</button>
                <button className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg">Yearly</button>
              </div>
            </div>

            {/* Chart (Dynamic) */}
            <div className="flex items-end justify-between gap-2 h-40 mb-6">
              {dashboardStats.salesPerformance?.map((item) => (
                <div key={item.month} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full h-full flex items-end">
                    {item.active && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap font-medium transform transition-all z-10 hidden group-hover:block">
                        {formatCurrency(item.value)}
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t-xl transition-all duration-300 ${item.active
                        ? 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                        : 'bg-gray-100 group-hover:bg-gray-200'
                        }`}
                      style={{
                        // Normalize for display, assuming max value could be around 1.5x average or just simple relative height 
                        // A simple hack: max height 100%, value relative to max or just a fixed scale factor if we knew range.
                        // Let's rely on relative height to previous items implicitly or just set minimal 5%
                        height: `${Math.max(5, Math.min(100, (item.value / ((dashboardStats.totalRevenue || 1) / 6)) * 60))}%`
                      }}
                      title={formatCurrency(item.value)}
                    />
                  </div>
                  <span className={`text-xs mt-3 font-medium ${item.active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {item.month}
                  </span>
                </div>
              ))}
              {(!dashboardStats.salesPerformance || dashboardStats.salesPerformance.length === 0) && (
                <div className="w-full flex items-center justify-center text-gray-400 text-sm">No sales data</div>
              )}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{formatCurrency(dashboardStats.totalRevenue)}</span>
                <span className="text-sm text-gray-500 font-medium">YTD Revenue</span>
              </div>
              <Link href="/admin/sales/orders" className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View Details
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* Recent Jobs (Real Data) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
              <Link href="/admin/sales/orders" className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View All
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {recentJobs.length === 0 ? <p className="text-gray-500 text-center py-4">No recent jobs</p> : recentJobs.map((job) => (
                <div key={job.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{job.job_number}</span>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(job.current_stage)}`}>
                      {job.current_stage}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{job.project_name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{new Date(job.created_at).toLocaleDateString()}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(job.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentJobs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-gray-500">No recent jobs found</td></tr>
                  ) : recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4"><span className="font-semibold text-gray-900">{job.job_number}</span></td>
                      <td className="py-4 text-gray-600">{job.project_name}</td>
                      <td className="py-4 text-gray-500">{job.client?.company || '-'}</td>
                      <td className="py-4 text-right font-semibold text-gray-900">{formatCurrency(job.total_amount)}</td>
                      <td className="py-4 text-right">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(job.current_stage)}`}>
                          {job.current_stage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">

          {/* Work Pipeline */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Work Pipeline</h2>

            {/* Donut Chart (Simulated with SVG stroke-dasharray) */}
            {/* Note: In a real dynamic chart, we'd calculate stroke-dasharray based on percentages. 
                For now, we'll keep the circle visual but update the center number only, as CSS pie charts are complex without a library. 
                Replacing the fixed colored circles with a single 'Active Jobs' ring for simplicity unless using Recharts. 
            */}
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
                <circle cx="60" cy="60" r="45" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#4f46e5" strokeWidth="12"
                  strokeDasharray={`${(dashboardStats.activeJobs > 0 ? 283 : 0)} 283`} strokeDashoffset="0" strokeLinecap="round" className="transition-all duration-1000 ease-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-3xl font-bold text-gray-900">{dashboardStats.activeJobs}</span>
                  <p className="text-xs text-gray-400 font-medium">Active Jobs</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              {pipeline.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${item.color.split(' ')[0]}`}></span>
                    <span className="text-sm text-gray-600">{item.label}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Attention */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={18} className="text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">Needs Attention</h2>
            </div>

            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.label} className={`flex items-center justify-between p-3 rounded-xl ${alert.color}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 ${alert.iconBg} rounded-lg flex items-center justify-center text-sm font-bold`}>
                      {alert.icon}
                    </span>
                    <span className="text-sm font-medium">{alert.label}</span>
                  </div>
                  <span className="font-bold">{alert.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions - Desktop */}
          <div className="hidden lg:block bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/sales/orders" className="p-4 bg-gray-900 text-white rounded-xl text-center text-sm font-medium hover:bg-gray-800 transition-colors">
                + New Order
              </Link>
              <Link href="/admin/cmyk-print" className="p-4 bg-indigo-50 text-indigo-700 rounded-xl text-center text-sm font-medium hover:bg-indigo-100 transition-colors">
                Print Job
              </Link>
              <Link href="/admin/dispatch" className="p-4 bg-green-50 text-green-700 rounded-xl text-center text-sm font-medium hover:bg-green-100 transition-colors">
                QC Check
              </Link>
              <Link href="/admin/crm/clients" className="p-4 bg-purple-50 text-purple-700 rounded-xl text-center text-sm font-medium hover:bg-purple-100 transition-colors">
                Clients
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
