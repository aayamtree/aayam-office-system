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

const demoSales: SaleRecord[] = [
  { id: '1', date: '2024-12-25', orderNumber: 'AAY-2024-156', client: 'ABC Industries', items: 'Brochure A4', quantity: 500, amount: 15000, status: 'completed' },
  { id: '2', date: '2024-12-24', orderNumber: 'AAY-2024-155', client: 'XYZ Corporation', items: 'Business Cards', quantity: 1000, amount: 3500, status: 'completed' },
  { id: '3', date: '2024-12-24', orderNumber: 'AAY-2024-154', client: 'Global Traders', items: 'Packaging Box', quantity: 5000, amount: 75000, status: 'pending' },
  { id: '4', date: '2024-12-23', orderNumber: 'AAY-2024-153', client: 'Tech Solutions', items: 'Letterhead', quantity: 500, amount: 4500, status: 'completed' },
  { id: '5', date: '2024-12-23', orderNumber: 'AAY-2024-152', client: 'Fashion Hub', items: 'Catalogue 24pg', quantity: 1000, amount: 45000, status: 'completed' },
  { id: '6', date: '2024-12-22', orderNumber: 'AAY-2024-151', client: 'Star Enterprises', items: 'Annual Report', quantity: 50, amount: 25000, status: 'completed' },
  { id: '7', date: '2024-12-22', orderNumber: 'AAY-2024-150', client: 'Prime Motors', items: 'Flyers A5', quantity: 2000, amount: 8000, status: 'cancelled' },
  { id: '8', date: '2024-12-21', orderNumber: 'AAY-2024-149', client: 'City Hospital', items: 'Envelopes', quantity: 1000, amount: 5000, status: 'completed' },
  { id: '9', date: '2024-12-21', orderNumber: 'AAY-2024-148', client: 'Green Foods', items: 'Labels', quantity: 10000, amount: 12000, status: 'completed' },
  { id: '10', date: '2024-12-20', orderNumber: 'AAY-2024-147', client: 'Blue Sky Travel', items: 'Brochure Tri-fold', quantity: 500, amount: 7500, status: 'completed' },
];

export default function SalesReportPage() {
  const [dateFrom, setDateFrom] = useState('2024-12-01');
  const [dateTo, setDateTo] = useState('2024-12-31');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState('');

  const filteredSales = demoSales.filter(sale => {
    const matchesDate = sale.date >= dateFrom && sale.date <= dateTo;
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    const matchesClient = !clientFilter || sale.client.toLowerCase().includes(clientFilter.toLowerCase());
    return matchesDate && matchesStatus && matchesClient;
  });

  const totalRevenue = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.amount, 0);
  const totalOrders = filteredSales.length;
  const completedOrders = filteredSales.filter(s => s.status === 'completed').length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0;

  const uniqueClients = Array.from(new Set(demoSales.map(s => s.client)));

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
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Sales Report</h1>
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
          <p className="text-2xl font-bold">₹{(totalRevenue / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Package size={18} />
            <span className="text-sm opacity-90">Total Orders</span>
          </div>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} />
            <span className="text-sm opacity-90">Avg Order Value</span>
          </div>
          <p className="text-2xl font-bold">₹{(avgOrderValue / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} />
            <span className="text-sm opacity-90">Unique Clients</span>
          </div>
          <p className="text-2xl font-bold">{uniqueClients.length}</p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
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
                    className="h-full bg-indigo-500 rounded-full"
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
