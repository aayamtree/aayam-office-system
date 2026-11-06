'use client';

/**
 * Trial: Home (new) — a one-page picture of the business, like the Puter accounting home.
 * Create actions, needs attention, profit and loss, invoices, expenses, bank accounts, income and expenses by month.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import { formatInr, paise } from '@/lib/invoice-list-tools';

const inr = (n: number) => formatInr(paise(n));
const iso = (d: Date) => d.toLocaleDateString('en-CA');
const sel = 'px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white';
const card = 'bg-white border border-gray-200 rounded-lg p-4';

type Line = { account_id: string; debit_amount: number | null; credit_amount: number | null; journal_entries: { entry_date: string; is_posted: boolean | null } };
type Acct = { id: string; name: string; account_type: string };
const PERIODS = [['month', 'This month'], ['lastmonth', 'Last month'], ['quarter', 'This quarter'], ['lastquarter', 'Last quarter'], ['ytd', 'This year to date'], ['12m', 'Last 12 months']] as const;
type PKey = typeof PERIODS[number][0];

// Indian financial year: quarters are Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar
function range(k: PKey): { a: string; b: string } {
  const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
  const qStartMonth = (mm: number) => mm - ((mm + 9) % 12) % 3;
  if (k === 'month') return { a: iso(new Date(y, m, 1)), b: iso(new Date(y, m + 1, 0)) };
  if (k === 'lastmonth') return { a: iso(new Date(y, m - 1, 1)), b: iso(new Date(y, m, 0)) };
  if (k === 'quarter') { const s = qStartMonth(m); return { a: iso(new Date(y, s, 1)), b: iso(new Date(y, s + 3, 0)) }; }
  if (k === 'lastquarter') { const s = qStartMonth(m) - 3; return { a: iso(new Date(y, s, 1)), b: iso(new Date(y, s + 3, 0)) }; }
  if (k === 'ytd') return { a: `${m >= 3 ? y : y - 1}-04-01`, b: iso(d) };
  return { a: iso(new Date(y, m - 11, 1)), b: iso(new Date(y, m + 1, 0)) };
}

function Inner() {
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [accts, setAccts] = useState<Acct[]>([]);
  const [inv, setInv] = useState<any[]>([]);
  const [pay, setPay] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [review, setReview] = useState<Record<string, number>>({});
  const [plP, setPlP] = useState<PKey>('month');
  const [exP, setExP] = useState<PKey>('month');
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(); setName((p?.full_name || '').split(' ')[0]); }
        const [a, i, p, b, r] = await Promise.all([
          supabase.from('chart_of_accounts').select('id, name, account_type'),
          supabase.from('invoices').select('invoice_number, total_amount, balance_due, due_date, is_void').eq('is_void', false),
          supabase.from('payments_received').select('amount, payment_date').gte('payment_date', iso(new Date(Date.now() - 30 * 86400000))),
          supabase.from('bank_accounts').select('id, name, current_balance').eq('is_active', true),
          supabase.from('bank_transactions').select('bank_account_id, is_verified, is_transfer, excluded_at, reference_type'),
        ]);
        setAccts((a.data || []) as Acct[]); setInv(i.data || []); setPay(p.data || []); setBanks(b.data || []);
        const rv: Record<string, number> = {};
        (r.data || []).forEach((t: any) => { if (!t.is_verified && !t.is_transfer && !t.excluded_at && t.reference_type !== 'ignored') rv[t.bank_account_id] = (rv[t.bank_account_id] || 0) + 1; });
        setReview(rv);
        const out: Line[] = [];
        for (let f = 0; f < 100000; f += 1000) {
          const { data, error } = await supabase.from('journal_entry_lines').select('account_id, debit_amount, credit_amount, journal_entries!inner(entry_date, is_posted)').range(f, f + 999);
          if (error) throw new Error(error.message);
          out.push(...((data || []) as any[])); if (!data || data.length < 1000) break;
        }
        setLines(out.filter(l => l.journal_entries.is_posted !== false));
      } catch (e: any) { toast.error(e.message || 'Could not load'); }
      setLoading(false);
    })();
  }, []);

  const typeOf = useMemo(() => new Map(accts.map(a => [a.id, a])), [accts]);
  const totals = (a: string, b: string) => {
    let inc = 0, exp = 0; const byAcc = new Map<string, number>();
    lines.forEach(l => {
      const d = l.journal_entries.entry_date; if (d < a || d > b) return;
      const ac = typeOf.get(l.account_id); if (!ac) return;
      if (ac.account_type === 'income') inc += Number(l.credit_amount || 0) - Number(l.debit_amount || 0);
      else if (ac.account_type === 'expense') { const v = Number(l.debit_amount || 0) - Number(l.credit_amount || 0); exp += v; byAcc.set(ac.name, (byAcc.get(ac.name) || 0) + v); }
    });
    return { inc, exp, byAcc };
  };
  const pl = useMemo(() => { const r = range(plP); return { ...r, ...totals(r.a, r.b) }; }, [plP, lines, typeOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const ex = useMemo(() => { const r = range(exP); return { ...r, ...totals(r.a, r.b) }; }, [exP, lines, typeOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = useMemo(() => {
    const out: { label: string; inc: number; exp: number }[] = []; const d = new Date();
    for (let k = 11; k >= 0; k--) { const s = new Date(d.getFullYear(), d.getMonth() - k, 1); const e = new Date(d.getFullYear(), d.getMonth() - k + 1, 0); const t = totals(iso(s), iso(e)); out.push({ label: s.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), inc: t.inc, exp: t.exp }); }
    return out;
  }, [lines, typeOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxM = Math.max(1, ...months.map(m => Math.max(m.inc, m.exp)));

  const today = iso(new Date());
  const unpaid = inv.filter(i => Number(i.balance_due) > 0.005);
  const overdue = unpaid.filter(i => i.due_date && i.due_date < today);
  const sum = (a: any[], k: string) => a.reduce((s, x) => s + Number(x[k] || 0), 0);
  const paid30 = sum(pay, 'amount');
  const toReviewTotal = Object.values(review).reduce((s, n) => s + n, 0);
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>;
  const Pick = ({ v, set }: { v: PKey; set: (k: PKey) => void }) => (<select value={v} onChange={e => set(e.target.value as PKey)} className={sel}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>);
  const topExp = Array.from(ex.byAcc.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <h1 className="text-xl font-bold">{greet}{name ? `, ${name}` : ''}</h1>

      <section className={card}>
        <h2 className="font-semibold mb-2">Create actions</h2>
        <div className="flex flex-wrap gap-2">
          {[['Create invoice', '/admin/finance/invoices-new'], ['Record payment', '/admin/finance/invoices-new'], ['Receive money (no invoice)', '/admin/finance/receive-money'], ['Pay bills', '/admin/finance/purchases-new'], ['Upload bank statement', '/admin/finance/banking-new']].map(([l, h]) => (
            <Link key={l} href={h} className="px-3 py-2 border border-gray-200 rounded-md text-sm font-semibold hover:bg-gray-50">{l}</Link>))}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-2">Needs attention</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/admin/finance/sales-new" className="block rounded-md border border-gray-200 p-3 hover:bg-gray-50"><p className="text-sm">{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'}</p><p className="text-lg font-bold text-red-600">{inr(sum(overdue, 'balance_due'))}</p></Link>
          <Link href="/admin/finance/banking-new" className="block rounded-md border border-gray-200 p-3 hover:bg-gray-50"><p className="text-sm">Bank transactions to review</p><p className="text-lg font-bold">{toReviewTotal}</p></Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <div className="flex justify-between items-center mb-2"><h2 className="font-semibold">Profit and loss</h2><Pick v={plP} set={setPlP} /></div>
          <p className="text-xs text-gray-500">Net profit for {pl.a} to {pl.b}</p>
          <p className={`text-2xl font-bold ${pl.inc - pl.exp < 0 ? 'text-red-600' : ''}`}>{inr(pl.inc - pl.exp)}</p>
          <div className="mt-2 text-sm space-y-1"><div className="flex justify-between"><span>Income</span><span>{inr(pl.inc)}</span></div><div className="flex justify-between"><span>Expenses</span><span>{inr(pl.exp)}</span></div></div>
          <Link href="/admin/finance/reports-new" className="text-sm text-blue-600 font-semibold mt-2 inline-block">View report</Link>
        </section>

        <section className={card}>
          <h2 className="font-semibold mb-2">Invoices</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Unpaid ({unpaid.length})</span><b>{inr(sum(unpaid, 'balance_due'))}</b></div>
            <div className="flex justify-between"><span>Overdue</span><span className="text-red-600">{inr(sum(overdue, 'balance_due'))}</span></div>
            <div className="flex justify-between"><span>Not due yet</span><span>{inr(sum(unpaid, 'balance_due') - sum(overdue, 'balance_due'))}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span>Paid, last 30 days</span><span className="text-green-700">{inr(paid30)}</span></div>
          </div>
          <Link href="/admin/finance/sales-new" className="text-sm text-blue-600 font-semibold mt-2 inline-block">Go to sales</Link>
        </section>

        <section className={card}>
          <div className="flex justify-between items-center mb-2"><h2 className="font-semibold">Expenses</h2><Pick v={exP} set={setExP} /></div>
          {topExp.length === 0 ? <p className="text-sm text-gray-400">No expenses in this period.</p> : (
            <div className="text-sm space-y-1">{topExp.map(([n, v]) => <div key={n} className="flex justify-between"><span>{n}</span><span>{inr(v)}</span></div>)}
              <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{inr(ex.exp)}</span></div></div>)}
        </section>

        <section className={card}>
          <div className="flex justify-between items-center mb-2"><h2 className="font-semibold">Bank accounts</h2><Link href="/admin/finance/banking-new" className="text-sm text-blue-600 font-semibold">Go to banking</Link></div>
          <div className="space-y-2">{banks.map(b => (
            <div key={b.id} className="flex justify-between text-sm"><div><p className="font-medium">{b.name}</p><p className="text-xs text-gray-500">{review[b.id] ? `${review[b.id]} to review` : 'Up to date'}</p></div><div className="text-right"><p className="font-semibold">{inr(Number(b.current_balance) || 0)}</p><p className="text-xs text-gray-500">In your books</p></div></div>))}</div>
        </section>
      </div>

      <section className={card}>
        <h2 className="font-semibold">Income and expenses by month</h2>
        <p className="text-xs text-gray-500 mb-3">Last 12 months. <span className="inline-block w-2 h-2 bg-green-600 rounded-sm" /> Income <span className="inline-block w-2 h-2 bg-red-500 rounded-sm ml-2" /> Expenses</p>
        <div className="flex items-end gap-2 h-40 overflow-x-auto">
          {months.map(m => (
            <div key={m.label} className="flex-1 min-w-[34px] flex flex-col items-center justify-end h-full" title={`${m.label}: income ${inr(m.inc)}, expenses ${inr(m.exp)}`}>
              <div className="flex items-end gap-0.5 h-full"><div className="w-3 bg-green-600 rounded-t" style={{ height: `${(Math.max(m.inc, 0) / maxM) * 100}%` }} /><div className="w-3 bg-red-500 rounded-t" style={{ height: `${(Math.max(m.exp, 0) / maxM) * 100}%` }} /></div>
              <span className="text-[10px] text-gray-500 mt-1">{m.label}</span>
            </div>))}
        </div>
      </section>
    </div>
  );
}

export default function HomeNewPage() { return (<AdminOnlyGate><Inner /></AdminOnlyGate>); }
