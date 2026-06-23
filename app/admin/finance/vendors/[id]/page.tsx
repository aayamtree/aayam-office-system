'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Hash, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Tab = 'statement' | 'bills' | 'payments';

export default function VendorDetailPage() {
  const params = useParams();
  const vendorId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('statement');

  const today = new Date().toISOString().split('T')[0];
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

  const load = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const [{ data: v }, { data: bl }, { data: pm }] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendorId).single(),
        supabase.from('purchase_bills').select('id, bill_number, bill_date, due_date, total_amount, amount_paid, payment_status').eq('vendor_id', vendorId).order('bill_date', { ascending: false }),
        supabase.from('vendor_payments').select('id, payment_number, payment_date, amount, payment_mode, reference_number, purchase_bill_id').eq('vendor_id', vendorId).order('payment_date', { ascending: false }),
      ]);
      setVendor(v);
      setBills(bl || []);
      setPayments(pm || []);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const totalBilled = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const openingBalance = Number(vendor?.opening_balance || 0);
  const outstanding = bills.reduce((s, b) => s + Math.max(0, Number(b.total_amount || 0) - Number(b.amount_paid || 0)), 0) + openingBalance;

  const effStatus = (b: any): string => {
    const bal = Number(b.total_amount || 0) - Number(b.amount_paid || 0);
    if (b.payment_status === 'paid' || bal <= 0) return 'paid';
    if (b.due_date && b.due_date < today) return 'overdue';
    if (Number(b.amount_paid || 0) > 0) return 'partial';
    return 'pending';
  };
  const statusChip = (b: any) => {
    const s = effStatus(b);
    const cls: Record<string, string> = {
      paid: 'bg-green-100 text-green-700 border-green-200',
      overdue: 'bg-red-100 text-red-700 border-red-200',
      partial: 'bg-amber-100 text-amber-700 border-amber-200',
      pending: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const label = s === 'paid' ? 'Paid' : s === 'overdue' ? 'Overdue' : s === 'partial' ? 'Partially Paid' : 'Unpaid';
    return <span className={`px-2 py-0.5 text-xs rounded-md border whitespace-nowrap ${cls[s]}`}>{label}</span>;
  };

  // Running statement: bills increase what we owe; payments reduce it
  const statement = useMemo(() => {
    const rows: { date: string; type: string; ref: string; debit: number; credit: number }[] = [];
    if (openingBalance !== 0) {
      rows.push({ date: vendor?.opening_balance_date || '', type: 'Opening Balance', ref: '', debit: openingBalance > 0 ? openingBalance : 0, credit: openingBalance < 0 ? -openingBalance : 0 });
    }
    bills.forEach(b => rows.push({ date: b.bill_date, type: 'Bill', ref: b.bill_number, debit: Number(b.total_amount || 0), credit: 0 }));
    payments.forEach(p => rows.push({ date: p.payment_date, type: 'Payment', ref: p.payment_number || p.reference_number || '', debit: 0, credit: Number(p.amount || 0) }));
    rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let bal = 0;
    return rows.map(r => { bal += r.debit - r.credit; return { ...r, balance: bal }; });
  }, [bills, payments, openingBalance, vendor]);

  if (loading) return <div className="p-12 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading…</div>;
  if (!vendor) return <div className="p-12 text-center text-gray-400">Vendor not found. <Link href="/admin/finance/vendors" className="text-blue-600 underline">Back to vendors</Link></div>;

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap ${tab === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/finance/vendors" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="w-11 h-11 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-lg">
          {(vendor.company || vendor.name)?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg md:text-page-title text-gray-900">{vendor.company || vendor.name}</h1>
          {vendor.company && <p className="text-sm text-gray-500">{vendor.name}</p>}
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-100 p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
        {vendor.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-gray-400" />{vendor.phone}</span>}
        {vendor.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-gray-400" />{vendor.email}</span>}
        {vendor.gstin && <span className="flex items-center gap-1.5"><Hash className="w-4 h-4 text-gray-400" />GSTIN: {vendor.gstin}</span>}
        {(vendor.address || vendor.city) && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" />{[vendor.address, vendor.city, vendor.state].filter(Boolean).join(', ')}</span>}
        {vendor.payment_terms != null && vendor.payment_terms !== '' && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" />Terms: Net {vendor.payment_terms}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={`rounded-md p-4 border ${outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${outstanding > 0 ? 'text-red-700' : 'text-green-700'}`}>Outstanding Payable</p>
          <p className={`text-xl font-bold mt-1 ${outstanding > 0 ? 'text-red-800' : 'text-green-800'}`}>{fmt(outstanding)}</p>
        </div>
        <div className="rounded-md p-4 border border-gray-100 bg-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Billed</p>
          <p className="text-xl font-bold mt-1 text-gray-900">{fmt(totalBilled)}</p>
        </div>
        <div className="rounded-md p-4 border border-gray-100 bg-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Paid</p>
          <p className="text-xl font-bold mt-1 text-gray-900">{fmt(totalPaid)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <TabBtn id="statement" label="Statement" />
        <TabBtn id="bills" label={`Bills (${bills.length})`} />
        <TabBtn id="payments" label={`Payments Made (${payments.length})`} />
      </div>

      {tab === 'statement' && (
        <div className="bg-white rounded-md border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Ref</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Billed</th>
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

      {tab === 'bills' && (
        <div className="bg-white rounded-md border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Bill</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No bills yet.</td></tr>
              ) : bills.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{b.bill_number}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtDate(b.bill_date)}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(Number(b.total_amount || 0))}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(Math.max(0, Number(b.total_amount || 0) - Number(b.amount_paid || 0)))}</td>
                  <td className="px-4 py-2.5">{statusChip(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(Number(p.amount || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
