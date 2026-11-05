'use client';

/**
 * Trial: Reports (new) — checklist 6.x, built straight from the ledger (journal entries).
 * Trial balance, Profit & Loss (months/quarters, compare with previous year), Cash flow, Journal, Cross-check.
 * Receivable ageing and vendor balances already live on Sales (new) and Purchases (new).
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import { formatInr, paise } from '@/lib/invoice-list-tools';

type Line = { account_id: string; debit_amount: number | null; credit_amount: number | null; description: string | null; journal_entries: { entry_date: string; entry_number: string; description: string | null; source_type: string | null; is_posted: boolean | null } };
type Acct = { id: string; code: string; name: string; account_type: string; sub_type: string | null };
const inr = (n: number) => formatInr(paise(n));
const sel = 'px-2 py-2 border border-gray-200 rounded-md text-sm bg-white';
const th = 'px-3 py-2 text-right';
const iso = (d: Date) => d.toLocaleDateString('en-CA');
const downloadCsv = (name: string, rows: (string | number)[][]) => {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
};
const fyStart = (d: Date) => `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04-01`;

function Inner() {
  const [tab, setTab] = useState<'tb' | 'pl' | 'cf' | 'journal' | 'check'>('tb');
  const [lines, setLines] = useState<Line[]>([]);
  const [accts, setAccts] = useState<Acct[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [from, setFrom] = useState(fyStart(today));
  const [to, setTo] = useState(iso(today));
  const [split, setSplit] = useState<'none' | 'month' | 'quarter'>('none');
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const a = await supabase.from('chart_of_accounts').select('id, code, name, account_type, sub_type').order('code');
        setAccts((a.data || []) as Acct[]);
        const out: Line[] = [];
        for (let f = 0; f < 100000; f += 1000) {
          const { data, error } = await supabase.from('journal_entry_lines').select('account_id, debit_amount, credit_amount, description, journal_entries!inner(entry_date, entry_number, description, source_type, is_posted)').range(f, f + 999);
          if (error) throw new Error(error.message);
          out.push(...((data || []) as any[]));
          if (!data || data.length < 1000) break;
        }
        setLines(out.filter(l => l.journal_entries.is_posted !== false));
      } catch (e: any) { toast.error(e.message || 'Could not load the ledger'); }
      setLoading(false);
    })();
  }, []);

  const byId = useMemo(() => new Map(accts.map(a => [a.id, a])), [accts]);
  const preset = (k: string) => {
    const d = new Date();
    if (k === 'month') { setFrom(iso(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(iso(d)); }
    else if (k === 'last') { setFrom(iso(new Date(d.getFullYear(), d.getMonth() - 1, 1))); setTo(iso(new Date(d.getFullYear(), d.getMonth(), 0))); }
    else if (k === 'fy') { setFrom(fyStart(d)); setTo(iso(d)); }
    else if (k === 'lfy') { const y = Number(fyStart(d).slice(0, 4)) - 1; setFrom(`${y}-04-01`); setTo(`${y + 1}-03-31`); }
    else { setFrom('2000-01-01'); setTo(iso(d)); }
  };

  // helpers
  const sumBy = (pred: (l: Line) => boolean) => {
    const m = new Map<string, { d: number; c: number }>();
    lines.forEach(l => { if (!pred(l)) return; const x = m.get(l.account_id) || { d: 0, c: 0 }; x.d += Number(l.debit_amount || 0); x.c += Number(l.credit_amount || 0); m.set(l.account_id, x); });
    return m;
  };
  const inRange = (l: Line, a: string, b: string) => l.journal_entries.entry_date >= a && l.journal_entries.entry_date <= b;
  const shiftYear = (s: string) => `${Number(s.slice(0, 4)) - 1}${s.slice(4)}`;

  const Filters = (
    <div className="flex flex-wrap gap-2 items-center">
      {[['month', 'This month'], ['last', 'Last month'], ['fy', 'This financial year'], ['lfy', 'Last financial year'], ['all', 'All time']].map(([k, l]) => <button key={k} onClick={() => preset(k)} className={sel}>{l}</button>)}
      <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={sel} /><input type="date" value={to} onChange={e => setTo(e.target.value)} className={sel} />
    </div>
  );

  // ── Trial balance (as of "to")
  const tb = useMemo(() => {
    const m = sumBy(l => l.journal_entries.entry_date <= to);
    return accts.map(a => { const x = m.get(a.id) || { d: 0, c: 0 }; const net = x.d - x.c; return { a, dr: net > 0 ? net : 0, cr: net < 0 ? -net : 0 }; }).filter(r => r.dr || r.cr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, accts, to]);
  const tbT = tb.reduce((t, r) => ({ dr: t.dr + r.dr, cr: t.cr + r.cr }), { dr: 0, cr: 0 });

  // ── P&L
  const periods = useMemo(() => {
    if (split === 'none') return [{ label: `${from} to ${to}`, a: from, b: to }];
    const out: { label: string; a: string; b: string }[] = [];
    const start = new Date(from + 'T00:00:00'); const end = new Date(to + 'T00:00:00');
    // quarters follow the Indian financial year: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar
    const qm = (start.getMonth() + 9) % 12; // months since April
    let cur = split === 'quarter' ? new Date(start.getFullYear(), start.getMonth() - (qm % 3), 1) : new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end && out.length < 60) {
      const step = split === 'month' ? 1 : 3;
      const next = new Date(cur.getFullYear(), cur.getMonth() + step, 1);
      const a = iso(cur) < from ? from : iso(cur); const lastDay = new Date(next.getTime() - 86400000); const b = iso(lastDay) > to ? to : iso(lastDay);
      out.push({ label: split === 'month' ? cur.toLocaleString('en-IN', { month: 'short', year: '2-digit' }) : `${cur.toLocaleString('en-IN', { month: 'short' })}–${lastDay.toLocaleString('en-IN', { month: 'short', year: '2-digit' })}`, a, b });
      cur = next;
    }
    return out;
  }, [from, to, split]);
  const plRows = useMemo(() => {
    const cols = periods.map(p => sumBy(l => inRange(l, p.a, p.b)));
    const prev = compare ? periods.map(p => sumBy(l => inRange(l, shiftYear(p.a), shiftYear(p.b)))) : [];
    const val = (m: Map<string, { d: number; c: number }>, a: Acct) => { const x = m.get(a.id) || { d: 0, c: 0 }; return a.account_type === 'income' ? x.c - x.d : x.d - x.c; };
    const mk = (type: string) => accts.filter(a => a.account_type === type).map(a => ({ a, v: cols.map(c => val(c, a)), p: prev.map(c => val(c, a)) })).filter(r => r.v.some(x => x) || r.p.some(x => x));
    const inc = mk('income'), exp = mk('expense');
    const tot = (rows: typeof inc, k: 'v' | 'p') => periods.map((_, i) => rows.reduce((s, r) => s + (r[k][i] || 0), 0));
    return { inc, exp, incT: tot(inc, 'v'), expT: tot(exp, 'v'), incP: tot(inc, 'p'), expP: tot(exp, 'p') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, accts, periods, compare]);

  // ── Cash flow: movement on bank / cash accounts by month
  const cf = useMemo(() => {
    const cash = new Set(accts.filter(a => a.sub_type === 'Bank' || a.sub_type === 'Cash').map(a => a.id));
    const m = new Map<string, { in: number; out: number }>();
    lines.forEach(l => { if (!cash.has(l.account_id) || !inRange(l, from, to)) return; const k = l.journal_entries.entry_date.slice(0, 7); const x = m.get(k) || { in: 0, out: 0 }; x.in += Number(l.debit_amount || 0); x.out += Number(l.credit_amount || 0); m.set(k, x); });
    const opening = lines.filter(l => cash.has(l.account_id) && l.journal_entries.entry_date < from).reduce((s, l) => s + Number(l.debit_amount || 0) - Number(l.credit_amount || 0), 0);
    return { rows: Array.from(m.entries()).sort(), opening };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, accts, from, to]);

  // ── Journal
  const journal = useMemo(() => {
    const m = new Map<string, { date: string; no: string; desc: string; src: string; rows: Line[] }>();
    lines.filter(l => inRange(l, from, to)).forEach(l => { const k = l.journal_entries.entry_number; const e = m.get(k) || { date: l.journal_entries.entry_date, no: k, desc: l.journal_entries.description || '', src: l.journal_entries.source_type || '', rows: [] }; e.rows.push(l); m.set(k, e); });
    return Array.from(m.values()).sort((a, b) => (b.date + b.no).localeCompare(a.date + a.no));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, from, to]);

  // ── Cross-check
  const chk = useMemo(() => {
    const totD = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0), totC = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
    const per = new Map<string, { d: number; c: number }>(); lines.forEach(l => { const x = per.get(l.journal_entries.entry_number) || { d: 0, c: 0 }; x.d += Number(l.debit_amount || 0); x.c += Number(l.credit_amount || 0); per.set(l.journal_entries.entry_number, x); });
    const bad = Array.from(per.entries()).filter(([, x]) => Math.abs(x.d - x.c) > 0.005);
    return { totD, totC, bad, entries: per.size };
  }, [lines]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div><h1 className="text-xl font-bold">Reports (new)</h1>
        <p className="text-sm text-gray-500">Built from your ledger of journal entries. Old Zoho history lives on the Sales (new) and Purchases (new) screens and is not in these ledger reports. Who owes us and vendor balances are on those screens too.</p></div>
      <div className="flex gap-2 flex-wrap">
        {([['tb', 'Trial balance'], ['pl', 'Profit & loss'], ['cf', 'Cash flow'], ['journal', 'Journal'], ['check', 'Cross-check']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{l}</button>))}
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : <>
        {tab !== 'check' && Filters}

        {tab === 'tb' && (<div className="space-y-2">
          <div className="flex gap-2"><button onClick={() => downloadCsv('trial-balance.csv', [['Code', 'Account', 'Debit', 'Credit'], ...tb.map(r => [r.a.code, r.a.name, r.dr.toFixed(2), r.cr.toFixed(2)]), ['', 'Total', tbT.dr.toFixed(2), tbT.cr.toFixed(2)]])} className={sel}>CSV</button><button onClick={() => window.print()} className={sel}>Print</button></div>
          <p className="text-xs text-gray-500">As of {to}.</p>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Account</th><th className={th}>Debit</th><th className={th}>Credit</th></tr></thead>
            <tbody>{tb.map(r => <tr key={r.a.id} className="border-t border-gray-100"><td className="px-3 py-2">{r.a.code}</td><td className="px-3 py-2">{r.a.name}</td><td className={th}>{r.dr ? inr(r.dr) : ''}</td><td className={th}>{r.cr ? inr(r.cr) : ''}</td></tr>)}
              <tr className="border-t-2 border-gray-200 font-semibold"><td className="px-3 py-2" colSpan={2}>Total</td><td className={th}>{inr(tbT.dr)}</td><td className={th}>{inr(tbT.cr)}</td></tr></tbody></table></div>
          <p className={`text-sm font-semibold ${Math.abs(tbT.dr - tbT.cr) < 0.005 ? 'text-green-700' : 'text-red-600'}`}>Difference: {inr(tbT.dr - tbT.cr)}</p></div>)}

        {tab === 'pl' && (<div className="space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <select value={split} onChange={e => setSplit(e.target.value as any)} className={sel}><option value="none">Total for the period</option><option value="month">By month</option><option value="quarter">By quarter</option></select>
            <label className="text-sm"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Compare with the same period last year</label>
            <button onClick={() => downloadCsv('profit-and-loss.csv', [['Account', ...periods.map(p => p.label)], ...plRows.inc.map(r => [r.a.name, ...r.v.map(x => x.toFixed(2))]), ['Total income', ...plRows.incT.map(x => x.toFixed(2))], ...plRows.exp.map(r => [r.a.name, ...r.v.map(x => x.toFixed(2))]), ['Total expenses', ...plRows.expT.map(x => x.toFixed(2))], ['Net profit', ...plRows.incT.map((x, i) => (x - plRows.expT[i]).toFixed(2))]])} className={sel}>CSV</button>
            <button onClick={() => window.print()} className={sel}>Print</button>
          </div>
          <p className="text-xs text-gray-500">Accrual basis: income counts when invoiced, expenses when billed or paid out.</p>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Account</th>{periods.map(p => <th key={p.label} className={th}>{p.label}</th>)}{compare && <th className={th}>Last year</th>}</tr></thead>
            <tbody>
              <tr className="bg-gray-50 font-semibold"><td className="px-3 py-2" colSpan={periods.length + 2}>Income</td></tr>
              {plRows.inc.map(r => <tr key={r.a.id} className="border-t border-gray-100"><td className="px-3 py-1.5">{r.a.name}</td>{r.v.map((x, i) => <td key={i} className={th}>{inr(x)}</td>)}{compare && <td className={th}>{inr(r.p.reduce((s, x) => s + x, 0))}</td>}</tr>)}
              <tr className="border-t font-semibold"><td className="px-3 py-2">Total income</td>{plRows.incT.map((x, i) => <td key={i} className={th}>{inr(x)}</td>)}{compare && <td className={th}>{inr(plRows.incP.reduce((s, x) => s + x, 0))}</td>}</tr>
              <tr className="bg-gray-50 font-semibold"><td className="px-3 py-2" colSpan={periods.length + 2}>Expenses</td></tr>
              {plRows.exp.map(r => <tr key={r.a.id} className="border-t border-gray-100"><td className="px-3 py-1.5">{r.a.name}</td>{r.v.map((x, i) => <td key={i} className={th}>{inr(x)}</td>)}{compare && <td className={th}>{inr(r.p.reduce((s, x) => s + x, 0))}</td>}</tr>)}
              <tr className="border-t font-semibold"><td className="px-3 py-2">Total expenses</td>{plRows.expT.map((x, i) => <td key={i} className={th}>{inr(x)}</td>)}{compare && <td className={th}>{inr(plRows.expP.reduce((s, x) => s + x, 0))}</td>}</tr>
              <tr className="border-t-2 border-gray-300 font-bold"><td className="px-3 py-2">Net profit</td>{plRows.incT.map((x, i) => <td key={i} className={th}>{inr(x - plRows.expT[i])}</td>)}{compare && <td className={th}>{inr(plRows.incP.reduce((s, x) => s + x, 0) - plRows.expP.reduce((s, x) => s + x, 0))}</td>}</tr>
            </tbody></table></div></div>)}

        {tab === 'cf' && (<div className="space-y-2">
          <p className="text-xs text-gray-500">Money moving through your bank, cash and UPI accounts in the ledger, by month.</p>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Month</th><th className={th}>Money in</th><th className={th}>Money out</th><th className={th}>Net</th><th className={th}>Closing</th></tr></thead>
            <tbody><tr className="bg-gray-50"><td className="px-3 py-2" colSpan={4}>Opening on {from}</td><td className={th}>{inr(cf.opening)}</td></tr>
              {(() => { let run = cf.opening; return cf.rows.map(([k, x]) => { run += x.in - x.out; return <tr key={k} className="border-t border-gray-100"><td className="px-3 py-2">{k}</td><td className={th + ' text-green-700'}>{inr(x.in)}</td><td className={th + ' text-red-600'}>{inr(x.out)}</td><td className={th}>{inr(x.in - x.out)}</td><td className={th}>{inr(run)}</td></tr>; }); })()}
            </tbody></table></div></div>)}

        {tab === 'journal' && (<div className="space-y-2">
          <button onClick={() => downloadCsv('journal.csv', [['Date', 'Entry', 'Source', 'Account', 'Debit', 'Credit'], ...journal.flatMap(e => e.rows.map(l => [e.date, e.no, e.src, byId.get(l.account_id)?.name || '', Number(l.debit_amount || 0).toFixed(2), Number(l.credit_amount || 0).toFixed(2)]))])} className={sel}>CSV</button>
          <div className="space-y-2">{journal.slice(0, 200).map(e => (
            <div key={e.no} className="bg-white border border-gray-200 rounded-lg p-3 text-sm"><p className="font-semibold">{e.date} • {e.no} <span className="text-xs font-normal text-gray-500">{e.src}</span></p><p className="text-xs text-gray-500 mb-1">{e.desc}</p>
              {e.rows.map((l, i) => <div key={i} className="flex justify-between"><span>{byId.get(l.account_id)?.code} {byId.get(l.account_id)?.name}</span><span>{Number(l.debit_amount) ? 'Dr ' + inr(Number(l.debit_amount)) : 'Cr ' + inr(Number(l.credit_amount))}</span></div>)}</div>))}
            {journal.length > 200 && <p className="text-xs text-gray-400">First 200 of {journal.length} entries shown. Use the CSV for all.</p>}</div></div>)}

        {tab === 'check' && (<div className="space-y-2 max-w-xl">
          <div className={`rounded-lg border p-4 ${Math.abs(chk.totD - chk.totC) < 0.005 && chk.bad.length === 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <p className="font-semibold">{Math.abs(chk.totD - chk.totC) < 0.005 && chk.bad.length === 0 ? 'Books balance' : 'Books do not balance'}</p>
            <p className="text-sm">{chk.entries} entries • total debits {inr(chk.totD)} • total credits {inr(chk.totC)} • difference {inr(chk.totD - chk.totC)}</p>
            {chk.bad.length > 0 && <div className="mt-2 text-sm"><p className="font-semibold">Entries that do not balance:</p>{chk.bad.slice(0, 20).map(([n, x]) => <p key={n}>{n}: debit {inr(x.d)} / credit {inr(x.c)}</p>)}</div>}</div></div>)}
      </>}
    </div>
  );
}

export default function ReportsNewPage() { return (<AdminOnlyGate><Inner /></AdminOnlyGate>); }
