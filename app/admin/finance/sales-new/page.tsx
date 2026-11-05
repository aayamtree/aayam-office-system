'use client';

/**
 * Trial: Sales (new) — checklist 2.6 to 2.10.
 *  - All sales: one list (invoices from this app + Zoho history, payments, advances)
 *  - Who owes us: receivables with ageing, advances netted off, no double count with Zoho
 *  - Customers: open balance, overdue, advance credit, default terms, statement, CSV import/export
 *  - Quotations: date presets, Expired, Invoiced / Partly invoiced, CSV
 * Read-only apart from customer default terms and the customer CSV import.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Loader2, Plus, Printer, Upload } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import { loadFiscalStartMonth, loadFinanceSettings, DEFAULT_FINANCE_SETTINGS, FinanceSettings } from '@/lib/finance-settings';
import { DATE_PRESET_LABELS, DatePreset, buildCsv, formatInr, paise, presetRange } from '@/lib/invoice-list-tools';

// ───────── types ─────────
type SaleRow = {
  key: string; type: 'Invoice' | 'Payment' | 'Advance'; source: 'App' | 'Zoho history';
  number: string; date: string; due: string; customer: string; clientId: string | null;
  total: number; balance: number; status: string; link?: string;
};
type Client = { id: string; name: string | null; company: string | null; email: string | null; phone: string | null; gstin: string | null; city: string | null; state: string | null; zoho_customer_name: string | null; default_terms_days: number | null };

const today = () => new Date().toISOString().slice(0, 10);
const canon = (s: string | null | undefined) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const cName = (c: Client) => c.company || c.name || '';
const inr = (n: number) => formatInr(paise(n));
const daysBetween = (a: string, b: string) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

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

const statusOf = (balance: number, due: string, voided: boolean, draft = false) =>
  voided ? 'Voided' : draft ? 'Draft' : balance <= 0.005 ? 'Paid' : due && due < today() ? 'Overdue' : 'Not due yet';
const statusCls = (s: string) =>
  s === 'Paid' || s === 'Closed' ? 'bg-green-100 text-green-800' : s === 'Overdue' ? 'bg-red-100 text-red-700'
  : s === 'Not due yet' ? 'bg-blue-100 text-blue-800' : s === 'Unapplied' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600';

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function printHtml(title: string, bodyHtml: string) {
  const w = window.open('', '_blank'); if (!w) { toast.error('Allow pop-ups to print'); return; }
  w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}td.r,th.r{text-align:right}h2{margin:0 0 4px}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close(); w.focus(); w.print();
}
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

// ───────── page ─────────
function Inner() {
  const [tab, setTab] = useState<'all' | 'owe' | 'cust' | 'quote'>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fin, setFin] = useState<FinanceSettings>(DEFAULT_FINANCE_SETTINGS);
  const [fyMonth, setFyMonth] = useState(4);

  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [advLeft, setAdvLeft] = useState<Record<string, number>>({}); // canon customer -> unapplied advance
  const [quotes, setQuotes] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [s, m] = await Promise.all([loadFinanceSettings(), loadFiscalStartMonth()]);
      setFin(s); setFyMonth(m);
      const [cl, zoho, inv, pay, apps, qs, qinv] = await Promise.all([
        fetchAll((a, b) => supabase.from('clients').select('id, name, company, email, phone, gstin, city, state, zoho_customer_name, default_terms_days').range(a, b)),
        fetchAll((a, b) => supabase.from('zoho_documents').select('doc_number, customer_name, doc_date, due_date, status, total, balance').eq('doc_type', 'invoice').range(a, b)),
        fetchAll((a, b) => supabase.from('invoices').select('id, invoice_number, client_id, invoice_date, due_date, total_amount, balance_due, payment_status, is_void').range(a, b)),
        fetchAll((a, b) => supabase.from('payments_received').select('id, payment_number, client_id, invoice_id, amount, payment_date, source').range(a, b)),
        fetchAll((a, b) => supabase.from('advance_applications').select('payment_id, amount').range(a, b)),
        fetchAll((a, b) => supabase.from('quotations').select('id, quote_number, client_id, created_at, valid_until, total_amount, status, client:clients(company, name)').range(a, b)),
        fetchAll((a, b) => supabase.from('v_quotation_invoicing').select('quotation_id, invoicing_status').range(a, b)),
      ]);
      const cls = cl as Client[];
      setClients(cls);
      const byId = new Map(cls.map(c => [c.id, c]));
      const out: SaleRow[] = [];

      const appNumbers = new Set<string>();
      for (const i of inv) {
        appNumbers.add(String(i.invoice_number));
        const c = byId.get(i.client_id);
        const bal = i.is_void ? 0 : Number(i.balance_due) || 0;
        const due = (i.due_date || '').slice(0, 10);
        out.push({
          key: 'a' + i.id, type: 'Invoice', source: 'App', number: i.invoice_number, date: (i.invoice_date || '').slice(0, 10), due,
          customer: c ? cName(c) : '', clientId: i.client_id, total: i.is_void ? 0 : Number(i.total_amount) || 0, balance: bal,
          status: statusOf(bal, due, !!i.is_void, i.payment_status === 'draft'), link: `/admin/finance/invoices-new?open=${i.id}`,
        });
      }
      for (const z of zoho) {
        if (appNumbers.has(String(z.doc_number))) continue; // never count an invoice twice
        const voided = z.status === 'void', draft = z.status === 'draft';
        const bal = voided || draft ? 0 : Number(z.balance) || 0;
        const due = (z.due_date || '').slice(0, 10);
        out.push({
          key: 'z' + z.doc_number + z.doc_date, type: 'Invoice', source: 'Zoho history', number: String(z.doc_number), date: (z.doc_date || '').slice(0, 10), due,
          customer: z.customer_name || '', clientId: null, total: voided ? 0 : Number(z.total) || 0, balance: draft ? Number(z.balance) || 0 : bal,
          status: statusOf(draft ? 0 : bal, due, voided, draft),
        });
      }
      const usedBy: Record<string, number> = {};
      apps.forEach((a: any) => { usedBy[a.payment_id] = (usedBy[a.payment_id] || 0) + Number(a.amount); });
      const adv: Record<string, number> = {};
      for (const p of pay) {
        const c = byId.get(p.client_id);
        const isAdv = p.source === 'advance';
        const left = isAdv ? Math.max(0, Number(p.amount) - (usedBy[p.id] || 0)) : p.invoice_id ? 0 : Number(p.amount);
        if (isAdv && c && left > 0.005) { const k = canon(c.zoho_customer_name || cName(c)); adv[k] = (adv[k] || 0) + left; }
        out.push({
          key: 'p' + p.id, type: isAdv ? 'Advance' : 'Payment', source: 'App', number: p.payment_number || '', date: (p.payment_date || '').slice(0, 10), due: '',
          customer: c ? cName(c) : '', clientId: p.client_id, total: Number(p.amount) || 0, balance: left, status: left > 0.005 ? 'Unapplied' : 'Closed',
          link: isAdv && left > 0.005 ? '/admin/finance/invoices-new' : undefined,
        });
      }
      setAdvLeft(adv);
      setRows(out);
      const qiMap = new Map(qinv.map((r: any) => [r.quotation_id, r.invoicing_status]));
      setQuotes(qs.map((q: any) => ({ ...q, invStatus: qiMap.get(q.id) || 'not_invoiced' })));
    } catch (e: any) {
      setErr(e.message || 'Could not load');
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Sales (new)</h1>
          <p className="text-sm text-gray-500">Invoices from this app and Zoho history in one place. Zoho history is read-only; each invoice is counted once.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/invoices-new" className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold"><Plus size={15} /> New invoice</Link>
          <Link href="/admin/finance/receive-money" className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-semibold">Receive money</Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['all', 'All sales'], ['owe', 'Who owes us'], ['cust', 'Customers'], ['quote', 'Quotations']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{l}</button>
        ))}
      </div>

      {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{err}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : (
        <>
          {tab === 'all' && <AllSales rows={rows} fyMonth={fyMonth} />}
          {tab === 'owe' && <WhoOwes rows={rows} advLeft={advLeft} />}
          {tab === 'cust' && <Customers clients={clients} rows={rows} advLeft={advLeft} fin={fin} reload={load} />}
          {tab === 'quote' && <Quotations quotes={quotes} fyMonth={fyMonth} />}
        </>
      )}
    </div>
  );
}

// ───────── tab 1: all sales ─────────
function AllSales({ rows, fyMonth }: { rows: SaleRow[]; fyMonth: number }) {
  const [preset, setPreset] = useState<DatePreset>('this_fy');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [type, setType] = useState('all'); const [status, setStatus] = useState('all'); const [src, setSrc] = useState('all'); const [q, setQ] = useState('');
  const range = presetRange(preset, new Date(), fyMonth, from, to);

  const list = useMemo(() => rows.filter(r => {
    if (range && (r.date < range.from || r.date > range.to)) return false;
    if (type !== 'all' && r.type !== type) return false;
    if (status !== 'all' && r.status !== status) return false;
    if (src !== 'all' && r.source !== src) return false;
    const s = q.trim().toLowerCase();
    return !s || r.number.toLowerCase().includes(s) || r.customer.toLowerCase().includes(s);
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [rows, range, type, status, src, q]);

  const invs = rows.filter(r => r.type === 'Invoice');
  const overdue = invs.filter(r => r.status === 'Overdue').reduce((s, r) => s + paise(r.balance), 0);
  const notDue = invs.filter(r => r.status === 'Not due yet').reduce((s, r) => s + paise(r.balance), 0);
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const recv30 = rows.filter(r => (r.type === 'Payment' || r.type === 'Advance') && r.date >= d30).reduce((s, r) => s + paise(r.total), 0);
  const totalP = list.reduce((s, r) => s + paise(r.total), 0), balP = list.reduce((s, r) => s + paise(r.balance), 0);

  const exportCsv = () => download('all-sales.csv', buildCsv(['Date', 'Type', 'Source', 'Number', 'Customer', 'Due', 'Total', 'Balance', 'Status'],
    list.map(r => [r.date, r.type, r.source, r.number, r.customer, r.due, r.total, r.balance, r.status])));
  const print = () => printHtml('All sales', `<h2>All sales</h2><table><tr><th>Date</th><th>Type</th><th>Number</th><th>Customer</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th></tr>${list.map(r => `<tr><td>${r.date}</td><td>${r.type}</td><td>${esc(r.number)}</td><td>${esc(r.customer)}</td><td class="r">${inr(r.total)}</td><td class="r">${inr(r.balance)}</td><td>${r.status}</td></tr>`).join('')}<tr><th colspan="4">${list.length} rows</th><th class="r">${formatInr(totalP)}</th><th class="r">${formatInr(balP)}</th><th></th></tr></table>`);
  const sel = 'px-2 py-2 border border-gray-200 rounded-md text-sm bg-white';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3"><p className="text-xs text-gray-500">Unpaid</p><p className="font-bold">{formatInr(overdue + notDue)}</p><p className="text-xs text-gray-500">{formatInr(overdue)} overdue · {formatInr(notDue)} not due yet</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-3"><p className="text-xs text-gray-500">Received in last 30 days (recorded in this app)</p><p className="font-bold">{formatInr(recv30)}</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-3"><p className="text-xs text-gray-500">Zoho history</p><p className="text-xs text-gray-600 mt-1">Old invoices show here too, marked “Zoho history”. They are read-only.</p></div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select className={sel} value={preset} onChange={e => setPreset(e.target.value as DatePreset)}>{(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(k => <option key={k} value={k}>{DATE_PRESET_LABELS[k]}</option>)}</select>
        {preset === 'custom' && (<><input type="date" className={sel} value={from} onChange={e => setFrom(e.target.value)} /><input type="date" className={sel} value={to} onChange={e => setTo(e.target.value)} /></>)}
        <select className={sel} value={type} onChange={e => setType(e.target.value)}><option value="all">All types</option><option>Invoice</option><option>Payment</option><option>Advance</option></select>
        <select className={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All status</option>{['Paid', 'Overdue', 'Not due yet', 'Draft', 'Voided', 'Unapplied', 'Closed'].map(s => <option key={s}>{s}</option>)}</select>
        <select className={sel} value={src} onChange={e => setSrc(e.target.value)}><option value="all">App + Zoho history</option><option>App</option><option>Zoho history</option></select>
        <input className={sel + ' flex-1 min-w-[140px]'} placeholder="Search number or customer" value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={exportCsv} className={sel + ' inline-flex items-center gap-1'}><Download size={14} /> CSV</button>
        <button onClick={print} className={sel + ' inline-flex items-center gap-1'}><Printer size={14} /> Print</button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase"><tr>
            <th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Number</th><th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {list.slice(0, 500).map(r => (
              <tr key={r.key} className="border-t border-gray-100">
                <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2">{r.type}{r.source === 'Zoho history' && <span className="ml-1 text-[10px] text-gray-400">Zoho</span>}</td>
                <td className="px-3 py-2">{r.number}</td><td className="px-3 py-2">{r.customer}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.due}</td>
                <td className="px-3 py-2 text-right">{inr(r.total)}</td><td className="px-3 py-2 text-right">{inr(r.balance)}</td>
                <td className="px-3 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls(r.status)}`}>{r.status}</span></td>
                <td className="px-3 py-2">{r.link && <Link href={r.link} className="text-blue-600 text-xs font-semibold">{r.type === 'Invoice' ? (r.balance > 0 ? 'Record payment' : 'View') : 'Apply'}</Link>}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-gray-400">Nothing matches.</td></tr>}
          </tbody>
          <tfoot><tr className="border-t-2 border-gray-200 font-semibold"><td className="px-3 py-2" colSpan={5}>{list.length} rows{list.length > 500 ? ' (first 500 shown; totals cover all)' : ''}</td><td className="px-3 py-2 text-right">{formatInr(totalP)}</td><td className="px-3 py-2 text-right">{formatInr(balP)}</td><td colSpan={2}></td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ───────── tab 2: who owes us ─────────
function WhoOwes({ rows, advLeft }: { rows: SaleRow[]; advLeft: Record<string, number> }) {
  const data = useMemo(() => {
    const t = today();
    const m = new Map<string, { name: string; cur: number; b1: number; b2: number; b3: number; b4: number; invoices: number }>();
    rows.filter(r => r.type === 'Invoice' && r.balance > 0.005 && (r.status === 'Overdue' || r.status === 'Not due yet')).forEach(r => {
      const k = canon(r.customer) || 'unknown';
      const g = m.get(k) || { name: r.customer || 'Unknown customer', cur: 0, b1: 0, b2: 0, b3: 0, b4: 0, invoices: 0 };
      const late = r.due ? daysBetween(t, r.due) : 0; const p = paise(r.balance);
      if (late <= 0) g.cur += p; else if (late <= 30) g.b1 += p; else if (late <= 60) g.b2 += p; else if (late <= 90) g.b3 += p; else g.b4 += p;
      g.invoices += 1; m.set(k, g);
    });
    const list = Array.from(m.entries()).map(([k, g]) => {
      const owed = g.cur + g.b1 + g.b2 + g.b3 + g.b4; const credit = paise(advLeft[k] || 0);
      return { ...g, owed, credit, net: owed - credit };
    }).sort((a, b) => b.net - a.net);
    // advances held for customers who owe nothing still show, as a credit
    Object.keys(advLeft).forEach(k => { if (!m.has(k)) list.push({ name: k, cur: 0, b1: 0, b2: 0, b3: 0, b4: 0, invoices: 0, owed: 0, credit: paise(advLeft[k]), net: -paise(advLeft[k]) }); });
    return list;
  }, [rows, advLeft]);

  const tot = (f: (r: typeof data[number]) => number) => data.reduce((s, r) => s + f(r), 0);
  const exportCsv = () => download('who-owes-us.csv', buildCsv(['Customer', 'Invoices', 'Not due', '1-30', '31-60', '61-90', '90+', 'Owed', 'Advance credit', 'Net'],
    data.map(r => [r.name, r.invoices, r.cur / 100, r.b1 / 100, r.b2 / 100, r.b3 / 100, r.b4 / 100, r.owed / 100, r.credit / 100, r.net / 100])));
  const th = 'px-3 py-2 text-right';
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <p className="text-sm text-gray-500">Open invoices from this app and Zoho history, aged by days past the due date. Advances held for a customer are taken off what they owe.</p>
        <button onClick={exportCsv} className="px-2 py-2 border border-gray-200 rounded-md text-sm bg-white inline-flex items-center gap-1"><Download size={14} /> CSV</button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2 text-left">Customer</th><th className={th}>Inv</th><th className={th}>Not due</th><th className={th}>1–30</th><th className={th}>31–60</th><th className={th}>61–90</th><th className={th}>90+</th><th className={th}>Owed</th><th className={th}>Advance</th><th className={th}>Net</th></tr></thead>
          <tbody>{data.map(r => (
            <tr key={r.name} className="border-t border-gray-100"><td className="px-3 py-2">{r.name}</td><td className={th}>{r.invoices}</td>
              {[r.cur, r.b1, r.b2, r.b3, r.b4].map((v, i) => <td key={i} className={th + (i >= 3 && v ? ' text-red-600' : '')}>{v ? formatInr(v) : ''}</td>)}
              <td className={th}>{formatInr(r.owed)}</td><td className={th}>{r.credit ? '−' + formatInr(r.credit) : ''}</td><td className={th + ' font-semibold'}>{formatInr(r.net)}</td></tr>))}
            {data.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-gray-400">Nobody owes anything.</td></tr>}</tbody>
          <tfoot><tr className="border-t-2 border-gray-200 font-semibold"><td className="px-3 py-2">Total</td><td className={th}>{tot(r => r.invoices)}</td>
            <td className={th}>{formatInr(tot(r => r.cur))}</td><td className={th}>{formatInr(tot(r => r.b1))}</td><td className={th}>{formatInr(tot(r => r.b2))}</td><td className={th}>{formatInr(tot(r => r.b3))}</td><td className={th}>{formatInr(tot(r => r.b4))}</td>
            <td className={th}>{formatInr(tot(r => r.owed))}</td><td className={th}>−{formatInr(tot(r => r.credit))}</td><td className={th}>{formatInr(tot(r => r.net))}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ───────── tab 3: customers ─────────
function Customers({ clients, rows, advLeft, fin, reload }: { clients: Client[]; rows: SaleRow[]; advLeft: Record<string, number>; fin: FinanceSettings; reload: () => void }) {
  const [q, setQ] = useState('');
  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null);

  const stats = useMemo(() => clients.map(c => {
    const keys = new Set([canon(cName(c)), canon(c.zoho_customer_name)].filter(Boolean));
    const mine = rows.filter(r => r.type === 'Invoice' && r.balance > 0.005 && (r.status === 'Overdue' || r.status === 'Not due yet') && (r.clientId === c.id || keys.has(canon(r.customer))));
    const open = mine.reduce((s, r) => s + paise(r.balance), 0);
    const over = mine.filter(r => r.status === 'Overdue').length;
    const adv = paise(advLeft[canon(c.zoho_customer_name || cName(c))] || 0);
    return { c, openCount: mine.length, over, open, adv };
  }).filter(x => !q.trim() || (cName(x.c) + ' ' + (x.c.name || '')).toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => b.open - a.open), [clients, rows, advLeft, q]);

  const exportCsv = () => download('customers.csv', buildCsv(['Company', 'Name', 'Email', 'Phone', 'GSTIN', 'City', 'State', 'Default terms (days)', 'Open invoices', 'Overdue', 'Open balance', 'Advance credit'],
    stats.map(x => [x.c.company || '', x.c.name || '', x.c.email || '', x.c.phone || '', x.c.gstin || '', x.c.city || '', x.c.state || '', x.c.default_terms_days ?? '', x.openCount, x.over, x.open / 100, x.adv / 100])));

  const setTerms = async (id: string, v: string) => {
    const days = v === '' ? null : Number(v);
    const { error } = await supabase.from('clients').update({ default_terms_days: days }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Saved'); reload(); }
  };

  const statement = (x: typeof stats[number]) => {
    const keys = new Set([canon(cName(x.c)), canon(x.c.zoho_customer_name)].filter(Boolean));
    const mine = rows.filter(r => (r.clientId === x.c.id || keys.has(canon(r.customer))) && r.status !== 'Voided' && r.status !== 'Draft').sort((a, b) => a.date.localeCompare(b.date));
    const open = mine.filter(r => r.type === 'Invoice' && r.balance > 0.005);
    printHtml('Statement', `<h2>Statement — ${esc(cName(x.c))}</h2><p>As on ${today()}</p>
      <table><tr><th>Date</th><th>Type</th><th>Number</th><th>Due</th><th class="r">Amount</th><th class="r">Balance</th></tr>
      ${mine.map(r => `<tr><td>${r.date}</td><td>${r.type}</td><td>${esc(r.number)}</td><td>${r.due}</td><td class="r">${inr(r.total)}</td><td class="r">${inr(r.balance)}</td></tr>`).join('')}</table>
      <p><b>Open invoices: ${open.length} · Total owed: ${formatInr(x.open)}${x.adv ? ' · Advance held: ' + formatInr(x.adv) + ' · Net: ' + formatInr(x.open - x.adv) : ''}</b></p>
      <p><b>Closing balance: ${formatInr(x.open - x.adv)}</b></p>`);
  };

  // CSV import: only adds NEW customers; a company name already present is skipped
  const onFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    const parse = (l: string) => { const out: string[] = []; let cur = '', qt = false; for (const ch of l) { if (ch === '"') qt = !qt; else if (ch === ',' && !qt) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
    if (lines.length < 2) { toast.error('The file has no rows'); return; }
    const head = parse(lines[0]).map(h => h.toLowerCase());
    setImportRows(lines.slice(1).map(l => { const v = parse(l); const o: Record<string, string> = {}; head.forEach((h, i) => { o[h] = v[i] || ''; }); return o; }));
  };
  const existing = useMemo(() => new Set(clients.map(c => canon(cName(c)))), [clients]);
  const toAdd = (importRows || []).filter(r => (r.company || r.name) && !existing.has(canon(r.company || r.name)));
  const doImport = async () => {
    if (!importRows) return;
    const { data: { user } } = await supabase.auth.getUser();
    const payload = toAdd.map(r => ({ company: r.company || r.name, name: r.name || r.company, email: r.email || null, phone: r.phone || null, gstin: r.gstin || null, city: r.city || null, state: r.state || null, is_active: true, created_by: user?.id }));
    if (payload.length === 0) { toast.error('Nothing new to add'); return; }
    const { error } = await supabase.from('clients').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${payload.length} customers`); setImportRows(null); reload();
  };

  const sel = 'px-2 py-2 border border-gray-200 rounded-md text-sm bg-white';
  const th = 'px-3 py-2 text-right';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input className={sel + ' flex-1 min-w-[160px]'} placeholder="Search customer" value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={exportCsv} className={sel + ' inline-flex items-center gap-1'}><Download size={14} /> Export CSV</button>
        <label className={sel + ' inline-flex items-center gap-1 cursor-pointer'}><Upload size={14} /> Import CSV<input type="file" accept=".csv" className="hidden" onChange={e => { onFile(e.target.files?.[0] || null); e.target.value = ''; }} /></label>
      </div>
      {importRows && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm space-y-2">
          <p><b>Import preview:</b> {importRows.length} rows in the file · <b>{toAdd.length} new</b> · {importRows.length - toAdd.length} skipped (already a customer, or no name). Columns used: company, name, email, phone, gstin, city, state.</p>
          <div className="flex gap-2"><button onClick={doImport} className="px-3 py-1.5 bg-gray-900 text-white rounded-md font-semibold">Add {toAdd.length} customers</button><button onClick={() => setImportRows(null)} className="px-3 py-1.5 border border-gray-300 rounded-md">Cancel</button></div>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2 text-left">Customer</th><th className={th}>Open inv</th><th className={th}>Overdue</th><th className={th}>Open balance</th><th className={th}>Advance credit</th><th className="px-3 py-2 text-left">Default terms</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>{stats.map(x => (
            <tr key={x.c.id} className="border-t border-gray-100">
              <td className="px-3 py-2">{cName(x.c)}<span className="text-xs text-gray-400"> {x.c.name && x.c.company ? `(${x.c.name})` : ''}</span></td>
              <td className={th}>{x.openCount || ''}</td><td className={th + (x.over ? ' text-red-600' : '')}>{x.over || ''}</td>
              <td className={th}>{x.open ? formatInr(x.open) : ''}</td><td className={th}>{x.adv ? formatInr(x.adv) : ''}</td>
              <td className="px-3 py-2">
                <select value={x.c.default_terms_days ?? ''} onChange={e => setTerms(x.c.id, e.target.value)} className="px-1 py-1 border border-gray-200 rounded text-xs bg-white">
                  <option value="">—</option>
                  {Array.from(new Set([...(fin.paymentTerms || []).map(t => t.days), x.c.default_terms_days ?? -1].filter(d => d >= 0))).sort((a, b) => a - b).map(d => <option key={d} value={d}>{d === 0 ? 'Due on receipt' : `Net ${d}`}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 whitespace-nowrap space-x-2">
                <Link href={`/admin/finance/invoices-new?newFor=${x.c.id}`} className="text-blue-600 text-xs font-semibold">Create invoice</Link>
                <button onClick={() => statement(x)} className="text-gray-600 text-xs font-semibold">Statement</button>
              </td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ───────── tab 4: quotations ─────────
function Quotations({ quotes, fyMonth }: { quotes: any[]; fyMonth: number }) {
  const [preset, setPreset] = useState<DatePreset>('this_fy');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [status, setStatus] = useState('all'); const [q, setQ] = useState('');
  const range = presetRange(preset, new Date(), fyMonth, from, to);
  const eff = (x: any): string => {
    if (x.invStatus === 'fully_invoiced') return 'Invoiced';
    if (x.invStatus === 'partly_invoiced') return 'Partly invoiced';
    if (x.valid_until && x.valid_until < today() && x.status !== 'declined' && x.status !== 'rejected') return 'Expired';
    return (x.status || 'draft').replace(/^./, (c: string) => c.toUpperCase());
  };
  const list = quotes.map(x => ({ ...x, eff: eff(x), date: (x.created_at || '').slice(0, 10) })).filter(x => {
    if (range && (x.date < range.from || x.date > range.to)) return false;
    if (status !== 'all' && x.eff !== status) return false;
    const s = q.trim().toLowerCase();
    return !s || (x.quote_number || '').toLowerCase().includes(s) || (x.client?.company || x.client?.name || '').toLowerCase().includes(s);
  }).sort((a, b) => b.date.localeCompare(a.date));
  const totalP = list.reduce((s, x) => s + paise(x.total_amount), 0);
  const sel = 'px-2 py-2 border border-gray-200 rounded-md text-sm bg-white';
  const cls = (s: string) => s === 'Invoiced' ? 'bg-green-100 text-green-800' : s === 'Partly invoiced' ? 'bg-amber-100 text-amber-800' : s === 'Expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
  const exportCsv = () => download('quotations.csv', buildCsv(['Date', 'Number', 'Customer', 'Valid until', 'Amount', 'Status'], list.map(x => [x.date, x.quote_number, x.client?.company || x.client?.name || '', x.valid_until || '', x.total_amount, x.eff])));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select className={sel} value={preset} onChange={e => setPreset(e.target.value as DatePreset)}>{(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(k => <option key={k} value={k}>{DATE_PRESET_LABELS[k]}</option>)}</select>
        {preset === 'custom' && (<><input type="date" className={sel} value={from} onChange={e => setFrom(e.target.value)} /><input type="date" className={sel} value={to} onChange={e => setTo(e.target.value)} /></>)}
        <select className={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All status</option>{['Draft', 'Sent', 'Accepted', 'Expired', 'Partly invoiced', 'Invoiced'].map(s => <option key={s}>{s}</option>)}</select>
        <input className={sel + ' flex-1 min-w-[140px]'} placeholder="Search number or customer" value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={exportCsv} className={sel + ' inline-flex items-center gap-1'}><Download size={14} /> CSV</button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Number</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Valid until</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>{list.map(x => (<tr key={x.id} className="border-t border-gray-100"><td className="px-3 py-2">{x.date}</td><td className="px-3 py-2">{x.quote_number}</td><td className="px-3 py-2">{x.client?.company || x.client?.name || ''}</td><td className="px-3 py-2">{x.valid_until || ''}</td><td className="px-3 py-2 text-right">{inr(x.total_amount)}</td><td className="px-3 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls(x.eff)}`}>{x.eff}</span></td></tr>))}
            {list.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">Nothing matches.</td></tr>}</tbody>
          <tfoot><tr className="border-t-2 border-gray-200 font-semibold"><td className="px-3 py-2" colSpan={4}>{list.length} quotations</td><td className="px-3 py-2 text-right">{formatInr(totalP)}</td><td></td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

export default function SalesNewPage() {
  return (<AdminOnlyGate><Inner /></AdminOnlyGate>);
}
