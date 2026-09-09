'use client';

import { useState, useMemo } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, Printer, Loader2 } from 'lucide-react';
import { useExpenses, useVendorPayments } from '@/lib/hooks';
import { exportToCSV } from '@/lib/csv-export';
import LoadError from '@/components/LoadError';
import { createAuditedBrowserClient } from '@/lib/supabase';
import useSWR from 'swr';

const supabase = createAuditedBrowserClient();

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
      .order('payment_date', { ascending: false })
      // Its twin on the Reports Center was capped at 500 with a comment calling
      // the unbounded version a full table scan; this copy never was. The table
      // is frozen at 50 rows so the cap is theory today, but an uncapped select
      // is how it stops being theory.
      .limit(500);
    if (error) throw error;
    return data || [];
  }, { revalidateOnFocus: false });
}

export default function FinanceReportPage() {
  // Every one of these three used to be destructured without its error, so a
  // failed read fell through to "No transactions for this period / filter" and
  // "No expenses recorded" — the same words the screen shows when the period
  // genuinely holds nothing. An empty array and an unread query are identical in
  // JavaScript and opposite in meaning.
  const { data: paymentsRaw, isLoading: loadingPayments, error: paymentsError, mutate: retryPayments } = usePaymentsReceivedDirect();
  const { expenses, loading: loadingExpenses, error: expensesError, refetch: retryExpenses } = useExpenses();
  const { vendorPayments, loading: loadingVendor, error: vendorError, refetch: retryVendor } = useVendorPayments();
  const loadError = paymentsError || expensesError || vendorError;
  // The jobs query that fed the billed-in-range total is gone with it — this
  // screen is history from the app's own ledger and nothing else.

  const isLoading = loadingPayments || loadingExpenses || loadingVendor;

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

  // Table applies type filter on top of date filter
  const filteredTransactions = useMemo(() =>
    dateFiltered
      .filter(t => typeFilter === 'all' || t.type === typeFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
    , [dateFiltered, typeFilter]);

  // `totalBilled` (summed from the live `jobs` table) used to live here purely to
  // be divided by a dead payments figure into "Outstanding" and "% collected".
  // A live numerator over a frozen denominator is worse than either number alone,
  // so it is gone with them. Billing by client lives on the Sales report.


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
            <p className="text-sm text-gray-500">History only — the app&rsquo;s own ledger, up to 5 August 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-100 border border-gray-200 text-sm font-medium">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm font-medium">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-gray-500" />
          <span className="font-medium text-gray-700 text-sm">Filters</span>
          <span className="ml-auto text-xs text-gray-400">The date range filters everything below. The Type filter only affects the transaction list.</span>
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


      {/* ⛔ 2026-09-08. This block used to show Total Billed, Received, Outstanding,
          Expenses, NET PROFIT and a profit margin %, plus a collection-progress
          bar — all computed from the app's own ledger, which stopped being
          written on 5 August 2026. Measured against Zoho on 2026-09-08 for
          FY2026-27 it was claiming ₹24.77L income where the bank saw ₹91.51L,
          ₹16.06L of spend where the bank saw ₹76.80L (the `expenses` table has
          never held a single row, so only vendor payments counted), and ₹9.15L
          billed against Zoho's ₹1.19cr. Net Profit ₹8.70L at a 35% margin was
          therefore an invented number wearing the most confident styling on the
          page — and mixing a LIVE jobs figure with a DEAD payments figure is
          what made Outstanding and "collected %" worse than either half alone.

          A banner above a wrong number does not fix the number. The derived
          judgments are gone. What survives is the transaction history below,
          which is a true record of what this ledger held while it was alive. */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">There is no profit figure on this page any more.</p>
          <p className="mt-1 text-sm text-amber-800">
            This screen reads the app&rsquo;s own ledger, which stopped being written on 5 August 2026
            when Zoho became the book of record. It last held about a quarter of the money that
            actually moved through the bank this financial year, so any income, expense, profit or
            margin worked out from it would be wrong by a wide margin rather than slightly stale.
          </p>
          <p className="mt-2 text-sm text-amber-800">
            For what is true today, use{' '}
            <Link href="/admin/finance" className="font-semibold underline underline-offset-2">Sales &amp; Finance</Link>
            {' '}— Money In, Money Out and Bank &amp; Cash all read Zoho, and{' '}
            <Link href="/admin/finance/reports" className="font-semibold underline underline-offset-2">Finance &rarr; Reports</Link>
            {' '}has the cashflow and category picture.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            The table below is kept because July still matters. It is history, not a current position.
          </p>
        </div>
      )}

      {loadError && (
        <LoadError
          what="this ledger's history"
          error={loadError}
          // All three sources feed `loadError`, so retrying only one of them
          // left a permanent error with a button that did nothing whenever the
          // failure was in expenses or vendor payments.
          onRetry={() => { retryPayments(); retryExpenses(); retryVendor(); }}
        />
      )}

      {/* Nothing below renders while a read is failing: an empty transaction
          table under a real heading says "nothing happened", which is the one
          thing a failed query must never be allowed to say. */}
      {!loadError && (
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

          {/* A second Net Profit lived here, in the Period Summary card, computed
              the same way from the same dead ledger. Removing the big tile and
              leaving this one would have kept the wrong number on the page in
              smaller type. The two totals below are what this ledger recorded —
              stated as that, with no net drawn from them. */}
          {!isLoading && (totalIncome > 0 || totalExpense > 0) && (
            <div className="bg-gray-900 text-white rounded-md p-4 space-y-2 text-sm">
              <p className="font-bold text-xs uppercase tracking-wide text-gray-400">What this ledger recorded</p>
              <div className="flex justify-between"><span className="text-gray-300">Payments received</span><span className="font-bold">{fmtRs(totalIncome)}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Expenses and vendor payments</span><span className="font-bold">{fmtRs(totalExpense)}</span></div>
              <p className="border-t border-gray-700 pt-2 text-xs text-gray-400">
                No net is shown. This ledger never held the whole picture, and it has held nothing
                new since 5 August 2026 — subtracting one incomplete figure from another would only
                produce a confident wrong answer.
              </p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
