'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Hash, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Tab = 'statement' | 'invoices' | 'payments';

export default function CustomerDetailPage() {
  const params = useParams();
  const clientId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('statement');

  const today = new Date().toISOString().split('T')[0];
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [{ data: c }, { data: invs }, { data: pays }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('invoices').select('id, invoice_number, invoice_date, due_date, total_amount, amount_paid, payment_status').eq('client_id', clientId).order('invoice_date', { ascending: false }),
        supabase.from('payments_received').select('id, payment_number, payment_date, amount, payment_mode, reference_number, invoice_id').eq('client_id', clientId).order('payment_date', { ascending: false }),
      ]);
      setClient(c);
      setInvoices(invs || []);
      setPayments(pays || []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const totalReceived = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const openingBalance = Number(client?.opening_balance || 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)), 0) + openingBalance;

  const effStatus = (i: any): string => {
    const bal = Number(i.total_amount || 0) - Number(i.amount_paid || 0);
    if (i.payment_status === 'paid' || bal <= 0) return 'paid';
    if (i.due_date && i.due_date < today) return 'overdue';
    if (Number(i.amount_paid || 0) > 0) return 'partial';
    return 'pending';
  };
  const statusChip = (i: any) => {
    const s = effStatus(i);
    const cls: Record<string, string> = {
      paid: 'bg-green-100 text-green-700 border-green-200',
      overdue: 'bg-red-100 text-red-700 border-red-200',
      partial: 'bg-amber-100 text-amber-700 border-amber-200',
      pending: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const label = s === 'paid' ? 'Paid' : s === 'overdue' ? 'Overdue' : s === 'partial' ? 'Partially Paid' : 'Unpaid';
    return <span className={`px-2 py-0.5 text-xs rounded-md border whitespace-nowrap ${cls[s]}`}>{label}</span>;
  };

  // Running statement: invoices increase balance owed; payments reduce it
  const statement = useMemo(() => {
    const rows: { date: string; type: string; ref: string; debit: number; credit: number }[] = [];
    if (openingBalance !== 0) {
      rows.push({ date: client?.opening_balance_date || '', type: 'Opening Balance', ref: '', debit: openingBalance > 0 ? openingBalance : 0, credit: openingBalance < 0 ? -openingBalance : 0 });
    }
    invoices.forEach(i => rows.push({ date: i.invoice_date, type: 'Invoice', ref: i.invoice_number, debit: Number(i.total_amount || 0), credit: 0 }));
    payments.forEach(p => rows.push({ date: p.payment_date, type: 'Payment', ref: p.payment_number || p.reference_number || '', debit: 0, credit: Number(p.amount || 0) }));
    rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let bal = 0;
    return rows.map(r => { bal += r.debit - r.credit; return { ...r, balance: bal }; });
  }, [invoices, payments, openingBalance, client]);

  if (loading) {
    return <div className="p-12 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading…</div>;
  }
  if (!client) {
    return <div className="p-12 text-center text-gray-400">Customer not found. <Link href="/admin/crm/clients" className="text-blue-600 underline">Back to clients</Link></div>;
  }

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap ${tab === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/crm/clients" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="w-11 h-11 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-lg">
          {(client.company || client.name)?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg md:text-page-title text-gray-900">{client.company || client.name}</h1>
          {client.company && <p className="text-sm text-gray-500">{client.name}</p>}
        </div>
      </div>

      {/* Contact strip */}
      <div className="bg-white rounded-md border border-gray-100 p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
        {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-gray-400" />{client.phone}</span>}
        {client.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-gray-400" />{client.email}</span>}
        {client.gstin && <span className="flex items-center gap-1.5"><Hash className="w-4 h-4 text-gray-400" />GSTIN: {client.gstin}</span>}
        {(client.address || client.city) && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" />{[client.address, client.city, client.state].filter(Boolean).join(', ')}</span>}
        {client.credit_limit > 0 && <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" />Credit limit: {fmt(client.credit_limit)}</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={`rounded-md p-4 border ${outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${outstanding > 0 ? 'text-red-700' : 'text-green-700'}`}>Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${outstanding > 0 ? 'text-red-800' : 'text-green-800'}`}>{fmt(outstanding)}</p>
        </div>
        <div className="rounded-md p-4 border border-gray-100 bg-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Invoiced</p>
          <p className="text-xl font-bold mt-1 text-gray-900">{fmt(totalInvoiced)}</p>
        </div>
        <div className="rounded-md p-4 border border-gray-100 bg-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Received</p>
          <p className="text-xl font-bold mt-1 text-gray-900">{fmt(totalReceived)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn id="statement" label="Statement" />
        <TabBtn id="invoices" label={`Invoices (${invoices.length})`} />
        <TabBtn id="payments" label={`Payments (${payments.length})`} />
      </div>

      {/* Statement */}
      {tab === 'statement' && (
        <div className="bg-white rounded-md border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Ref</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Invoiced</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Paid</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statement.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No transactions yet.</td></tr>
              ) : statement.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-gray-800">{r.type}</td>
                  <td className="px-4 py-2.5 text-gray-500">{r.ref}</td>
                  <td className="px-4 py-2.5 text-right">{r.debit ? fmt(r.debit) : ''}</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{r.credit ? fmt(r.credit) : ''}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices */}
      {tab === 'invoices' && (
        <div className="bg-white rounded-md border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No invoices yet.</td></tr>
              ) : invoices.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{i.invoice_number}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtDate(i.invoice_date)}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(Number(i.total_amount || 0))}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)))}</td>
                  <td className="px-4 py-2.5">{statusChip(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments */}
      {tab === 'payments' && (
        <div className="bg-white rounded-md border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Mode</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Reference</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No payments yet.</td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{p.payment_number || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize">{(p.payment_mode || '').replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.reference_number || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-700">{fmt(Number(p.amount || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
