'use client';

import { useState, useMemo } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, TrendingUp, Users, Package, IndianRupee, CheckCircle, Clock } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import useSWR from 'swr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function usePaymentsReceivedDirect() {
  return useSWR('pr_direct_sales', async () => {
    const { data } = await supabase
      .from('payments_received')
      .select('id, amount, payment_date, client_id');
    return data || [];
  }, { revalidateOnFocus: false });
}

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
  const { data: paymentsRaw } = usePaymentsReceivedDirect();

  // Financial year start
  const fyStart = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-04-01`
    : `${new Date().getFullYear() - 1}-04-01`;

  const [dateFrom, setDateFrom] = useState(fyStart);
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
    const matchesClient = !clientFilter || ((job.client?.name || '').toLowerCase().includes(clientFilter.toLowerCase()) || (job.client?.company || '').toLowerCase().includes(clientFilter.toLowerCase()));

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

  const totalBilled = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.amount, 0);
  const totalOrders = filteredSales.length;

  // Received = actual payments collected within the same date range
  const receivedTotal = useMemo(() => {
    return (paymentsRaw || []).filter((p: any) => {
      const d = (p.payment_date || '').split('T')[0];
      return d >= dateFrom && d <= dateTo;
    }).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  }, [paymentsRaw, dateFrom, dateTo]);

  const pendingTotal = Math.max(0, totalBilled - receivedTotal);
  const collectionRate = totalBilled > 0 ? Math.round((receivedTotal / totalBilled) * 100) : 0;

  const avgOrderValue = totalOrders > 0 ? Math.round(totalBilled / totalOrders) : 0;

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
    toast.info(`📥 Exporting Sales Report as ${type.toUpperCase()}...\n\nIn production, this would generate a downloadable file.`);
  };

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="p-2 hover:bg-gray-100 rounded-md">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Sales Report</h1>
            <p className="text-sm text-gray-500">Revenue & order analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100">
            <Download size={16} />
            <span>PDF</span>
          </button>
          <button onClick={() => handleExport('excel')} className="flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-100">
            <Download size={16} />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md md:rounded-md p-3 md:p-4 border border-gray-100">
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
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Stats — AR View: Billed / Received / Pending / Orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {/* Total Billed */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <IndianRupee size={15} /><span className="text-xs font-bold uppercase tracking-wide">Total Billed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{(totalBilled / 1000).toFixed(1)}K</p>
          <p className="text-xs text-gray-400 mt-1">{totalOrders} orders · {avgOrderValue > 0 ? `avg ₹${(avgOrderValue / 1000).toFixed(0)}K` : ''}</p>
        </div>
        {/* Received */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-md p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={15} /><span className="text-xs font-bold uppercase tracking-wide">Received</span>
          </div>
          <p className="text-2xl font-bold">₹{(receivedTotal / 1000).toFixed(1)}K</p>
          <p className="text-xs opacity-75 mt-1">{collectionRate}% collected</p>
        </div>
        {/* Pending */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-md p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={15} /><span className="text-xs font-bold uppercase tracking-wide">Pending</span>
          </div>
          <p className="text-2xl font-bold">₹{(pendingTotal / 1000).toFixed(1)}K</p>
          <p className="text-xs opacity-75 mt-1">{100 - collectionRate}% outstanding</p>
        </div>
        {/* Unique Clients */}
        <div className="bg-gray-900 rounded-md p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} /><span className="text-xs font-bold uppercase tracking-wide">Clients</span>
          </div>
          <p className="text-2xl font-bold">{uniqueClients.length}</p>
          <p className="text-xs opacity-75 mt-1">unique clients</p>
        </div>
      </div>

      {/* AR Progress Bar */}
      {totalBilled > 0 && (
        <div className="bg-white rounded-md border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Collection Progress</span>
            <span className="text-xs text-gray-500">{collectionRate}% collected · ₹{(pendingTotal).toLocaleString('en-IN')} still pending</span>
          </div>
          <div className="w-full h-3 bg-red-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-green-600 font-bold">✅ ₹{receivedTotal.toLocaleString('en-IN')} received</span>
            <span className="text-xs text-red-500 font-bold">🔴 ₹{pendingTotal.toLocaleString('en-IN')} pending</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Sales Table */}
        <div className="lg:col-span-2 bg-white rounded-md border border-gray-100 overflow-hidden">
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
                      <span className={`px-2 py-1 text-xs rounded-md ${sale.status === 'completed' ? 'bg-gray-100 text-gray-900' :
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
        <div className="bg-white rounded-md md:rounded-md p-3 md:p-4 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Top Clients</h2>
          <div className="space-y-3">
            {topClients.map(([client, revenue], index) => (
              <div key={client} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${index === 0 ? 'bg-white0' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                  }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{client}</p>
                  <p className="text-xs text-gray-500">₹{revenue.toLocaleString()}</p>
                </div>
                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full"
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
