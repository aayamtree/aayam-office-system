'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IndianRupee, FileText, CreditCard, AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Lock, Unlock, RotateCcw } from 'lucide-react';
import DashboardGrid, { LayoutsMap, resetLayouts } from '@/components/dashboard/DashboardGrid';

const STORAGE_KEY = 'aayam-finance-layouts';

const DEFAULT_LAYOUTS: LayoutsMap = {
  lg: [
    { i: 'tools', x: 0, y: 0, w: 12, h: 2 },
    { i: 'stat-revenue', x: 0, y: 2, w: 3, h: 2 },
    { i: 'stat-outstanding', x: 3, y: 2, w: 3, h: 2 },
    { i: 'stat-received', x: 6, y: 2, w: 3, h: 2 },
    { i: 'stat-pending', x: 9, y: 2, w: 3, h: 2 },
    { i: 'link-invoices', x: 0, y: 4, w: 4, h: 3 },
    { i: 'link-purchases', x: 4, y: 4, w: 4, h: 3 },
    { i: 'link-payments', x: 8, y: 4, w: 4, h: 3 },
    { i: 'recent-tx', x: 0, y: 7, w: 6, h: 6 },
    { i: 'overdue-inv', x: 6, y: 7, w: 6, h: 6 },
    { i: 'monthly-summary', x: 0, y: 13, w: 12, h: 3 },
  ],
  md: [
    { i: 'tools', x: 0, y: 0, w: 6, h: 3 },
    { i: 'stat-revenue', x: 0, y: 3, w: 3, h: 2 },
    { i: 'stat-outstanding', x: 3, y: 3, w: 3, h: 2 },
    { i: 'stat-received', x: 0, y: 5, w: 3, h: 2 },
    { i: 'stat-pending', x: 3, y: 5, w: 3, h: 2 },
    { i: 'link-invoices', x: 0, y: 7, w: 3, h: 3 },
    { i: 'link-purchases', x: 3, y: 7, w: 3, h: 3 },
    { i: 'link-payments', x: 0, y: 10, w: 6, h: 3 },
    { i: 'recent-tx', x: 0, y: 13, w: 6, h: 6 },
    { i: 'overdue-inv', x: 0, y: 19, w: 6, h: 6 },
    { i: 'monthly-summary', x: 0, y: 25, w: 6, h: 3 },
  ],
  sm: [
    { i: 'tools', x: 0, y: 0, w: 2, h: 5 },
    { i: 'stat-revenue', x: 0, y: 5, w: 2, h: 2 },
    { i: 'stat-outstanding', x: 0, y: 7, w: 2, h: 2 },
    { i: 'stat-received', x: 0, y: 9, w: 2, h: 2 },
    { i: 'stat-pending', x: 0, y: 11, w: 2, h: 2 },
    { i: 'link-invoices', x: 0, y: 13, w: 2, h: 3 },
    { i: 'link-purchases', x: 0, y: 16, w: 2, h: 3 },
    { i: 'link-payments', x: 0, y: 19, w: 2, h: 3 },
    { i: 'recent-tx', x: 0, y: 22, w: 2, h: 6 },
    { i: 'overdue-inv', x: 0, y: 28, w: 2, h: 6 },
    { i: 'monthly-summary', x: 0, y: 34, w: 2, h: 4 },
  ],
};

export default function FinancePage() {
  const [isLocked, setIsLocked] = useState(true);

  const stats = [
    { key: 'stat-revenue', label: 'Total Revenue', value: '₹12,45,000', change: '+18%', trend: 'up', icon: TrendingUp, color: 'bg-white0' },
    { key: 'stat-outstanding', label: 'Outstanding', value: '₹2,85,000', change: '12 invoices', trend: 'warning', icon: AlertTriangle, color: 'bg-white0' },
    { key: 'stat-received', label: 'Received This Month', value: '₹4,50,000', change: '+12%', trend: 'up', icon: ArrowDownRight, color: 'bg-primary' },
    { key: 'stat-pending', label: 'Pending Payments', value: '₹95,000', change: '5 vendors', trend: 'down', icon: ArrowUpRight, color: 'bg-red-500' },
  ];

  const recentTransactions = [
    { id: 1, type: 'received', client: 'ABC Industries', amount: '₹25,000', date: '2024-12-24', method: 'Bank Transfer' },
    { id: 2, type: 'received', client: 'XYZ Corporation', amount: '₹50,445', date: '2024-12-23', method: 'Cheque' },
    { id: 3, type: 'paid', client: 'Paper World Supplies', amount: '₹18,500', date: '2024-12-23', method: 'Bank Transfer' },
    { id: 4, type: 'received', client: 'Global Traders', amount: '₹1,00,000', date: '2024-12-22', method: 'Cash' },
    { id: 5, type: 'paid', client: 'Ink Solutions', amount: '₹8,750', date: '2024-12-22', method: 'UPI' },
  ];

  const overdueInvoices = [
    { id: 'INV-2024-089', client: 'Tech Solutions', amount: '₹45,000', dueDate: '2024-12-15', days: 10 },
    { id: 'INV-2024-078', client: 'Print Masters', amount: '₹32,500', dueDate: '2024-12-10', days: 15 },
    { id: 'INV-2024-065', client: 'Fashion Hub', amount: '₹28,000', dueDate: '2024-12-05', days: 20 },
  ];

  const tools = [
    { href: '/admin/finance/opening-balance', icon: IndianRupee, title: 'Opening Balance', sub: 'FY opening entries' },
    { href: '/admin/finance/banks', icon: CreditCard, title: 'Bank Accounts', sub: 'Multi-bank ledger' },
    { href: '/admin/finance/banking', icon: RefreshCw, title: 'Reconciliation', sub: 'Match statements' },
    { href: '/admin/finance/expenses/quick', icon: TrendingDown, title: 'Quick Expense', sub: 'Fast entry' },
    { href: '/admin/finance/reports/cashbook', icon: FileText, title: 'Cash Book', sub: 'Cash report' },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-page-title text-gray-900 tracking-tight">Finance</h1>
          <p className="text-gray-500 mt-1">Manage invoices, payments & transactions</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/payments?new=true" className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors font-medium">
            <CreditCard className="w-5 h-5" /><span>Record Payment</span>
          </Link>
          <Link href="/admin/finance/invoices?new=true" className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md transition-colors font-semibold">
            <FileText className="w-5 h-5" /><span>New Invoice</span>
          </Link>
          {!isLocked && (
            <button onClick={() => { resetLayouts(STORAGE_KEY); window.location.reload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <button onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${isLocked ? 'border border-gray-200 hover:bg-gray-50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      </div>

      <DashboardGrid defaultLayouts={DEFAULT_LAYOUTS} isLocked={isLocked} storageKey={STORAGE_KEY}>
        {/* Quick Tools */}
        <div key="tools" className="h-full">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 h-full">
            {tools.map((t) => (
              <Link key={t.href} href={t.href} className="flex items-center gap-3 bg-white border border-gray-200 rounded-md p-4 hover:border-gray-300 transition-colors group">
                <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center shrink-0">
                  <t.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        {stats.map((stat) => (
          <div key={stat.key} className="h-full">
            <div className="bg-white rounded-md p-5 border border-gray-200 h-full flex flex-col justify-between group">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 ${stat.color} rounded-md flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-page-title text-gray-900">{stat.value}</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
              <p className={`text-xs mt-2 font-bold px-2 py-1 rounded-full w-fit ${stat.trend === 'up' ? 'text-gray-900 bg-white' : stat.trend === 'warning' ? 'text-gray-700 bg-gray-100' : 'text-gray-900 bg-gray-200'}`}>{stat.change}</p>
            </div>
          </div>
        ))}

        {/* Quick Links */}
        <div key="link-invoices" className="h-full">
          <Link href="/admin/finance/invoices" className="bg-white rounded-md p-4 border border-gray-200 hover:border-gray-300 transition-colors group h-full flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center"><FileText className="w-7 h-7 text-foreground" /></div>
              <div><h2 className="text-section text-gray-900">Invoices</h2><p className="text-sm font-medium text-gray-500">156 total invoices</p></div>
            </div>
            <div className="flex items-center gap-3 text-label">
              <span className="text-gray-900 bg-white px-2.5 py-1 rounded-full">132 Paid</span>
              <span className="text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">12 Pending</span>
              <span className="text-gray-900 bg-gray-200 px-2.5 py-1 rounded-full">12 Overdue</span>
            </div>
          </Link>
        </div>

        <div key="link-purchases" className="h-full">
          <Link href="/admin/finance/vendors" className="bg-white rounded-md p-4 border border-gray-200 hover:border-gray-300 transition-colors group h-full flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center"><CreditCard className="w-7 h-7 text-foreground" /></div>
              <div><h2 className="text-section text-gray-900">Purchases</h2><p className="text-sm font-medium text-gray-500">Vendors & Bills</p></div>
            </div>
            <div className="flex items-center gap-3 text-label">
              <span className="text-gray-900 bg-gray-100 px-2.5 py-1 rounded-full">34 Vendors</span>
              <span className="text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">Manage Bills</span>
            </div>
          </Link>
        </div>

        <div key="link-payments" className="h-full">
          <Link href="/admin/finance/payments" className="bg-white rounded-md p-4 border border-gray-200 hover:border-gray-300 transition-colors group h-full flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gray-100 rounded-md flex items-center justify-center"><CreditCard className="w-7 h-7 text-gray-900" /></div>
              <div><h2 className="text-section text-gray-900">Payments</h2><p className="text-sm font-medium text-gray-500">Track all transactions</p></div>
            </div>
            <div className="flex items-center gap-3 text-label">
              <span className="text-gray-900 bg-white px-2.5 py-1 rounded-full">₹4.5L Received</span>
              <span className="text-red-700 bg-red-50 px-2.5 py-1 rounded-full">₹95K Paid</span>
            </div>
          </Link>
        </div>

        {/* Recent Transactions */}
        <div key="recent-tx" className="h-full">
          <div className="bg-white rounded-md p-4 border border-gray-200 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-3"><div className="w-1 h-6 bg-gray-900 rounded-full"></div><h2 className="text-section text-gray-900">Recent Transactions</h2></div>
              <Link href="/admin/finance/payments" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-md hover:border-gray-300 transition-colors">View All</Link>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3.5 bg-gray-50/80 rounded-md hover:bg-gray-100 transition-colors border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center ${tx.type === 'received' ? 'bg-gray-100' : 'bg-red-100'}`}>
                      {tx.type === 'received' ? <ArrowDownRight className="w-4 h-4 text-gray-900" /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                    </div>
                    <div><p className="font-bold text-gray-900">{tx.client}</p><p className="text-label text-gray-500">{tx.method} • {tx.date}</p></div>
                  </div>
                  <span className={`font-bold ${tx.type === 'received' ? 'text-gray-900' : 'text-red-600'}`}>
                    {tx.type === 'received' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overdue Invoices */}
        <div key="overdue-inv" className="h-full">
          <div className="bg-white rounded-md p-4 border border-gray-200 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-3"><div className="w-1 h-6 bg-red-500 rounded-full"></div><h2 className="text-section text-gray-900">Overdue Invoices</h2></div>
              <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full font-bold uppercase tracking-wider">{overdueInvoices.length} overdue</span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100 rounded-md hover:bg-red-50 transition-colors">
                  <div>
                    <p className="font-bold text-gray-900">{inv.id}</p>
                    <p className="text-sm font-medium text-gray-600">{inv.client}</p>
                    <p className="text-xs font-bold text-red-600 mt-1 bg-red-100 w-fit px-2 py-0.5 rounded-md">{inv.days} days overdue</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-lg">{inv.amount}</p>
                    <p className="text-label text-gray-500">Due: {inv.dueDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/admin/finance/invoices?status=overdue" className="block w-full mt-4 text-center py-3 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-semibold hover:border-gray-400 transition-colors shrink-0">
              Send Payment Reminders
            </Link>
          </div>
        </div>

        {/* Monthly Summary */}
        <div key="monthly-summary" className="h-full">
          <div className="bg-white rounded-md p-5 border border-gray-200 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-1 h-6 bg-gray-900 rounded-full"></div>
              <h2 className="text-section text-gray-900">Monthly Summary</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              <div className="p-4 bg-white border border-gray-200 rounded-md"><p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Total Invoiced</p><p className="text-xl text-gray-900 font-semibold">₹5,25,000</p></div>
              <div className="p-4 bg-white border border-gray-200 rounded-md"><p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Collected</p><p className="text-xl text-gray-900 font-semibold">₹4,50,000</p></div>
              <div className="p-4 bg-white border border-gray-200 rounded-md"><p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Pending</p><p className="text-xl text-destructive font-semibold">₹75,000</p></div>
              <div className="p-4 bg-white border border-gray-200 rounded-md"><p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Expenses</p><p className="text-xl text-gray-900 font-semibold">₹1,85,000</p></div>
            </div>
          </div>
        </div>
      </DashboardGrid>
    </div>
  );
}
