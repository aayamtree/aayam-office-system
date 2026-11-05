'use client';

/**
 * Trial: Purchases (new) — checklist 3.1 to 3.8.
 *  - All bills: bills from this app + Zoho history in one list (each bill once), filters, vendor balances, void
 *  - Pay one vendor: typed amount spreads over the oldest open bills (or the ticked ones); extra stays as vendor credit
 *  - Pay bills: every open bill across vendors, one payment per vendor
 *  - Vendor credits: credit notes and overpayments, applied to later bills
 * Zoho history is read-only; only bills made in this app can be paid or voided here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import { loadFiscalStartMonth } from '@/lib/finance-settings';
import { DATE_PRESET_LABELS, DatePreset, buildCsv, formatInr, paise, presetRange } from '@/lib/invoice-list-tools';

type Vendor = { id: string; name: string | null; company: string | null };
type Bill = { id: string; bill_number: string; vendor_bill_number: string | null; vendor_id: string; bill_date: string; due_date: string | null; total_amount: number; amount_paid: number; is_void: boolean };
type Row = { key: string; source: 'App' | 'Zoho history'; number: string; vendor: string; vendorId: string | null; date: string; due: string; total: number; balance: number; status: string; billId?: string };

const today = () => new Date().toISOString().slice(0, 10);
const canon = (s: string | null | undefined) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const vLabel = (v?: Vendor) => (v ? (v.company && v.name && v.company !== v.name ? `${v.company} (${v.name})` : v.company || v.name || '') : '');
const inr = (n: number) => formatInr(paise(n));
const daysTo = (d: string) => Math.floor((new Date(d).getTime() - new Date(today()).getTime()) / 86400000);
const statusOf = (bal: number, due: string, voided: boolean, draft = false) =>
  voided ? 'Voided' : draft ? 'Draft' : bal <= 0.005 ? 'Paid' : due && due < today() ? 'Overdue' : 'Not due yet';
const cls = (s: string) => s === 'Paid' ? 'bg-green-100 text-green-800' : s === 'Overdue' ? 'bg-red-100 text-red-700' : s === 'Not due yet' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600';

async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const sel = 'px-2 py-2 border border-gray-200 rounded-md text-sm bg-white';
const th = 'px-3 py-2 text-right';

function Inner() {
  const [tab, setTab] = useState<'all' | 'one' | 'many' | 'credit'>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fyMonth, setFyMonth] = useState(4);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [cash, setCash] = useState<{ id: string; name: string }[]>([]);
  const [credits, setCredits] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      setFyMonth(await loadFiscalStartMonth());
      const [vs, bs, zb, bk, ca, cr] = await Promise.all([
        fetchAll((a, b) => supabase.from('vendors').select('id, name, company').range(a, b)),
        fetchAll((a, b) => supabase.from('purchase_bills').select('id, bill_number, vendor_bill_number, vendor_id, bill_date, due_date, total_amount, amount_paid, is_void').range(a, b)),
        fetchAll((a, b) => supabase.from('zoho_documents').select('doc_number, customer_name, doc_date, due_date, status, total, balance').eq('doc_type', 'bill').range(a, b)),
        supabase.from('bank_accounts').select('id, name').eq('is_active', true),
        supabase.from('chart_of_accounts').select('name, linked_cash_account_id').not('linked_cash_account_id', 'is', null).eq('is_active', true),
        fetchAll((a, b) => supabase.from('v_vendor_credit_balance').select('*').range(a, b)),
      ]);
      const vmap = new Map((vs as Vendor[]).map(v => [v.id, v]));
      setVendors(vs as Vendor[]); setBills(bs as Bill[]);
      setBanks((bk.data || []) as any); setCash((ca.data || []).map((x: any) => ({ id: x.linked_cash_account_id, name: x.name })));
      setCredits(cr);
      const out: Row[] = [];
      const appNums = new Set<string>();
      for (const b of bs as Bill[]) {
        if (b.vendor_bill_number) appNums.add(String(b.vendor_bill_number).trim());
        const bal = b.is_void ? 0 : Math.max(0, (Number(b.total_amount) || 0) - (Number(b.amount_paid) || 0));
        const due = (b.due_date || '').slice(0, 10);
        out.push({ key: 'a' + b.id, source: 'App', number: b.vendor_bill_number || b.bill_number, vendor: vLabel(vmap.get(b.vendor_id)), vendorId: b.vendor_id, date: (b.bill_date || '').slice(0, 10), due, total: Number(b.total_amount) || 0, balance: bal, status: statusOf(bal, due, !!b.is_void), billId: b.id });
      }
      for (const z of zb) {
        if (appNums.has(String(z.doc_number).trim())) continue;
        const voided = z.status === 'void', draft = z.status === 'draft';
        const bal = voided || draft ? 0 : Number(z.balance) || 0; const due = (z.due_date || '').slice(0, 10);
        out.push({ key: 'z' + z.doc_number + z.doc_date, source: 'Zoho history', number: String(z.doc_number), vendor: z.customer_name || '', vendorId: null, date: (z.doc_date || '').slice(0, 10), due, total: voided ? 0 : Number(z.total) || 0, balance: bal, status: statusOf(bal, due, voided, draft) });
      }
      setRows(out);
    } catch (e: any) { setErr(e.message || 'Could not load'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">Purchases (new)</h1>
        <p className="text-sm text-gray-500">Bills from this app and Zoho history in one place, each bill counted once. Zoho history is read-only; bills made in this app can be paid, credited and voided here.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {([['all', 'All bills'], ['one', 'Pay one vendor'], ['many', 'Pay bills'], ['credit', 'Vendor credits']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{l}</button>))}
      </div>
      {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{err}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : (
        <>
          {tab === 'all' && <AllBills rows={rows} fyMonth={fyMonth} reload={load} />}
          {tab === 'one' && <PayOne vendors={vendors} bills={bills} banks={banks} cash={cash} credits={credits} reload={load} />}
          {tab === 'many' && <PayMany vendors={vendors} bills={bills} banks={banks} cash={cash} reload={load} />}
          {tab === 'credit' && <Credits vendors={vendors} bills={bills} credits={credits} reload={load} />}
        </>
      )}
    </div>
  );
}

// ───────── account picker shared by the pay screens ─────────
function useAccount(banks: { id: string; name: string }[], cash: { id: string; name: string }[]) {
  const [account, setAccount] = useState('');
  const parsed = () => {
    if (!account) return null;
    const [kind, id] = account.split(':');
    const nm = (kind === 'cash' ? cash : banks).find(a => a.id === id)?.name || '';
    return { bank: kind === 'bank' ? id : null, cash: kind === 'cash' ? id : null, mode: kind === 'bank' ? 'bank_transfer' : nm.toLowerCase().includes('upi') ? 'upi' : 'cash' };
  };
  const picker = (
    <select value={account} onChange={e => setAccount(e.target.value)} className={sel + ' w-full'}>
      <option value="">Paid from…</option>
      {banks.length > 0 && <optgroup label="Bank">{banks.map(a => <option key={a.id} value={`bank:${a.id}`}>{a.name}</option>)}</optgroup>}
      {cash.length > 0 && <optgroup label="Cash / UPI">{cash.map(a => <option key={a.id} value={`cash:${a.id}`}>{a.name}</option>)}</optgroup>}
    </select>);
  return { parsed, picker };
}

// ───────── tab 1: all bills ─────────
function AllBills({ rows, fyMonth, reload }: { rows: Row[]; fyMonth: number; reload: () => void }) {
  const [preset, setPreset] = useState<DatePreset>('this_fy');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [status, setStatus] = useState('all'); const [src, setSrc] = useState('all'); const [q, setQ] = useState('');
  const [voidFor, setVoidFor] = useState<Row | null>(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const range = presetRange(preset, new Date(), fyMonth, from, to);

  const list = useMemo(() => rows.filter(r => {
    if (range && (r.date < range.from || r.date > range.to)) return false;
    if (status === 'unpaid' ? !(r.status === 'Overdue' || r.status === 'Not due yet') : status !== 'all' && r.status !== status) return false;
    if (src !== 'all' && r.source !== src) return false;
    const s = q.trim().toLowerCase();
    return !s || r.number.toLowerCase().includes(s) || r.vendor.toLowerCase().includes(s);
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [rows, range, status, src, q]);

  const open = rows.filter(r => r.status === 'Overdue' || r.status === 'Not due yet');
  const overdueP = open.filter(r => r.status === 'Overdue').reduce((s, r) => s + paise(r.balance), 0);
  const notDueP = open.filter(r => r.status === 'Not due yet').reduce((s, r) => s + paise(r.balance), 0);
  const totalP = list.reduce((s, r) => s + paise(r.total), 0), balP = list.reduce((s, r) => s + paise(r.balance), 0);

  const vendorBal = useMemo(() => {
    const m = new Map<string, { name: string; open: number; overdue: number; n: number }>();
    open.forEach(r => { const k = canon(r.vendor) || 'unknown'; const g = m.get(k) || { name: r.vendor || 'Unknown', open: 0, overdue: 0, n: 0 }; g.open += paise(r.balance); if (r.status === 'Overdue') g.overdue += paise(r.balance); g.n++; m.set(k, g); });
    return Array.from(m.values()).sort((a, b) => b.open - a.open);
  }, [open]);

  const exportCsv = () => download('bills.csv', buildCsv(['Date', 'Source', 'Number', 'Vendor', 'Due', 'Total', 'Balance', 'Status'], list.map(r => [r.date, r.source, r.number, r.vendor, r.due, r.total, r.balance, r.status])));
  const doVoid = async () => {
    if (!voidFor?.billId) return; setBusy(true);
    const { error } = await supabase.rpc('fn_void_bill', { p_bill_id: voidFor.billId, p_reason: reason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Bill voided'); setVoidFor(null); setReason(''); reload();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3"><p className="text-xs text-gray-500">Unpaid bills</p><p className="font-bold">{formatInr(overdueP + notDueP)}</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-3"><p className="text-xs text-gray-500">Overdue</p><p className="font-bold text-red-600">{formatInr(overdueP)}</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-3"><p className="text-xs text-gray-500">Not due yet</p><p className="font-bold">{formatInr(notDueP)}</p></div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select className={sel} value={preset} onChange={e => setPreset(e.target.value as DatePreset)}>{(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(k => <option key={k} value={k}>{DATE_PRESET_LABELS[k]}</option>)}</select>
        {preset === 'custom' && (<><input type="date" className={sel} value={from} onChange={e => setFrom(e.target.value)} /><input type="date" className={sel} value={to} onChange={e => setTo(e.target.value)} /></>)}
        <select className={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All status</option><option value="unpaid">Unpaid</option><option>Overdue</option><option>Not due yet</option><option>Paid</option><option>Draft</option><option>Voided</option></select>
        <select className={sel} value={src} onChange={e => setSrc(e.target.value)}><option value="all">App + Zoho history</option><option>App</option><option>Zoho history</option></select>
        <input className={sel + ' flex-1 min-w-[140px]'} placeholder="Search bill or vendor" value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={exportCsv} className={sel + ' inline-flex items-center gap-1'}><Download size={14} /> CSV</button>
        <button onClick={() => window.print()} className={sel + ' inline-flex items-center gap-1'}><Printer size={14} /> Print</button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Bill</th><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Due</th><th className={th}>Total</th><th className={th}>Balance</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {list.slice(0, 500).map(r => (
              <tr key={r.key} className="border-t border-gray-100">
                <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2">{r.number}{r.source === 'Zoho history' && <span className="ml-1 text-[10px] text-gray-400">Zoho</span>}</td>
                <td className="px-3 py-2">{r.vendor}</td><td className="px-3 py-2 whitespace-nowrap">{r.due}</td>
                <td className={th}>{inr(r.total)}</td><td className={th}>{inr(r.balance)}</td>
                <td className="px-3 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls(r.status)}`}>{r.status}</span></td>
                <td className="px-3 py-2">{r.billId && r.status !== 'Voided' && <button onClick={() => setVoidFor(r)} className="text-red-600 text-xs font-semibold">Void</button>}</td>
              </tr>))}
            {list.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-gray-400">Nothing matches.</td></tr>}
          </tbody>
          <tfoot><tr className="border-t-2 border-gray-200 font-semibold"><td className="px-3 py-2" colSpan={4}>{list.length} bills{list.length > 500 ? ' (first 500 shown; totals cover all)' : ''}</td><td className={th}>{formatInr(totalP)}</td><td className={th}>{formatInr(balP)}</td><td colSpan={2}></td></tr></tfoot>
        </table>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <p className="px-3 py-2 text-sm font-semibold border-b border-gray-100">What we owe each vendor</p>
        <table className="w-full text-sm"><thead className="text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2 text-left">Vendor</th><th className={th}>Open bills</th><th className={th}>Open balance</th><th className={th}>Overdue</th></tr></thead>
          <tbody>{vendorBal.map(v => <tr key={v.name} className="border-t border-gray-100"><td className="px-3 py-2">{v.name}</td><td className={th}>{v.n}</td><td className={th}>{formatInr(v.open)}</td><td className={th + (v.overdue ? ' text-red-600' : '')}>{v.overdue ? formatInr(v.overdue) : ''}</td></tr>)}</tbody></table>
      </div>
      {voidFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setVoidFor(null)}>
          <div className="bg-white rounded-md w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">Void bill {voidFor.number}?</h2>
            <p className="text-sm text-gray-600">The bill stays on record, marked Voided, and its amount comes out of the books. It cannot be undone. A bill with payments cannot be voided.</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Reason (required)" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            <div className="flex gap-2"><button onClick={() => setVoidFor(null)} className="flex-1 px-3 py-2 border border-gray-200 rounded-md">Cancel</button><button onClick={doVoid} disabled={busy || !reason.trim()} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md disabled:opacity-50">{busy ? 'Voiding…' : 'Void bill'}</button></div>
          </div>
        </div>)}
    </div>
  );
}

// ───────── tab 2: pay one vendor ─────────
function PayOne({ vendors, bills, banks, cash, credits, reload }: { vendors: Vendor[]; bills: Bill[]; banks: any[]; cash: any[]; credits: any[]; reload: () => void }) {
  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(today()); const [ref, setRef] = useState(''); const [note, setNote] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({}); const [busy, setBusy] = useState(false);
  const acct = useAccount(banks, cash);

  const open = useMemo(() => bills.filter(b => b.vendor_id === vendorId && !b.is_void && (Number(b.total_amount) - Number(b.amount_paid || 0)) > 0.005)
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.bill_date.localeCompare(b.bill_date)), [bills, vendorId]);
  const tickedIds = open.filter(b => picked[b.id]).map(b => b.id);
  const pool = tickedIds.length ? open.filter(b => picked[b.id]) : open;
  const amt = parseFloat(amount) || 0;
  const plan = useMemo(() => { let left = Math.round(amt * 100); const out: { b: Bill; p: number }[] = [];
    for (const b of pool) { if (left <= 0) break; const bal = Math.round((Number(b.total_amount) - Number(b.amount_paid || 0)) * 100); const p = Math.min(left, bal); out.push({ b, p }); left -= p; }
    return { out, extra: left }; }, [pool, amt]);
  const myCredit = credits.filter(c => c.vendor_id === vendorId && Number(c.remaining) > 0.005).reduce((s, c) => s + paise(c.remaining), 0);

  const submit = async () => {
    const a = acct.parsed();
    if (!vendorId) return toast.error('Choose the vendor'); if (!(amt > 0)) return toast.error('Enter the amount'); if (!a) return toast.error('Choose where the money is paid from');
    setBusy(true);
    const { data, error } = await supabase.rpc('fn_pay_vendor', { p_vendor_id: vendorId, p_amount: amt, p_mode: a.mode, p_date: date, p_bank_account_id: a.bank, p_cash_account_id: a.cash, p_reference: ref || null, p_notes: note || null, p_bill_ids: tickedIds.length ? tickedIds : null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Paid. ${(data as any).applied.length} bill(s) settled${(data as any).credit > 0 ? `, ${inr((data as any).credit)} kept as vendor credit` : ''}`);
    setAmount(''); setPicked({}); reload();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <select value={vendorId} onChange={e => { setVendorId(e.target.value); setPicked({}); }} className={sel + ' w-full'}><option value="">Select vendor…</option>{vendors.map(v => <option key={v.id} value={v.id}>{vLabel(v)}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="0.01" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} className={sel} /><input type="date" value={date} onChange={e => setDate(e.target.value)} className={sel} /></div>
        {acct.picker}
        <input placeholder="Reference (optional)" value={ref} onChange={e => setRef(e.target.value)} className={sel + ' w-full'} />
        <input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className={sel + ' w-full'} />
        {myCredit > 0 && <p className="text-xs text-blue-700">This vendor has {formatInr(myCredit)} of credit. Apply it from the Vendor credits tab.</p>}
        <button onClick={submit} disabled={busy} className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-md font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Record payment'}</button>
        <p className="text-xs text-gray-400">Leave all bills un-ticked to pay the oldest first. Tick bills to pay only those. Anything extra stays as a vendor credit.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <p className="px-3 py-2 text-sm font-semibold border-b border-gray-100">Open bills (oldest first)</p>
        {vendorId === '' ? <p className="p-4 text-sm text-gray-400">Choose a vendor.</p> : open.length === 0 ? <p className="p-4 text-sm text-gray-400">No open bills made in this app for this vendor.</p> : (
          <table className="w-full text-sm"><tbody>{open.map(b => { const bal = Number(b.total_amount) - Number(b.amount_paid || 0); const pl = plan.out.find(x => x.b.id === b.id);
            return (<tr key={b.id} className="border-t border-gray-100"><td className="px-3 py-2"><input type="checkbox" checked={!!picked[b.id]} onChange={e => setPicked({ ...picked, [b.id]: e.target.checked })} /></td>
              <td className="px-3 py-2">{b.vendor_bill_number || b.bill_number}<span className="block text-[11px] text-gray-400">due {b.due_date || '—'}</span></td><td className={th}>{inr(bal)}</td>
              <td className={th + ' text-green-700'}>{pl ? '→ ' + formatInr(pl.p) : ''}</td></tr>); })}</tbody></table>)}
        {amt > 0 && plan.extra > 0 && <p className="px-3 py-2 text-sm text-amber-700 border-t border-gray-100">Extra {formatInr(plan.extra)} will stay as vendor credit.</p>}
      </div>
    </div>
  );
}

// ───────── tab 3: pay bills (one payment per vendor) ─────────
function PayMany({ vendors, bills, banks, cash, reload }: { vendors: Vendor[]; bills: Bill[]; banks: any[]; cash: any[]; reload: () => void }) {
  const [filter, setFilter] = useState<'all' | 'overdue' | 'week'>('all');
  const [date, setDate] = useState(today()); const [ref, setRef] = useState(''); const [busy, setBusy] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const acct = useAccount(banks, cash);
  const vmap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);

  const groups = useMemo(() => {
    const m = new Map<string, { vendorId: string; bills: Bill[]; total: number }>();
    bills.filter(b => !b.is_void && (Number(b.total_amount) - Number(b.amount_paid || 0)) > 0.005).filter(b => {
      const due = (b.due_date || '').slice(0, 10);
      if (filter === 'overdue') return due && due < today();
      if (filter === 'week') return due && daysTo(due) <= 7;
      return true;
    }).forEach(b => { const g = m.get(b.vendor_id) || { vendorId: b.vendor_id, bills: [], total: 0 }; g.bills.push(b); g.total += paise(Number(b.total_amount) - Number(b.amount_paid || 0)); m.set(b.vendor_id, g); });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [bills, filter]);
  const chosen = groups.filter(g => on[g.vendorId]);
  const sum = chosen.reduce((s, g) => s + g.total, 0);

  const submit = async () => {
    const a = acct.parsed(); if (!a) return toast.error('Choose where the money is paid from'); if (chosen.length === 0) return toast.error('Tick at least one vendor');
    setBusy(true);
    const { error } = await supabase.rpc('fn_pay_bills', { p_items: chosen.map(g => ({ vendor_id: g.vendorId, amount: g.total / 100, bill_ids: g.bills.map(b => b.id) })), p_mode: a.mode, p_date: date, p_bank_account_id: a.bank, p_cash_account_id: a.cash, p_reference: ref || null, p_notes: 'Pay bills' });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Paid ${chosen.length} vendor(s)`); setOn({}); reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'overdue', 'week'] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-md text-sm border ${filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200'}`}>{f === 'all' ? 'All' : f === 'overdue' ? 'Overdue' : 'Due in 7 days'}</button>)}
        <div className="w-48">{acct.picker}</div><input type="date" value={date} onChange={e => setDate(e.target.value)} className={sel} /><input placeholder="Reference" value={ref} onChange={e => setRef(e.target.value)} className={sel} />
        <button onClick={submit} disabled={busy} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : `Pay ${chosen.length} vendor(s) · ${formatInr(sum)}`}</button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2"></th><th className="px-3 py-2 text-left">Vendor</th><th className={th}>Bills</th><th className={th}>To pay</th></tr></thead>
          <tbody>{groups.map(g => <tr key={g.vendorId} className="border-t border-gray-100"><td className="px-3 py-2"><input type="checkbox" checked={!!on[g.vendorId]} onChange={e => setOn({ ...on, [g.vendorId]: e.target.checked })} /></td><td className="px-3 py-2">{vLabel(vmap.get(g.vendorId))}</td><td className={th}>{g.bills.length}</td><td className={th}>{formatInr(g.total)}</td></tr>)}
            {groups.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">No open bills made in this app.</td></tr>}</tbody></table>
      </div>
      <p className="text-xs text-gray-400">One payment is made per vendor, covering that vendor’s open bills shown here. Zoho history bills are not payable here.</p>
    </div>
  );
}

// ───────── tab 4: vendor credits ─────────
function Credits({ vendors, bills, credits, reload }: { vendors: Vendor[]; bills: Bill[]; credits: any[]; reload: () => void }) {
  const [vendorId, setVendorId] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(today()); const [ref, setRef] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const vmap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);
  const create = async () => {
    const a = parseFloat(amount); if (!vendorId) return toast.error('Choose the vendor'); if (!(a > 0)) return toast.error('Enter the amount');
    setBusy(true);
    const { error } = await supabase.rpc('fn_create_vendor_credit', { p_vendor_id: vendorId, p_amount: a, p_date: date, p_reference: ref || null, p_notes: note || null });
    setBusy(false); if (error) { toast.error(error.message); return; } toast.success('Credit note recorded'); setAmount(''); setRef(''); setNote(''); reload();
  };
  const apply = async (c: any, billId: string) => {
    const bill = bills.find(b => b.id === billId); if (!bill) return;
    const amt = Math.min(Number(c.remaining), Number(bill.total_amount) - Number(bill.amount_paid || 0));
    const { error } = await supabase.rpc('fn_apply_vendor_credit', { p_credit_id: c.credit_id, p_bill_id: billId, p_amount: amt, p_date: today() });
    if (error) { toast.error(error.message); return; } toast.success(`Applied ${inr(amt)}`); reload();
  };
  const live = credits.filter(c => Number(c.remaining) > 0.005);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="font-semibold text-sm">New vendor credit note</p>
        <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={sel + ' w-full'}><option value="">Select vendor…</option>{vendors.map(v => <option key={v.id} value={v.id}>{vLabel(v)}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="0.01" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} className={sel} /><input type="date" value={date} onChange={e => setDate(e.target.value)} className={sel} /></div>
        <input placeholder="Reference (vendor's credit note no.)" value={ref} onChange={e => setRef(e.target.value)} className={sel + ' w-full'} />
        <input placeholder="Reason / note" value={note} onChange={e => setNote(e.target.value)} className={sel + ' w-full'} />
        <button onClick={create} disabled={busy} className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-md font-semibold disabled:opacity-50">Record credit note</button>
        <p className="text-xs text-gray-400">A credit note lowers what we owe once it is applied to a bill. A credit can never be used for more than its value.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <p className="px-3 py-2 text-sm font-semibold border-b border-gray-100">Credits available</p>
        {live.length === 0 ? <p className="p-4 text-sm text-gray-400">No credits available.</p> : live.map(c => {
          const open = bills.filter(b => b.vendor_id === c.vendor_id && !b.is_void && Number(b.total_amount) - Number(b.amount_paid || 0) > 0.005);
          return (<div key={c.credit_id} className="p-3 border-t border-gray-100 text-sm">
            <p className="font-semibold">{vLabel(vmap.get(c.vendor_id))} — {inr(Number(c.remaining))} left <span className="text-xs font-normal text-gray-400">({c.kind === 'overpayment' ? 'extra paid' : 'credit note'}, {c.credit_date})</span></p>
            {open.length === 0 ? <p className="text-xs text-gray-400">No open bill to apply it to.</p> : (
              <select defaultValue="" onChange={e => { if (e.target.value) apply(c, e.target.value); e.target.value = ''; }} className={sel + ' mt-1'}>
                <option value="">Apply to bill…</option>{open.map(b => <option key={b.id} value={b.id}>{b.vendor_bill_number || b.bill_number} — {inr(Number(b.total_amount) - Number(b.amount_paid || 0))} open</option>)}</select>)}
          </div>); })}
      </div>
    </div>
  );
}

export default function PurchasesNewPage() { return (<AdminOnlyGate><Inner /></AdminOnlyGate>); }
