'use client';

import Link from 'next/link';
import { BarChart3, TrendingUp, Truck, FileText, Download, Loader2 } from 'lucide-react';
import { useDashboardStats } from '@/lib/hooks';

export default function ReportsPage() {
  const { stats, loading } = useDashboardStats();

  const reportTypes = [
    {
      title: 'Sales Report',
      desc: 'Orders, revenue & client analytics',
      icon: TrendingUp,
      href: '/admin/reports/sales',
      color: 'bg-green-100 text-green-600',
      stats: `₹${(stats?.salesPerformance?.[stats.salesPerformance.length - 1]?.value || 0).toLocaleString()} this month`
    },
    {
      title: 'Finance Report',
      desc: 'Income, expenses & profit analysis',
      icon: BarChart3,
      href: '/admin/reports/finance',
      color: 'bg-blue-100 text-blue-600',
      stats: 'View details'
    },
    {
      title: 'Dispatch Report',
      desc: 'Delivery & logistics tracking',
      icon: Truck,
      href: '/admin/reports/dispatch',
      color: 'bg-amber-100 text-amber-600',
      stats: `${stats?.pendingDispatches || 0} pending`
    },
  ];

  const quickStats = [
    { label: 'Total Clients', value: stats?.totalClients.toString() || '0', change: 'Active Database', positive: true },
    { label: 'Revenue (YTD)', value: `₹${(stats?.totalRevenue || 0).toLocaleString()}`, change: 'Total Invoiced', positive: true },
    { label: 'Pending Payments', value: `₹${(stats?.pendingPayments || 0).toLocaleString()}`, change: 'To Collect', positive: false },
    { label: 'Active Jobs', value: stats?.activeJobs.toString() || '0', change: 'In Pipeline', positive: true },
  ];

  const chartData = stats?.salesPerformance || [];
  const maxRevenue = Math.max(...chartData.map((d: any) => d.value), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500">Business analytics & insights</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          // Loading Skeletons
          [1, 2, 3, 4].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)
        ) : (
          quickStats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              <p className={`text-xs mt-2 ${stat.positive ? 'text-green-600' : 'text-amber-600'}`}>
                {stat.change}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <Link
            key={report.title}
            href={report.href}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 ${report.color} rounded-xl flex items-center justify-center`}>
                <report.icon size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{report.desc}</p>
                <p className="text-sm font-medium text-indigo-600 mt-2">{loading ? '...' : report.stats}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Monthly Overview Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Revenue Overview</h2>
          <span className="text-xs text-gray-500">Current Year</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 className="animate-spin mr-2" /> Loading Chart...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400">No revenue data available</div>
        ) : (
          <div className="flex items-end justify-around h-48 gap-2 sm:gap-4">
            {chartData.map((data) => {
              const height = (data.value / maxRevenue) * 100;
              return (
                <div key={data.month} className="flex flex-col items-center gap-2 group w-full">
                  <div className="relative w-full flex justify-center h-full items-end">
                    <div
                      className={`w-4 sm:w-8 md:w-12 rounded-t-lg transition-all duration-500 ${data.active ? 'bg-indigo-600' : 'bg-indigo-300 group-hover:bg-indigo-400'}`}
                      style={{ height: `${height}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-10 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      ₹{(data.value / 1000).toFixed(1)}k
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{data.month}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Export</h2>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <Download size={16} />
            <span>Sales Summary (PDF)</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <Download size={16} />
            <span>Finance Report (Excel)</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <Download size={16} />
            <span>Client List (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
