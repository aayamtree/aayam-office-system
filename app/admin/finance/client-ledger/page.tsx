'use client';

// CLIENT LEDGER — one client at a time: their orders, what they have paid, and
// their invoices. Read-only. Admin and finance only, because it shows amounts.
//
// How the numbers are built (kept honest on purpose):
//   Orders   = jobs of this client (stock batches are not orders, so left out).
//   Received = bank receipts in payments_received. Cash / UPI are NOT recorded as
//              money in this system, so they are shown as notes only and never
//              counted. That is why Pending can read higher than the real figure
//              for clients who pay in cash or UPI.
//   Pending  = order amount - bank received, never shown below zero.
//   Many older orders have no amount entered. We count them and say so, because a
//   Pending figure that silently ignores them reads as reassurance.
//   Invoices = Zoho invoices for this client (matched by the Zoho customer name on
//              the client) plus any invoice made inside this app.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { BookUser, Loader2, Search, AlertTriangle, Lock } from 'lucide-react';

type ClientRow = { id: string; name: string | null; company: string | null; zoho_customer_name: string | null };
type JobLite = { client_id: string | null; total_amount: number | null };
type PayLite = { client_id: string | null; amount: number | null };

type Order = {
  id: string; job_number: string; project_name: string | null; product: string;
  date: string; amount: number; stage: string | null;
};
type Payment = {
  id: string; date: string | null; amount: number | null; kind: 'Bank' | 'UPI' | 'Cash' | 'Other';
  counted: boolean; note: string; ref: string;
};
type Invoice = {
  id: string; number: string; date: string | null; total: number; balance: number; status: string; source: 'Zoho' | 'App';
};

type View = 'date' | 'year' | 'product';

const inr = (n: number) => '₹ ' + Math.round(n || 0).toLocaleString('en-IN');
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const yearOf = (d: string) => (d ? String(new Date(d).getFullYear()) : 'No date');
const clientLabel = (c: ClientRow) => c.company || c.name || '—';

function kindOf(mode: string | null | undefined): Payment['kind'] {
  const m = (mode || '').toLowerCase();
  if (m.includes('upi')) return 'UPI';
  if (m.includes('cash')) return 'Cash';
  if (m.includes('bank') || m.includes('neft') || m.includes('rtgs') || m.includes('imps') || m.includes('cheque')) return 'Bank';
  return 'Other';
}

export default function ClientLedgerPage() {
  const { hasRole, loading: authLoading } = useAuth();
  const allowed = hasRole(['admin', 'finance']);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [allJobs, setAllJobs] = useState<JobLite[]>([]);
  const [allPays, setAllPays] = useState<PayLite[]>([]);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);

  const [loadingClient, setLoadingClient] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [noAmountCount, setNoAmountCount] = useState(0);

  const [view, setView] = useState<View>('date');
  const [fYear, setFYear] = useState('');
  const [fProd, setFProd] = useState('');
  const [fText, setFText] = useState('');

  // ---- first load: client list + light totals for the picker -------------
  useEffect(() => {
    if (authLoading || !allowed) return;
    (async () => {
      try {
        const [c, j, p] = await Promise.all([
          supabase.from('clients').select('id, name, company, zoho_customer_name').eq('is_active', true).order('company', { ascending: true }).range(0, 4999),
          supabase.from('jobs').select('client_id, total_amount').eq('is_stock', false).range(0, 9999),
          supabase.from('payments_received').select('client_id, amount').range(0, 9999),
        ]);
        if (c.error) throw c.error;
        if (j.error) throw j.error;
        if (p.error) throw p.error;
        setClients((c.data || []) as ClientRow[]);
        setAllJobs((j.data || []) as JobLite[]);
        setAllPays((p.data || []) as PayLite[]);
      } catch (e: any) {
        setError(e?.message || 'Could not load clients');
      } finally {
        setBooting(false);
      }
    })();
  }, [authLoading, allowed]);

  // ---- pending per client, for the picker list ---------------------------
  const pendingByClient = useMemo(() => {
    const ordered: Record<string, number> = {};
    const paid: Record<string, number> = {};
    allJobs.forEach(j => { if (j.client_id) ordered[j.client_id] = (ordered[j.client_id] || 0) + (Number(j.total_amount) || 0); });
    allPays.forEach(p => { if (p.client_id) paid[p.client_id] = (paid[p.client_id] || 0) + (Number(p.amount) || 0); });
    const out: Record<string, number> = {};
    clients.forEach(c => { out[c.id] = Math.max(0, (ordered[c.id] || 0) - (paid[c.id] || 0)); });
    return out;
  }, [allJobs, allPays, clients]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clients.filter(c => !q || `${c.company || ''} ${c.name || ''}`.toLowerCase().includes(q));
    return list.sort((a, b) => (pendingByClient[b.id] || 0) - (pendingByClient[a.id] || 0) || clientLabel(a).localeCompare(clientLabel(b)));
  }, [clients, search, pendingByClient]);

  const client = useMemo(() => clients.find(c => c.id === clientId) || null, [clients, clientId]);

  // ---- load one client's ledger ------------------------------------------
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      setLoadingClient(true);
      setError(null);
      setFYear(''); setFProd(''); setFText(''); setView('date');
      try {
        const zohoName = client.zoho_customer_name;
        const [jobsRes, payRes, capRes, invRes, zohoRes] = await Promise.all([
          supabase.from('jobs')
            .select('id, job_number, project_name, product_category, order_date, created_at, total_amount, current_stage')
            .eq('client_id', client.id).eq('is_stock', false).range(0, 4999),
          supabase.from('payments_received')
            .select('id, payment_number, amount, payment_mode, payment_date, reference_number, notes')
            .eq('client_id', client.id),
          supabase.from('payment_captures')
            .select('id, amount, payment_method, txn_date, created_at, notes, transfer_note, status, direction')
            .eq('client_id', client.id).neq('status', 'rejected'),
          supabase.from('invoices')
            .select('id, invoice_number, invoice_date, total_amount, balance_due, payment_status')
            .eq('client_id', client.id),
          zohoName
            ? supabase.from('zoho_documents')
                .select('id, doc_number, doc_date, total, balance, status')
                .eq('doc_type', 'invoice').eq('customer_name', zohoName)
                .not('status', 'in', '(void,draft)').range(0, 4999)
            : Promise.resolve({ data: [], error: null } as any),
        ]);
        for (const r of [jobsRes, payRes, capRes, invRes, zohoRes] as any[]) if (r.error) throw r.error;
        if (cancelled) return;

        const jobRows = (jobsRes.data || []) as any[];
        setNoAmountCount(jobRows.filter(j => !(Number(j.total_amount) > 0)).length);
        setOrders(jobRows.map(j => ({
          id: j.id,
          job_number: j.job_number,
          project_name: j.project_name,
          product: j.product_category || 'Not set',
          date: j.order_date || j.created_at,
          amount: Number(j.total_amount) || 0,
          stage: j.current_stage,
        })));

        const pays: Payment[] = [];
        ((payRes.data || []) as any[]).forEach(p => pays.push({
          id: 'p' + p.id, date: p.payment_date, amount: Number(p.amount) || 0,
          kind: kindOf(p.payment_mode) === 'Other' ? 'Bank' : kindOf(p.payment_mode),
          counted: true, note: p.notes || '', ref: p.reference_number || p.payment_number || '',
        }));
        // Telegram payment screenshots: shown as notes, never added to the totals
        // (they are an inbox, not a ledger, and a bank one may already be in the list above).
        ((capRes.data || []) as any[]).filter(c => c.direction !== 'out').forEach(c => pays.push({
          id: 'c' + c.id, date: c.txn_date || c.created_at, amount: c.amount != null ? Number(c.amount) : null,
          kind: kindOf(c.payment_method), counted: false,
          note: [c.notes, c.transfer_note].filter(Boolean).join(' · ') || 'Payment screenshot from Telegram',
          ref: '',
        }));
        pays.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setPayments(pays);

        const invs: Invoice[] = [];
        ((zohoRes.data || []) as any[]).forEach(d => invs.push({
          id: 'z' + d.id, number: d.doc_number, date: d.doc_date, total: Number(d.total) || 0,
          balance: Number(d.balance) || 0, status: d.status, source: 'Zoho',
        }));
        ((invRes.data || []) as any[]).forEach(d => invs.push({
          id: 'a' + d.id, number: d.invoice_number, date: d.invoice_date, total: Number(d.total_amount) || 0,
          balance: Number(d.balance_due) || 0, status: d.payment_status, source: 'App',
        }));
        invs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setInvoices(invs);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load this client');
      } finally {
        if (!cancelled) setLoadingClient(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client]);

  // ---- derived numbers ----------------------------------------------------
  const orderTotal = useMemo(() => orders.reduce((s, o) => s + o.amount, 0), [orders]);
  const received = useMemo(() => payments.filter(p => p.counted).reduce((s, p) => s + (p.amount || 0), 0), [payments]);
  const pending = Math.max(0, orderTotal - received);
  const credit = Math.max(0, received - orderTotal);
  const hasCashUpiNotes = payments.some(p => !p.counted && (p.kind === 'UPI' || p.kind === 'Cash'));

  const years = useMemo(() => Array.from(new Set(orders.map(o => yearOf(o.date)))).sort().reverse(), [orders]);
  const products = useMemo(() => Array.from(new Set(orders.map(o => o.product))).sort(), [orders]);

  const shownOrders = useMemo(() => {
    const q = fText.trim().toLowerCase();
    return orders
      .filter(o => (!fYear || yearOf(o.date) === fYear) && (!fProd || o.product === fProd) &&
        (!q || `${o.job_number} ${o.project_name || ''} ${o.product}`.toLowerCase().includes(q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [orders, fYear, fProd, fText]);

  const groups = useMemo(() => {
    if (view === 'date') return [];
    const key = view === 'year' ? (o: Order) => yearOf(o.date) : (o: Order) => o.product;
    const map: Record<string, Order[]> = {};
    shownOrders.forEach(o => { (map[key(o)] ||= []).push(o); });
    const keys = Object.keys(map);
    return (view === 'year' ? keys.sort().reverse() : keys.sort()).map(k => ({
      key: k, rows: map[k], total: map[k].reduce((s, o) => s + o.amount, 0),
    }));
  }, [shownOrders, view]);

  // ---- guards -------------------------------------------------------------
  if (authLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }
  if (!allowed) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <Lock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-800">Client Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">This page shows amounts, so it is open to admin and finance only.</p>
      </div>
    );
  }

  const OrderRow = ({ o }: { o: Order }) => (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-dashed last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          <span className="font-mono text-xs text-gray-600 mr-2">{o.job_number}</span>{o.project_name || '—'}
          <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{o.product}</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{fmtDate(o.date)}{o.stage ? ` · ${o.stage.replace(/_/g, ' ')}` : ''}</p>
      </div>
      {o.amount > 0
        ? <span className="text-sm font-semibold tabular-nums">{inr(o.amount)}</span>
        : <span className="text-xs text-amber-600 whitespace-nowrap">amount not entered</span>}
    </div>
  );

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BookUser className="w-5 h-5 text-indigo-600" /> Client Ledger
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Orders, payments and invoices for one client. View only.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Client picker */}
        <aside className="bg-white border rounded-lg overflow-hidden self-start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client…"
                className="w-full border rounded-md pl-8 pr-2 py-2 text-sm" />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {booting ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredClients.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No client found.</p>
            ) : filteredClients.map(c => (
              <button key={c.id} onClick={() => setClientId(c.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 ${c.id === clientId ? 'bg-indigo-50' : ''}`}>
                <span className="text-sm text-gray-900 truncate">{clientLabel(c)}</span>
                {pendingByClient[c.id] > 0 && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 whitespace-nowrap tabular-nums">
                    {inr(pendingByClient[c.id])}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Ledger */}
        <div className="space-y-4 min-w-0">
          {!client ? (
            <div className="bg-white border rounded-lg py-20 text-center text-sm text-gray-500">Choose a client on the left.</div>
          ) : loadingClient ? (
            <div className="bg-white border rounded-lg flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Client</p>
                <h2 className="text-2xl font-bold text-gray-900">{clientLabel(client)}</h2>
              </div>

              {/* 1 · Orders */}
              <section className="bg-white border rounded-lg p-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border-2 border-indigo-700 text-indigo-700 text-xs flex items-center justify-center">1</span>
                  Orders <span className="text-xs font-normal text-gray-500">{shownOrders.length} of {orders.length} · {inr(orderTotal)}</span>
                </h3>

                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {([['date', 'By Date'], ['year', 'By Year'], ['product', 'By Product']] as [View, string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setView(v)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${view === v ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-gray-800 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <select value={fYear} onChange={e => setFYear(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm flex-1 min-w-[120px]">
                    <option value="">All years</option>{years.map(y => <option key={y}>{y}</option>)}
                  </select>
                  <select value={fProd} onChange={e => setFProd(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm flex-1 min-w-[120px]">
                    <option value="">All products</option>{products.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <input value={fText} onChange={e => setFText(e.target.value)} placeholder="Search order…" className="border rounded-md px-2 py-1.5 text-sm flex-1 min-w-[120px]" />
                </div>

                <div className="mt-2">
                  {shownOrders.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">No orders found.</p>
                  ) : view === 'date' ? (
                    shownOrders.map(o => <OrderRow key={o.id} o={o} />)
                  ) : groups.map(g => (
                    <div key={g.key}>
                      <div className="flex justify-between text-sm font-bold text-indigo-700 border-b mt-3 mb-1 pb-1">
                        <span>{g.key}</span>
                        <span className="text-xs font-medium text-gray-500">{g.rows.length} orders · {inr(g.total)}</span>
                      </div>
                      {g.rows.map(o => <OrderRow key={o.id} o={o} />)}
                    </div>
                  ))}
                </div>
              </section>

              {/* 2 · Payment */}
              <section className="bg-white border rounded-lg p-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border-2 border-indigo-700 text-indigo-700 text-xs flex items-center justify-center">2</span>
                  Payment
                </h3>

                <div className="mt-3 rounded-lg bg-amber-50 text-amber-800 px-4 py-3">
                  <div className="flex items-center justify-between font-bold">
                    <span>Pending</span><span className="text-xl tabular-nums">{inr(pending)}</span>
                  </div>
                  <p className="text-xs mt-1 text-amber-700">
                    Orders {inr(orderTotal)} − bank received {inr(received)}
                    {credit > 0 && ` · received is ${inr(credit)} more than the order amounts entered`}
                  </p>
                  {hasCashUpiNotes && <p className="text-xs mt-1 text-amber-700">Includes unconfirmed cash/UPI: those are notes only and are not counted.</p>}
                  {noAmountCount > 0 && (
                    <p className="text-xs mt-1 flex items-start gap-1 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                      {noAmountCount} of {orders.length} orders have no amount entered, so Pending may be too low.
                    </p>
                  )}
                </div>

                <div className="mt-2">
                  {payments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">No payments recorded.</p>
                  ) : payments.map(p => (
                    <div key={p.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-dashed last:border-b-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {fmtDate(p.date)}
                          <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{p.kind}</span>
                          {p.ref && <span className="ml-2 font-mono text-xs text-gray-500">{p.ref}</span>}
                        </p>
                        {p.note && <p className="text-xs text-gray-500 mt-0.5 break-words">{p.note}</p>}
                      </div>
                      {p.counted
                        ? <span className="text-sm font-semibold tabular-nums">{inr(p.amount || 0)}</span>
                        : <span className="text-xs text-gray-400 whitespace-nowrap">note only{p.amount != null ? ` · ${inr(p.amount)}` : ''}</span>}
                    </div>
                  ))}
                </div>
              </section>

              {/* 3 · Invoice */}
              <section className="bg-white border rounded-lg p-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border-2 border-indigo-700 text-indigo-700 text-xs flex items-center justify-center">3</span>
                  Invoice <span className="text-xs font-normal text-gray-500">{invoices.length}</span>
                </h3>
                {!client.zoho_customer_name && (
                  <p className="text-xs text-gray-500 mt-2">This client is not linked to a Zoho customer, so only invoices made inside this app can show here.</p>
                )}
                <div className="mt-2">
                  {invoices.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">No invoices found.</p>
                  ) : invoices.map(i => (
                    <div key={i.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-dashed last:border-b-0">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {i.number}
                          <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{i.source}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{fmtDate(i.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{inr(i.total)}</p>
                        <p className={`text-xs ${i.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {i.balance > 0 ? `${inr(i.balance)} due · ${i.status}` : 'paid'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
