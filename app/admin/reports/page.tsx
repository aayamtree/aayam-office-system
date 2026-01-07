'use client';

import Link from 'next/link';
import { BarChart3, TrendingUp, Truck, FileText, Download, Loader2, Search, Printer, Calendar } from 'lucide-react';
import { useDashboardStats, useClients, useJobs, usePaymentsReceived } from '@/lib/hooks';
import { useState } from 'react';

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
        </div>
      </div>

      {/* Statement Generator */}
      <ClientStatementGenerator />
    </div>
  );
}

function ClientStatementGenerator() {
  const { clients } = useClients();
  const { jobs } = useJobs();
  const { payments } = usePaymentsReceived();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showStatement, setShowStatement] = useState(false);

  const generateStatement = () => {
    if (!selectedClientId) return alert('Please select a client');
    setShowStatement(true);
  };

  const client = clients.find(c => c.id === selectedClientId);

  // MERGE LEGER
  const clientJobs = jobs.filter(j => j.client_id === selectedClientId);
  const clientPayments = payments.filter(p => p.client_id === selectedClientId);

  const mergedLedger = [
    ...clientJobs.map(j => ({
      date: j.created_at, type: 'INVOICE', ref: j.job_number,
      desc: j.project_name, debit: j.total_amount, credit: 0,
      mode: '-'
    })),
    ...clientPayments.map(p => ({
      date: p.payment_date, type: 'PAYMENT', ref: p.payment_number,
      desc: 'Payment Received', debit: 0, credit: p.amount,
      mode: p.payment_mode
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Filter by Date
  const filteredLedger = mergedLedger.filter(item => {
    if (dateRange.start && new Date(item.date) < new Date(dateRange.start)) return false;
    if (dateRange.end && new Date(item.date) > new Date(dateRange.end + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
          <FileText size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Generate Client Statement</h2>
          <p className="text-sm text-gray-500">Financial Year Ledger</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Select Client</label>
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            className="w-full px-3 py-2 border rounded-xl"
          >
            <option value="">-- Choose Client --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">From Date</label>
          <input type="date" className="w-full px-3 py-2 border rounded-xl" onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To Date</label>
          <input type="date" className="w-full px-3 py-2 border rounded-xl" onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>

      <button
        onClick={generateStatement}
        className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium w-full md:w-auto"
      >
        Generate Statement
      </button>

      {showStatement && client && (
        <div className="fixed inset-0 bg-white z-[100] overflow-auto p-8 animate-fade-in">
          {/* PRINT HEADER */}
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-8 border-b pb-4">
              <div>
                <h1 className="text-2xl font-bold uppercase tracking-widest text-gray-900">Statement of Account</h1>
                <p className="text-gray-500 mt-1">Aayam Office System</p>
              </div>
              <div className="text-right">
                <button onClick={() => window.print()} className="print:hidden px-4 py-2 bg-gray-900 text-white rounded-lg flex items-center gap-2 hover:bg-black mb-2">
                  <Printer size={16} /> Print / PDF
                </button>
                <button onClick={() => setShowStatement(false)} className="print:hidden px-4 py-2 text-gray-500 hover:text-red-500">Close</button>
              </div>
            </div>

            {/* INFO */}
            <div className="flex justify-between mb-8">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">To</p>
                <h3 className="text-xl font-bold">{client.name}</h3>
                <p>{client.company}</p>
                <p className="text-gray-500">{client.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold">Statement Period</p>
                <p className="font-medium">{dateRange.start || 'Beginning'} - {dateRange.end || 'Today'}</p>
              </div>
            </div>

            {/* TABLE */}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="py-3 text-left font-semibold text-gray-600 pl-2">Date</th>
                  <th className="py-3 text-left font-semibold text-gray-600">Ref / Type</th>
                  <th className="py-3 text-left font-semibold text-gray-600 w-1/3">Description</th>
                  <th className="py-3 text-left font-semibold text-gray-600">Mode</th>
                  <th className="py-3 text-right font-semibold text-gray-600">Debit (₹)</th>
                  <th className="py-3 text-right font-semibold text-gray-600">Credit (₹)</th>
                  <th className="py-3 text-right font-semibold text-gray-600 pr-2">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Running Balance */}
                {(() => {
                  let runningBalance = 0;
                  return filteredLedger.map((row, i) => {
                    runningBalance += (row.debit - row.credit);
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-3 pl-2 text-gray-500">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                        <td className="py-3 font-mono text-xs">{row.ref}</td>
                        <td className="py-3 font-medium">{row.desc}</td>
                        <td className="py-3 text-xs uppercase text-gray-400">{row.mode !== '-' ? row.mode : ''}</td>
                        <td className="py-3 text-right text-red-600">{row.debit > 0 ? row.debit.toLocaleString() : '-'}</td>
                        <td className="py-3 text-right text-green-600">{row.credit > 0 ? row.credit.toLocaleString() : '-'}</td>
                        <td className="py-3 text-right font-bold pr-2">{runningBalance.toLocaleString()}</td>
                      </tr>
                    );
                  });
                })()}

                {/* TOTALS */}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td colSpan={4} className="py-4 pl-2 text-right uppercase">Closing Balance</td>
                  <td className="py-4 text-right text-red-700">
                    {filteredLedger.reduce((sum, r) => sum + r.debit, 0).toLocaleString()}
                  </td>
                  <td className="py-4 text-right text-green-700">
                    {filteredLedger.reduce((sum, r) => sum + r.credit, 0).toLocaleString()}
                  </td>
                  <td className="py-4 text-right pr-2 text-indigo-700 text-lg">
                    ₹{filteredLedger.reduce((sum, r) => sum + (r.debit - r.credit), 0).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t text-center text-gray-400 text-xs">
              <p>Generated by Aayam Office System on {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
