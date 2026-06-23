'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Tab = 'pnl' | 'ar' | 'ap';

interface LedgerRow { account_type: string; name: string; debit: number; credit: number; }
interface AgingRow { id: string; party: string; ref: string; date: string | null; due: string | null; amount: number; }

export default function AccountingReportsPage() {
  const [tab, setTab] = useState<Tab>('pnl');
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(3); d.setDate(1); // 1 Apr (Indian FY start)
    if (new Date().getMonth() < 3) d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(today);

  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [arRows, setArRows] = useState<AgingRow[]>([]);
  const [apRows, setApRows] = useState<AgingRow[]>([]);

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ── P&L from the ledger (accrual) ──
      const { data: jeLines } = await supabase
        .from('journal_entry_lines')
        .select('debit_amount, credit_amount, chart_of_accounts!inner(name, account_type), journal_entries!inner(entry_date)')
        .gte('journal_entries.entry_date', dateFrom)
        .lte('journal_entries.entry_date', dateTo);

      const map: Record<string, LedgerRow> = {};
      (jeLines || []).forEach((l: any) => {
        const coa = l.chart_of_accounts; if (!coa) return;
        if (coa.account_type !== 'income' && coa.account_type !== 'expense') return;
        const key = coa.name;
        if (!map[key]) map[key] = { account_type: coa.account_type, name: coa.name, debit: 0, credit: 0 };
        map[key].debit += Number(l.debit_amount || 0);
        map[key].credit += Number(l.credit_amount || 0);
      });
      setLedger(Object.values(map));

      // ── AR aging: invoices with an outstanding balance ──
      const { data: invs } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, total_amount, amount_paid, client:clients(company, name)')
        .order('due_date', { ascending: true });
      setArRows((invs || [])
        .map((i: any) => ({
          id: i.id, ref: i.invoice_number,
          party: i.client?.company || i.client?.name || '—',
          date: i.invoice_date, due: i.due_date,
          amount: Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)),
        }))
        .filter((r: AgingRow) => r.amount > 0.5));

      // ── AP aging: bills with an outstanding balance ──
      const { data: bills } = await supabase
        .from('purchase_bills')
        .select('id, bill_number, bill_date, due_date, total_amount, amount_paid, vendor:vendors(company, name)')
        .order('due_date', { ascending: true });
      setApRows((bills || [])
        .map((b: any) => ({
          id: b.id, ref: b.bill_number,
          party: b.vendor?.company || b.vendor?.name || '—',
          date: b.bill_date, due: b.due_date,
          amount: Math.max(0, Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
        }))
        .filter((r: AgingRow) => r.amount > 0.5));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const income = useMemo(() => ledger.filter(l => l.account_type === 'income'), [ledger]);
  const expense = useMemo(() => ledger.filter(l => l.account_type === 'expense'), [ledger]);
  const totalIncome = income.reduce((s, l) => s + (l.credit - l.debit), 0);
  const totalExpense = expense.reduce((s, l) => s + (l.debit - l.credit), 0);
  const netProfit = totalIncome - totalExpense;

  const bucketOf = (due: string | null): string => {
    if (!due) return 'No due date';
    const d = Math.round((new Date(today + 'T00:00:00').getTime() - new Date(due + 'T00:00:00').getTime()) / 86400000);
    if (d <= 0) return 'Current';
    if (d <= 30) return '1–30 days';
    if (d <= 60) return '31–60 days';
    return '60+ days';
  };
  const buckets = ['Current', '1–30 days', '31–60 days', '60+ days', 'No due date'];
  const agingTotals = (rows: AgingRow[]) => {
    const t: Record<string, number> = {}; buckets.forEach(b => t[b] = 0);
    rows.forEach(r => { t[bucketOf(r.due)] += r.amount; });
    return t;
  };

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap ${tab === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-lg md:text-page-title text-gray-900">Accounting Reports</h1>
          <p className="text-xs md:text-sm text-gray-500">Accrual P&amp;L and receivables / payables, from the ledger</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="flex gap-2">
          <TabBtn id="pnl" label="Profit & Loss" />
          <TabBtn id="ar" label="AR Aging" />
          <TabBtn id="ap" label="AP Aging" />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-md text-sm" />
          <span className="text-gray-400">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-md border border-gray-100"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading…</div>
      ) : tab === 'pnl' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-md p-4">
              <div className="flex items-center gap-2 text-green-700"><TrendingUp className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">Income</span></div>
              <p className="text-xl font-bold text-green-800 mt-1">{fmt(totalIncome)}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-md p-4">
              <div className="flex items-center gap-2 text-red-700"><TrendingDown className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">Expenses</span></div>
              <p className="text-xl font-bold text-red-800 mt-1">{fmt(totalExpense)}</p>
            </div>
            <div className={`${netProfit >= 0 ? 'bg-gray-900' : 'bg-red-600'} rounded-md p-4`}>
              <div className="flex items-center gap-2 text-white/80"><Wallet className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">Net Profit</span></div>
              <p className="text-xl font-bold text-white mt-1">{fmt(netProfit)}</p>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 font-semibold text-gray-700 text-sm">Income</div>
            {income.length === 0 ? <p className="px-5 py-4 text-sm text-gray-400">No income posted in this period.</p> :
              income.map(l => (
                <div key={l.name} className="flex justify-between px-5 py-2.5 border-t border-gray-50 text-sm">
                  <span className="text-gray-700">{l.name}</span><span className="font-medium">{fmt(l.credit - l.debit)}</span>
                </div>
              ))}
            <div className="px-5 py-3 bg-gray-50 font-semibold text-gray-700 text-sm border-t border-gray-100">Expenses</div>
            {expense.length === 0 ? <p className="px-5 py-4 text-sm text-gray-400">No expenses posted in this period.</p> :
              expense.map(l => (
                <div key={l.name} className="flex justify-between px-5 py-2.5 border-t border-gray-50 text-sm">
                  <span className="text-gray-700">{l.name}</span><span className="font-medium">{fmt(l.debit - l.credit)}</span>
                </div>
              ))}
            <div className="flex justify-between px-5 py-3 border-t-2 border-gray-200 font-bold text-gray-900">
              <span>Net Profit</span><span>{fmt(netProfit)}</span>
            </div>
          </div>
        </div>
      ) : (
        <AgingView
          rows={tab === 'ar' ? arRows : apRows}
          totals={agingTotals(tab === 'ar' ? arRows : apRows)}
          buckets={buckets}
          bucketOf={bucketOf}
          fmt={fmt}
          label={tab === 'ar' ? 'Customer' : 'Vendor'}
          refLabel={tab === 'ar' ? 'Invoice' : 'Bill'}
        />
      )}
    </div>
  );
}

function AgingView({ rows, totals, buckets, bucketOf, fmt, label, refLabel }: {
  rows: AgingRow[]; totals: Record<string, number>; buckets: string[];
  bucketOf: (d: string | null) => string; fmt: (n: number) => string; label: string; refLabel: string;
}) {
  const grand = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {buckets.map(b => (
          <div key={b} className="bg-white border border-gray-100 rounded-md p-3 text-center">
            <p className="text-xs text-gray-500">{b}</p>
            <p className="font-bold text-gray-900 mt-1">{fmt(totals[b])}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-md border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-label text-gray-500 uppercase">{refLabel}</th>
              <th className="text-left px-4 py-3 text-label text-gray-500 uppercase">{label}</th>
              <th className="text-left px-4 py-3 text-label text-gray-500 uppercase">Due Date</th>
              <th className="text-left px-4 py-3 text-label text-gray-500 uppercase">Bucket</th>
              <th className="text-right px-4 py-3 text-label text-gray-500 uppercase">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nothing outstanding.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.ref}</td>
                <td className="px-4 py-3 text-gray-700">{r.party}</td>
                <td className="px-4 py-3 text-gray-600">{r.due ? new Date(r.due).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{bucketOf(r.due)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-bold">
                <td className="px-4 py-3" colSpan={4}>Total Outstanding</td>
                <td className="px-4 py-3 text-right">{fmt(grand)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
