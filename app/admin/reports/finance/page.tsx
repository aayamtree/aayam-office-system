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

const demoTransactions: Transaction[] = [
  { id: '1', date: '2024-12-25', type: 'income', category: 'Sales', description: 'Order AAY-2024-156', amount: 15000, paymentMode: 'Bank Transfer' },
  { id: '2', date: '2024-12-25', type: 'expense', category: 'Raw Material', description: 'Paper purchase', amount: 25000, paymentMode: 'Bank Transfer' },
  { id: '3', date: '2024-12-24', type: 'income', category: 'Sales', description: 'Order AAY-2024-155', amount: 3500, paymentMode: 'Cash' },
  { id: '4', date: '2024-12-24', type: 'expense', category: 'Salary', description: 'Staff salary', amount: 45000, paymentMode: 'Bank Transfer' },
  { id: '5', date: '2024-12-24', type: 'income', category: 'Sales', description: 'Order AAY-2024-154', amount: 75000, paymentMode: 'UPI' },
  { id: '6', date: '2024-12-23', type: 'expense', category: 'Utilities', description: 'Electricity bill', amount: 8500, paymentMode: 'Bank Transfer' },
  { id: '7', date: '2024-12-23', type: 'income', category: 'Sales', description: 'Order AAY-2024-153', amount: 4500, paymentMode: 'Cash' },
  { id: '8', date: '2024-12-23', type: 'expense', category: 'Maintenance', description: 'Machine repair', amount: 12000, paymentMode: 'Cash' },
  { id: '9', date: '2024-12-22', type: 'income', category: 'Sales', description: 'Order AAY-2024-152', amount: 45000, paymentMode: 'Bank Transfer' },
  { id: '10', date: '2024-12-22', type: 'expense', category: 'Raw Material', description: 'Ink purchase', amount: 18000, paymentMode: 'Bank Transfer' },
  { id: '11', date: '2024-12-21', type: 'income', category: 'Retail', description: 'POS Sales', amount: 8500, paymentMode: 'Cash' },
  { id: '12', date: '2024-12-21', type: 'expense', category: 'Transport', description: 'Delivery charges', amount: 3500, paymentMode: 'Cash' },
];

const expenseCategories = ['Raw Material', 'Salary', 'Utilities', 'Maintenance', 'Transport', 'Other'];

export default function FinanceReportPage() {
  const [dateFrom, setDateFrom] = useState('2024-12-01');
  const [dateTo, setDateTo] = useState('2024-12-31');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredTransactions = demoTransactions.filter(t => {
    const matchesDate = t.date >= dateFrom && t.date <= dateTo;
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesDate && matchesType;
  });

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

  // Payment mode breakdown
  const paymentBreakdown = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      acc[t.paymentMode] = (acc[t.paymentMode] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const handleExport = (type: 'pdf' | 'excel') => {
    alert(`📥 Exporting Finance Report as ${type.toUpperCase()}...\n\nIn production, this would generate a downloadable file.`);
  };

  const getExpenseColor = (index: number) => {
    const colors = ['bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500'];
    return colors[index % colors.length];
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
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Finance Report</h1>
            <p className="text-sm text-gray-500">Income, expenses & profit analysis</p>
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
        <div className="grid grid-cols-3 gap-3">
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
            <label className="text-xs text-gray-500">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} />
            <span className="text-sm opacity-90">Total Income</span>
          </div>
          <p className="text-2xl font-bold">₹{(totalIncome/1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} />
            <span className="text-sm opacity-90">Total Expense</span>
          </div>
          <p className="text-2xl font-bold">₹{(totalExpense/1000).toFixed(1)}K</p>
        </div>
        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-2xl p-4 text-white`}>
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee size={18} />
            <span className="text-sm opacity-90">Net Profit</span>
          </div>
          <p className="text-2xl font-bold">₹{(netProfit/1000).toFixed(1)}K</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <PieChart size={18} />
            <span className="text-sm opacity-90">Profit Margin</span>
          </div>
          <p className="text-2xl font-bold">{profitMargin}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transactions Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Transactions</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{t.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.description}</td>
                    <td className={`px-4 py-3 text-sm font-medium text-right ${
                      t.type === 'income' ? 'text-green-600' : 'text-red-600'
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
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Payment Modes</h2>
            <div className="space-y-3">
              {Object.entries(paymentBreakdown).map(([mode, amount]) => (
                <div key={mode} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">{mode}</span>
                  <span className="font-semibold text-green-600">₹{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
