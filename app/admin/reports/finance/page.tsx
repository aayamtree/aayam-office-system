'use client';

import { useState, useMemo } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, TrendingUp, TrendingDown, IndianRupee, PieChart, Loader2 } from 'lucide-react';
import { usePaymentsReceived, useExpenses, useVendorPayments, useJobs } from '@/lib/hooks';
import { exportToCSV } from '@/lib/csv-export';
import { createBrowserClient } from '@supabase/ssr';
import useSWR from 'swr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  reference: string;
}

// Direct query fallback for payments_received (avoids broken RPC)
function usePaymentsReceivedDirect() {
  return useSWR('payments_received_direct', async () => {
    const { data, error } = await supabase
      .from('payments_received')
      .select('id, payment_number, payment_date, amount, payment_mode, notes, client:clients(name, company)')
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }, { revalidateOnFocus: false });
}

export default function FinanceReportPage() {
  const { data: paymentsRaw, isLoading: loadingPayments } = usePaymentsReceivedDirect();
  const { expenses, loading: loadingExpenses } = useExpenses();
  const { vendorPayments, loading: loadingVendor } = useVendorPayments();
  // Needs order_date/created_at for the billed-in-range total; the default
  // JOB_SELECTS.LIST omits them (and caps at 50 rows), which silently zeroed it out.
  const { jobs, loading: loadingJobs } = useJobs({
    select: 'id, job_number, order_date, created_at, current_stage, total_amount, amount_received',
    limit: 2000,
  });

  const isLoading = loadingPayments || loadingExpenses || loadingVendor || loadingJobs;

  // Default: start of current financial year (April 1), to today
  const fyStart = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-04-01`
    : `${new Date().getFullYear() - 1}-04-01`;
  const today = new Date().toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(fyStart);
  const [dateTo, setDateTo] = useState(today);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Build full transaction list from correct sources
  const allTransactions: Transaction[] = useMemo(() => [
    // INCOME = actual payments received from clients
    ...(paymentsRaw?.map((p: any) => ({
      id: p.id,
      date: (p.payment_date || '').split('T')[0],
      type: 'income' as const,
      category: 'Client Payment',
      description: `Payment from ${p.client?.company || p.client?.name || 'Client'}`,
      amount: Number(p.amount) || 0,
      paymentMode: p.payment_mode || 'Unknown',
      reference: p.payment_number || '',
    })) || []),
    // EXPENSE = general expenses
    ...(expenses?.map((exp: any) => ({
      id: exp.id,
      date: (exp.expense_date || '').split('T')[0],
      type: 'expense' as const,
      category: exp.category || 'Expense',
      description: exp.description || exp.category || '',
      amount: Number(exp.amount) || 0,
      paymentMode: exp.payment_mode || 'Unknown',
      reference: exp.expense_number || '',
    })) || []),
    // EXPENSE = vendor payments
    ...(vendorPayments?.map((vp: any) => ({
      id: vp.id,
      date: (vp.payment_date || '').split('T')[0],
      type: 'expense' as const,
      category: 'Vendor Payment',
      description: `${vp.vendor?.company || vp.vendor?.name || 'Vendor'}`,
      amount: Number(vp.amount) || 0,
      paymentMode: vp.payment_mode || 'Unknown',
      reference: vp.payment_number || '',
    })) || []),
  ], [paymentsRaw, expenses, vendorPayments]);

  // Stats are ALWAYS computed from full date range (not affected by type filter)
  const dateFiltered = useMemo(() =>
    allTransactions.filter(t => t.date >= dateFrom && t.date <= dateTo)
    , [allTransactions, dateFrom, dateTo]);

  const totalIncome = useMemo(() => dateFiltered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [dateFiltered]);
  const totalExpense = useMemo(() => dateFiltered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [dateFiltered]);
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  // Table applies type filter on top of date filter
  const filteredTransactions = useMemo(() =>
    dateFiltered
      .filter(t => typeFilter === 'all' || t.type === typeFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
    , [dateFiltered, typeFilter]);

  // Total BILLED from jobs in the same date range
  const totalBilled = useMemo(() =>
    (jobs || []).filter((j: any) => {
      const d = ((j.order_date || j.created_at) || '').split('T')[0];
      return d >= dateFrom && d <= dateTo && j.current_stage !== 'cancelled';
    }).reduce((s: number, j: any) => s + (Number(j.total_amount) || 0), 0)
    , [jobs, dateFrom, dateTo]);

  const outstandingTotal = Math.max(0, totalBilled - totalIncome);
  const collectionRate = totalBilled > 0 ? Math.round((totalIncome / totalBilled) * 100) : 0;

  // Expense breakdown (always full date range)
  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    dateFiltered.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [dateFiltered]);


  // Payment modes breakdown (income)
  const incomeModes = useMemo(() => {
    const map: Record<string, number> = {};
    dateFiltered.filter(t => t.type === 'income').forEach(t => {
      map[t.paymentMode] = (map[t.paymentMode] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [dateFiltered]);

  const handleExport = () => {
    exportToCSV(filteredTransactions, [
      { header: 'Date', accessor: (r: any) => r.date },
      { header: 'Type', accessor: (r: any) => r.type },
      { header: 'Category', accessor: (r: any) => r.category },
      { header: 'Description', accessor: (r: any) => r.description },
      { header: 'Reference', accessor: (r: any) => r.reference },
      { header: 'Mode', accessor: (r: any) => r.paymentMode },
      { header: 'Amount', accessor: (r: any) => r.amount },
    ], 'finance_report');
    toast.success('Finance report exported as CSV');
  };

  const fmtRs = (n: number) => n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
      ? `₹${(n / 1000).toFixed(1)}K`
      : `₹${n.toLocaleString('en-IN')}`;

  const catColors = ['bg-red-500', 'bg-orange-400', 'bg-gray-700', 'bg-amber-500', 'bg-pink-500', 'bg-violet-500'];

  return (
    <div className="space-y-4 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="p-2 hover:bg-gray-100 rounded-md">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Finance Report</h1>
            <p className="text-sm text-gray-500">Income (payments received) · Expenses · Profit analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-100 border border-gray-200 text-sm font-medium">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm font-medium">
            <Download size={15} /> Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-gray-500" />
          <span className="font-medium text-gray-700 text-sm">Filters</span>
          <span className="ml-auto text-xs text-gray-400">Stats (cards above table) always show totals for the selected date range — the Type filter only affects the transaction list below.</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Show in Table</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              <option value="all">All Transactions</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>
        </div>
      </div>


      {/* Stat Cards — AR View */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Total Billed */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2 text-gray-500"><IndianRupee size={14} /><span className="text-xs font-bold uppercase tracking-wide">Total Billed</span></div>
              <p className="text-2xl font-bold text-gray-900">{fmtRs(totalBilled)}</p>
              <p className="text-xs text-gray-400 mt-1">all orders / invoices</p>
            </div>
            {/* Received */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-md p-4 text-white">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} /><span className="text-xs font-bold uppercase tracking-wide opacity-90">Received</span></div>
              <p className="text-2xl font-bold">{fmtRs(totalIncome)}</p>
              <p className="text-xs opacity-75 mt-1">{dateFiltered.filter(t => t.type === 'income').length} payments · {collectionRate}% collected</p>
            </div>
            {/* Outstanding */}
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-md p-4 text-white">
              <div className="flex items-center gap-2 mb-2"><TrendingDown size={14} /><span className="text-xs font-bold uppercase tracking-wide opacity-90">Outstanding</span></div>
              <p className="text-2xl font-bold">{fmtRs(outstandingTotal)}</p>
              <p className="text-xs opacity-75 mt-1">still owed by clients</p>
            </div>
            {/* Expenses */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-md p-4 text-white">
              <div className="flex items-center gap-2 mb-2"><PieChart size={14} /><span className="text-xs font-bold uppercase tracking-wide opacity-90">Expenses</span></div>
              <p className="text-2xl font-bold">{fmtRs(totalExpense)}</p>
              <p className="text-xs opacity-75 mt-1">{dateFiltered.filter(t => t.type === 'expense').length} entries</p>
            </div>
            {/* Net Profit */}
            <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-gray-700 to-gray-900' : 'from-orange-600 to-red-700'} rounded-md p-4 text-white`}>
              <div className="flex items-center gap-2 mb-2"><IndianRupee size={14} /><span className="text-xs font-bold uppercase tracking-wide opacity-90">Net Profit</span></div>
              <p className="text-2xl font-bold">{netProfit < 0 ? '−' : ''}{fmtRs(Math.abs(netProfit))}</p>
              <p className="text-xs opacity-75 mt-1">{netProfit >= 0 ? '✅ Profitable' : '⚠️ Loss'} · {profitMargin}% margin</p>
            </div>
          </div>

          {/* Collection Progress Bar */}
          {totalBilled > 0 && (
            <div className="bg-white rounded-md border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Collection Progress</span>
                <span className="text-xs text-gray-500">{collectionRate}% collected · ₹{outstandingTotal.toLocaleString('en-IN')} still pending</span>
              </div>
              <div className="w-full h-3 bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-green-600 font-bold">✅ ₹{totalIncome.toLocaleString('en-IN')} received</span>
                <span className="text-xs text-red-500 font-bold">🔴 ₹{outstandingTotal.toLocaleString('en-IN')} pending</span>
              </div>
            </div>
          )}
        </>
      )}


      {/* No data hint */}
      {!isLoading && totalIncome === 0 && totalExpense === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-800">
          <p className="font-bold mb-1">⚠️ No transactions found for {dateFrom} → {dateTo}</p>
          <p>Make sure you have recorded <strong>Payments Received</strong> in Finance → Payments, and <strong>Expenses</strong> in Finance → Expenses. Also check the date range above.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transaction Table */}
        <div className="lg:col-span-2 bg-white rounded-md border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Transactions</h2>
            <span className="text-xs text-gray-400">{filteredTransactions.length} records</span>
          </div>
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTransactions.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-400">No transactions for this period / filter</td></tr>
                ) : filteredTransactions.map(t => (
                  <tr key={`${t.type}-${t.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.type === 'income' ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.category}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {t.description}
                      {t.reference && <span className="ml-1 text-xs text-gray-400 font-normal">({t.reference})</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${t.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar: Expense Breakdown + Income by Mode */}
        <div className="space-y-3">
          <div className="bg-white rounded-md p-4 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Expense Breakdown</h2>
            {expenseBreakdown.length === 0 ? (
              <p className="text-xs text-gray-400">No expenses recorded</p>
            ) : (
              <div className="space-y-3">
                {expenseBreakdown.map(([category, amount], index) => (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 truncate">{category}</span>
                      <span className="font-bold text-gray-900 ml-2">{fmtRs(amount)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${catColors[index % catColors.length]} rounded-full transition-all`}
                        style={{ width: `${totalExpense > 0 ? (amount / totalExpense) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-md p-4 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Income by Payment Mode</h2>
            {incomeModes.length === 0 ? (
              <p className="text-xs text-gray-400">No income recorded</p>
            ) : (
              <div className="space-y-2">
                {incomeModes.map(([mode, amount]) => (
                  <div key={mode} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-600 capitalize">{mode.toLowerCase()}</span>
                    <span className="font-bold text-gray-900">{fmtRs(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Summary */}
          {!isLoading && (totalIncome > 0 || totalExpense > 0) && (
            <div className="bg-gray-900 text-white rounded-md p-4 space-y-2 text-sm">
              <p className="font-bold text-xs uppercase tracking-wide text-gray-400">Period Summary</p>
              <div className="flex justify-between"><span className="text-gray-300">Gross Income</span><span className="font-bold text-green-400">{fmtRs(totalIncome)}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Total Expenses</span><span className="font-bold text-red-400">{fmtRs(totalExpense)}</span></div>
              <div className="border-t border-gray-700 pt-2 flex justify-between">
                <span className="text-gray-300">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</span>
                <span className={`font-bold text-base ${netProfit >= 0 ? 'text-green-400' : 'text-orange-400'}`}>{fmtRs(Math.abs(netProfit))}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
