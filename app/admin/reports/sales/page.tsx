'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, Calendar, TrendingUp, Users, Package, IndianRupee } from 'lucide-react';

interface SaleRecord {
  id: string;
  date: string;
  orderNumber: string;
  client: string;
  items: string;
  quantity: number;
  amount: number;
  status: 'completed' | 'pending' | 'cancelled';
}

import { useJobs } from '@/lib/hooks';

export default function SalesReportPage() {
  const { jobs, loading } = useJobs();
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState('');

  const filteredSales = jobs.filter(job => {
    const jobDate = job.order_date.split('T')[0];
    const matchesDate = jobDate >= dateFrom && jobDate <= dateTo;

    // Map job stages to simpler status for report
    let reportStatus = 'pending';
    if (job.current_stage === 'delivered' || job.current_stage === 'ready') reportStatus = 'completed';
    else if (job.current_stage === 'cancelled') reportStatus = 'cancelled';

    const matchesStatus = statusFilter === 'all' || reportStatus === statusFilter;
    const matchesClient = !clientFilter || (job.client?.name.toLowerCase().includes(clientFilter.toLowerCase()) || job.client?.company?.toLowerCase().includes(clientFilter.toLowerCase()));

    return matchesDate && matchesStatus && matchesClient;
  }).map(job => ({
    id: job.id,
    date: job.order_date.split('T')[0],
    orderNumber: job.job_number,
    client: job.client?.company || job.client?.name || 'Unknown',
    items: job.project_name,
    quantity: job.quantity,
    amount: job.total_amount,
    status: (job.current_stage === 'delivered' || job.current_stage === 'ready' ? 'completed' : (job.current_stage === 'cancelled' ? 'cancelled' : 'pending')) as 'completed' | 'pending' | 'cancelled'
  }));

  const totalRevenue = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.amount, 0);
  const totalOrders = filteredSales.length;
  const completedOrders = filteredSales.filter(s => s.status === 'completed').length;
  const avgOrderValue = completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0;

  const uniqueClients = Array.from(new Set(filteredSales.map(s => s.client)));

  // Top clients by revenue
  const clientRevenue = filteredSales
    .filter(s => s.status !== 'cancelled')
    .reduce((acc, sale) => {
      acc[sale.client] = (acc[sale.client] || 0) + sale.amount;
      return acc;
    }, {} as Record<string, number>);

  const topClients = Object.entries(clientRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const handleExport = (type: 'pdf' | 'excel') => {
    alert(`📥 Exporting Sales Report as ${type.toUpperCase()}...\n\nIn production, this would generate a downloadable file.`);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-page-title text-gray-900">Sales Report</h1>
            <p className="text-sm text-gray-500">Revenue & order analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-xl hover:bg-red-100">
            <Download size={16} />
            <span>PDF</span>
          </button>
          <button onClick={() => handleExport('excel')} className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100">
            <Download size={16} />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <span className="font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Client</label>
            <input
              type="text"
              placeholder="Search client..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee size={18} />
            <span className="text-sm opacity-90">Total Revenue</span>
          </div>
          <p className="text-page-title">₹{(totalRevenue / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Package size={18} />
            <span className="text-sm opacity-90">Total Orders</span>
          </div>
          <p className="text-page-title">{totalOrders}</p>
        </div>
        <div className="bg-oms-blue rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} />
            <span className="text-sm opacity-90">Avg Order Value</span>
          </div>
          <p className="text-page-title">₹{(avgOrderValue / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} />
            <span className="text-sm opacity-90">Unique Clients</span>
          </div>
          <p className="text-page-title">{uniqueClients.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Sales Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Order</th>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Items</th>
                  <th className="px-4 py-3 text-right text-label text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-center text-label text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{sale.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{sale.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sale.client}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sale.items}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">₹{sale.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${sale.status === 'completed' ? 'bg-green-100 text-green-700' :
                        sale.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Top Clients</h2>
          <div className="space-y-3">
            {topClients.map(([client, revenue], index) => (
              <div key={client} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                  }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{client}</p>
                  <p className="text-xs text-gray-500">₹{revenue.toLocaleString()}</p>
                </div>
                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[rgba(0,0,255,0.1)] rounded-full"
                    style={{ width: `${(revenue / topClients[0][1]) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
