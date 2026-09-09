'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, Printer, Users, IndianRupee, CheckCircle } from 'lucide-react';
import { exportToCSV } from '@/lib/csv-export';
import LoadError from '@/components/LoadError';

// The payments source that used to live here is gone. It read `payments_received`,
// the app's own ledger, which stopped being written on 5 August 2026 — and it had
// TWO faults on top of being frozen: it discarded the query error (`const { data } =
// await …`), so a failed read was an indistinguishable ₹0, and it was never filtered
// by the client filter above it. Filtering the report to one client therefore
// compared THAT client's billing against EVERY client's receipts, which on
// 2026-09-08 read as a 271% collection rate with ₹0 pending.
// Billing below comes from `jobs` and is live. Money collected is Zoho's answer now:
// see Sales & Finance → Money In.

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
  // Sales report needs order_date + quantity, which the default JOB_SELECTS.LIST
  // does NOT fetch. Without them job.order_date is undefined and .split() crashes.
  // `error` and `refetch` were never destructured here and `loading` was never
  // used, so a failed jobs read rendered this page as "Total Billed ₹0.0K ·
  // 0 orders · 0 clients" with an empty table — a calm, confident nothing that
  // is indistinguishable from a quiet week. This page is now the landing screen
  // for the whole Reports section, which makes that worse, not better.
  const { jobs, loading, error, refetch } = useJobs({
    select: 'id, job_number, project_name, order_date, quantity, current_stage, total_amount, client:clients(id, name, company)',
    limit: 2000,
  });

  // Financial year start
  const fyStart = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-04-01`
    : `${new Date().getFullYear() - 1}-04-01`;

  const [dateFrom, setDateFrom] = useState(fyStart);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState('');

  const filteredSales = jobs.filter(job => {
    const jobDate = String(job.order_date || '').split('T')[0];
    if (!jobDate) return false;
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
    date: String(job.order_date || '').split('T')[0],
    orderNumber: job.job_number,
    client: job.client?.company || job.client?.name || 'Unknown',
    items: job.project_name,
    quantity: job.quantity,
    amount: job.total_amount,
    status: (job.current_stage === 'delivered' || job.current_stage === 'ready' ? 'completed' : (job.current_stage === 'cancelled' ? 'cancelled' : 'pending')) as 'completed' | 'pending' | 'cancelled'
  }));

  const totalBilled = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.amount, 0);
  const totalOrders = filteredSales.length;

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

  // These two buttons used to call toast.info("In production, this would generate a
  // downloadable file.") — a download button that has never downloaded anything.
  // exportToCSV already exists and Excel opens CSV, so Excel is now real. Print is
  // the honest answer for PDF: the browser's own Save-as-PDF, rather than a second
  // button that does nothing.
  const handleExport = () => {
    exportToCSV(filteredSales, [
      { header: 'Date', accessor: (r: SaleRecord) => r.date },
      { header: 'Order', accessor: (r: SaleRecord) => r.orderNumber },
      { header: 'Client', accessor: (r: SaleRecord) => r.client },
      { header: 'Items', accessor: (r: SaleRecord) => r.items },
      { header: 'Quantity', accessor: (r: SaleRecord) => r.quantity },
      { header: 'Billed', accessor: (r: SaleRecord) => r.amount },
      { header: 'Status', accessor: (r: SaleRecord) => r.status },
    ], 'sales_report');
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
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-100 border border-gray-200">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800">
            <Printer size={16} />
            <span>Print</span>
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

      {error && (
        <LoadError what="this sales report" error={error} onRetry={() => refetch()} />
      )}

      {!error && loading && (
        <div className="rounded-md border border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
          Loading orders…
        </div>
      )}

      {/* Nothing numeric renders while the read is failing or still in flight —
          an empty table under a real heading is a claim about the business. */}
      {!error && !loading && (<>
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
        {/* The Received and Pending tiles that sat here were the report's two
            biggest numbers and both came from the dead ledger — Received was also
            never narrowed by the client filter. What a client has actually paid is
            Zoho's answer, so this points there instead of guessing. */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <CheckCircle size={15} /><span className="text-xs font-bold uppercase tracking-wide">Collected</span>
          </div>
          <p className="text-2xl font-bold text-gray-400">—</p>
          <Link href="/admin/finance/money-in" className="text-xs text-primary underline underline-offset-2 mt-1 inline-block">
            Money In reads Zoho
          </Link>
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

      {/* The collection-progress bar was the same two numbers as a picture. */}

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
      </>)}
    </div>
  );
}
