'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, Truck, Package, Clock, CheckCircle } from 'lucide-react';

interface DispatchRecord {
  id: string;
  date: string;
  orderNumber: string;
  client: string;
  destination: string;
  transporter: string;
  status: 'dispatched' | 'in_transit' | 'delivered' | 'returned';
  deliveryDate: string;
  deliveryDays: number;
}

const demoDispatches: DispatchRecord[] = [
  { id: '1', date: '2024-12-25', orderNumber: 'AAY-2024-156', client: 'ABC Industries', destination: 'Ahmedabad', transporter: 'Shree Ganesh Transport', status: 'dispatched', deliveryDate: '', deliveryDays: 0 },
  { id: '2', date: '2024-12-24', orderNumber: 'AAY-2024-155', client: 'XYZ Corporation', destination: 'Rajkot', transporter: 'Self Delivery', status: 'delivered', deliveryDate: '2024-12-24', deliveryDays: 0 },
  { id: '3', date: '2024-12-24', orderNumber: 'AAY-2024-154', client: 'Global Traders', destination: 'Mumbai', transporter: 'Om Logistics', status: 'in_transit', deliveryDate: '', deliveryDays: 0 },
  { id: '4', date: '2024-12-23', orderNumber: 'AAY-2024-153', client: 'Tech Solutions', destination: 'Surat', transporter: 'Shree Transport', status: 'delivered', deliveryDate: '2024-12-24', deliveryDays: 1 },
  { id: '5', date: '2024-12-23', orderNumber: 'AAY-2024-152', client: 'Fashion Hub', destination: 'Vadodara', transporter: 'Maruti Transport', status: 'delivered', deliveryDate: '2024-12-24', deliveryDays: 1 },
  { id: '6', date: '2024-12-22', orderNumber: 'AAY-2024-151', client: 'Star Enterprises', destination: 'Rajkot', transporter: 'Self Delivery', status: 'delivered', deliveryDate: '2024-12-22', deliveryDays: 0 },
  { id: '7', date: '2024-12-22', orderNumber: 'AAY-2024-150', client: 'Prime Motors', destination: 'Jamnagar', transporter: 'Shree Ganesh Transport', status: 'delivered', deliveryDate: '2024-12-23', deliveryDays: 1 },
  { id: '8', date: '2024-12-21', orderNumber: 'AAY-2024-149', client: 'City Hospital', destination: 'Rajkot', transporter: 'Customer Pickup', status: 'delivered', deliveryDate: '2024-12-21', deliveryDays: 0 },
  { id: '9', date: '2024-12-21', orderNumber: 'AAY-2024-148', client: 'Green Foods', destination: 'Bhavnagar', transporter: 'Om Logistics', status: 'returned', deliveryDate: '', deliveryDays: 0 },
  { id: '10', date: '2024-12-20', orderNumber: 'AAY-2024-147', client: 'Blue Sky Travel', destination: 'Ahmedabad', transporter: 'Shree Transport', status: 'delivered', deliveryDate: '2024-12-21', deliveryDays: 1 },
];

export default function DispatchReportPage() {
  const [dateFrom, setDateFrom] = useState('2024-12-01');
  const [dateTo, setDateTo] = useState('2024-12-31');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [transporterFilter, setTransporterFilter] = useState('');

  const filteredDispatches = demoDispatches.filter(d => {
    const matchesDate = d.date >= dateFrom && d.date <= dateTo;
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesTransporter = !transporterFilter || d.transporter.toLowerCase().includes(transporterFilter.toLowerCase());
    return matchesDate && matchesStatus && matchesTransporter;
  });

  const totalDispatched = filteredDispatches.length;
  const delivered = filteredDispatches.filter(d => d.status === 'delivered').length;
  const inTransit = filteredDispatches.filter(d => d.status === 'in_transit' || d.status === 'dispatched').length;
  const returned = filteredDispatches.filter(d => d.status === 'returned').length;
  const avgDeliveryDays = delivered > 0 
    ? (filteredDispatches.filter(d => d.status === 'delivered').reduce((sum, d) => sum + d.deliveryDays, 0) / delivered).toFixed(1)
    : '0';

  // Destination breakdown
  const destinationBreakdown = filteredDispatches.reduce((acc, d) => {
    acc[d.destination] = (acc[d.destination] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topDestinations = Object.entries(destinationBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Transporter breakdown
  const transporterBreakdown = filteredDispatches.reduce((acc, d) => {
    acc[d.transporter] = (acc[d.transporter] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const transporterData = Object.entries(transporterBreakdown).sort((a, b) => b[1] - a[1]);

  const handleExport = (type: 'pdf' | 'excel') => {
    alert(`📥 Exporting Dispatch Report as ${type.toUpperCase()}...\n\nIn production, this would generate a downloadable file.`);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'dispatched': 'bg-blue-100 text-blue-700',
      'in_transit': 'bg-amber-100 text-amber-700',
      'delivered': 'bg-green-100 text-green-700',
      'returned': 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
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
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Dispatch Report</h1>
            <p className="text-sm text-gray-500">Delivery & logistics tracking</p>
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
              <option value="dispatched">Dispatched</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Transporter</label>
            <input
              type="text"
              placeholder="Search..."
              value={transporterFilter}
              onChange={(e) => setTransporterFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Truck size={18} />
            <span className="text-sm opacity-90">Total</span>
          </div>
          <p className="text-2xl font-bold">{totalDispatched}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} />
            <span className="text-sm opacity-90">Delivered</span>
          </div>
          <p className="text-2xl font-bold">{delivered}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Package size={18} />
            <span className="text-sm opacity-90">In Transit</span>
          </div>
          <p className="text-2xl font-bold">{inTransit}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Package size={18} />
            <span className="text-sm opacity-90">Returned</span>
          </div>
          <p className="text-2xl font-bold">{returned}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} />
            <span className="text-sm opacity-90">Avg Days</span>
          </div>
          <p className="text-2xl font-bold">{avgDeliveryDays}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dispatch Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Dispatch Details</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Destination</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Transporter</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{d.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.client}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.destination}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.transporter}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(d.status)}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Top Destinations</h2>
            <div className="space-y-3">
              {topDestinations.map(([city, count]) => (
                <div key={city} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">{city}</span>
                  <span className="font-semibold text-indigo-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">By Transporter</h2>
            <div className="space-y-3">
              {transporterData.map(([transporter, count]) => (
                <div key={transporter} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700 text-sm">{transporter}</span>
                  <span className="font-semibold text-indigo-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
