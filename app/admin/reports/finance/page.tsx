'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, TrendingUp, TrendingDown, IndianRupee, PieChart } from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
}

import { useInvoices, useExpenses, useVendorPayments } from '@/lib/hooks';

export default function FinanceReportPage() {
  const { invoices } = useInvoices();
  const { expenses } = useExpenses();
  const { vendorPayments } = useVendorPayments();

  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Combine logic
  const transactions: Transaction[] = [
    ...(invoices?.map(inv => ({
      id: inv.id,
      date: inv.invoice_date?.split('T')[0] || inv.created_at.split('T')[0],
      type: 'income' as const,
      category: 'Sales',
      description: `Invoice ${inv.invoice_number}`,
      amount: inv.total_amount,
      paymentMode: 'Bank Transfer' // Placeholder as invoice doesn't store this directly usually
    })) || []),
    ...(expenses?.map(exp => ({
      id: exp.id,
      date: exp.expense_date.split('T')[0],
      type: 'expense' as const,
      category: exp.category,
      description: exp.description || exp.category,
      amount: exp.amount,
      paymentMode: exp.payment_mode || 'Unknown'
    })) || []),
    ...(vendorPayments?.map(vp => ({
      id: vp.id,
      date: vp.payment_date.split('T')[0],
      type: 'expense' as const,
      category: 'Vendor Payment',
      description: `Payment ${vp.payment_number} to ${vp.vendor?.company || vp.vendor?.name || 'Unknown'}`,
      amount: vp.amount,
      paymentMode: vp.payment_mode || 'Unknown'
    })) || [])
  ];

  const filteredTransactions = transactions.filter(t => {
    const matchesDate = t.date >= dateFrom && t.date <= dateTo;
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesDate && matchesType;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  // Expense breakdown
  const expenseBreakdown = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const expenseData = Object.entries(expenseBreakdown).sort((a, b) => b[1] - a[1]);

  // Payment mode breakdown - mostly relevant for income/expense
  const paymentBreakdown = filteredTransactions
    .reduce((acc, t) => {
      acc[t.paymentMode] = (acc[t.paymentMode] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const handleExport = (type: 'pdf' | 'excel') => {
    alert(`📥 Exporting Finance Report as ${type.toUpperCase()}...\n\nIn production, this would generate a downloadable file.`);
  };

  const getExpenseColor = (index: number) => {
    const colors = ['bg-red-500', 'bg-white0', 'bg-primary', 'bg-primary', 'bg-white0', 'bg-pink-500'];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Finance Report</h1>
            <p className="text-sm text-gray-500">Income, expenses & profit analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100">
            <Download size={16} />
            <span>PDF</span>
          </button>
          <button onClick={() => handleExport('excel')} className="flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-100 border border-gray-200">
            <Download size={16} />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <span className="font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
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
            <label className="text-xs text-gray-500">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 md:p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} />
            <span className="text-sm opacity-90">Total Income</span>
          </div>
          <p className="text-page-title">₹{(totalIncome / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-3 md:p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} />
            <span className="text-sm opacity-90">Total Expense</span>
          </div>
          <p className="text-page-title">₹{(totalExpense / 1000).toFixed(1)}K</p>
        </div>
        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-gray-700 to-gray-800' : 'from-orange-500 to-orange-600'} rounded-lg p-3 md:p-4 text-white`}>
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee size={18} />
            <span className="text-sm opacity-90">Net Profit</span>
          </div>
          <p className="text-page-title">₹{(netProfit / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 md:p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <PieChart size={18} />
            <span className="text-sm opacity-90">Profit Margin</span>
          </div>
          <p className="text-page-title">{profitMargin}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Transactions Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Transactions</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left text-label text-gray-500">Description</th>
                  <th className="px-4 py-3 text-right text-label text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{t.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${t.type === 'income' ? 'bg-gray-100 text-gray-900' : 'bg-red-100 text-red-700'
                        }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.description}</td>
                    <td className={`px-4 py-3 text-sm font-medium text-right ${t.type === 'income' ? 'text-gray-900' : 'text-red-600'
                      }`}>
                      {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Expense Breakdown</h2>
            <div className="space-y-3">
              {expenseData.map(([category, amount], index) => (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{category}</span>
                    <span className="font-medium text-gray-900">₹{amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getExpenseColor(index)} rounded-full`}
                      style={{ width: `${(amount / totalExpense) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Payment Modes</h2>
            <div className="space-y-3">
              {Object.entries(paymentBreakdown).map(([mode, amount]) => (
                <div key={mode} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span className="text-gray-600">{mode}</span>
                  <span className="font-semibold text-gray-900">₹{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
