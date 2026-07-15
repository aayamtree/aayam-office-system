'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, Download, Printer, Loader2, Users, Plus, Trash2, Settings } from 'lucide-react';
import { useCMYKClients, usePOSSales, useCMYKClientPayments, useCMYKAccounts } from '@/lib/hooks';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import type { StatementData, StatementRow } from '@/components/receipt/StatementPDF';
// Lazy PDF: @react-pdf/renderer (~500KB) loads only when generating a statement
const downloadStatement = async (d: StatementData) =>
  (await import('@/components/receipt/StatementPDF')).downloadStatement(d);
const printStatement = async (d: StatementData) =>
  (await import('@/components/receipt/StatementPDF')).printStatement(d);
import { toast } from '@/lib/toast';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ReportInner() {
  const params = useSearchParams();
  const { cmykClients, loading: clientsLoading } = useCMYKClients();
  const { sales, loading: salesLoading } = usePOSSales();
  const { payments, createPayment, deletePayment } = useCMYKClientPayments();
  const { cmykAccounts } = useCMYKAccounts();
  const { settings } = useCompanySettings();

  const now = new Date();
  const [clientId, setClientId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  // CMYK's own accounts (separate from master banking) for the money-received picker.
  const accountOptions = useMemo(() =>
    (cmykAccounts || [])
      .filter((a: any) => a.is_active !== false)
      .map((a: any) => ({ value: a.id, label: a.name, type: a.type as 'cash' | 'upi' | 'bank' })),
  [cmykAccounts]);

  // Map a CMYK account id -> display name, for showing on past payments.
  const accountName = (p: any) => {
    if (p.cmyk_account_id) return (cmykAccounts || []).find((a: any) => a.id === p.cmyk_account_id)?.name;
    return null;
  };

  // Record-payment form
  const [payAccount, setPayAccount] = useState(''); // cmyk_account id
  const [payAmount, setPayAmount] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  // Default the picker to the first available account once accounts load.
  useEffect(() => {
    if (!payAccount && accountOptions.length > 0) setPayAccount(accountOptions[0].value);
  }, [accountOptions, payAccount]);

  // Pre-select client from ?client= query param
  useEffect(() => {
    const c = params.get('client');
    if (c) setClientId(c);
  }, [params]);

  const client = cmykClients?.find(c => c.id === clientId);

  const monthSales = useMemo(() => {
    if (!clientId) return [];
    return (sales || []).filter(s => {
      if ((s as any).cmyk_client_id !== clientId) return false;
      const d = new Date(s.created_at);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [sales, clientId, year, month]);

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const itemsSummary = (s: any) => {
    const items = s.items || [];
    if (items.length === 0) return s.notes || '—';
    const it0 = items[0];
    const first = `${it0?.product_name || 'Item'}${it0?.details ? ` – ${it0.details}` : ''}`;
    return items.length > 1 ? `${first} +${items.length - 1} more` : first;
  };

  const paidOf = (s: any) => {
    // amount actually received; for credit it's 0, advance is amount_received, paid is full
    if (s.payment_status === 'paid') return s.total_amount;
    return s.amount_received || 0;
  };

  const totals = useMemo(() => {
    return monthSales.reduce((acc, s: any) => {
      const taxable = (s.subtotal || 0) - (s.discount_amount || 0);
      acc.taxable += taxable;
      acc.gst += s.gst_amount || 0;
      acc.billed += s.total_amount || 0;
      acc.paid += paidOf(s);
      acc.outstanding += s.balance_due || 0;
      return acc;
    }, { taxable: 0, gst: 0, billed: 0, paid: 0, outstanding: 0 });
  }, [monthSales]);

  // Payments collected from this client during the selected month
  const monthPayments = useMemo(() => {
    if (!clientId) return [] as any[];
    return (payments || []).filter((p: any) => {
      if (p.cmyk_client_id !== clientId) return false;
      const d = new Date(p.paid_on + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a: any, b: any) => new Date(b.paid_on).getTime() - new Date(a.paid_on).getTime());
  }, [payments, clientId, year, month]);

  const collectedThisMonth = useMemo(
    () => monthPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
    [monthPayments]
  );

  // What the client still owes: opening balance + this month's unpaid bills − payments collected now.
  const openingBalance = client?.opening_balance || 0;
  const pending = openingBalance + totals.outstanding - collectedThisMonth;

  const periodLabel = `${MONTHS[month]} ${year}`;
  const [generating, setGenerating] = useState(false);

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!clientId) { toast.error('Select a client first'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!payAccount) { toast.error('Select which account received the money'); return; }
    const opt = accountOptions.find(o => o.value === payAccount);
    setSavingPay(true);
    const { error } = await createPayment({
      cmyk_client_id: clientId,
      amount: amt,
      method: opt?.type === 'cash' ? 'cash' : 'upi',
      cmyk_account_id: payAccount,
    });
    setSavingPay(false);
    if (error) { toast.error(error); return; }
    setPayAmount('');
    toast.success(`Recorded ${fmt(amt)} → ${opt?.label || ''}`);
  };

  const handleDeletePayment = async (id: string) => {
    const { error } = await deletePayment(id);
    if (error) toast.error(error);
  };

  const buildStatement = (): StatementData => {
    const rows: StatementRow[] = monthSales.map((s: any) => ({
      date: new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      billNo: s.sale_number,
      particulars: itemsSummary(s),
      taxable: (s.subtotal || 0) - (s.discount_amount || 0),
      gst: s.gst_amount || 0,
      total: s.total_amount || 0,
      status: s.payment_status === 'paid' ? 'Paid' : s.payment_status === 'partial' ? 'Part' : 'Due',
      balance: s.balance_due || 0,
    }));
    return {
      companyName: settings.companyName,
      companyAddress: `${settings.companyAddress}, ${settings.companyCity} ${settings.companyPincode}`.trim(),
      companyPhone: settings.companyPhone,
      companyGstin: settings.companyGstin,
      clientName: client?.company || client?.name || 'Client',
      clientPhone: client?.phone,
      clientGstin: client?.gstin,
      clientAddress: client?.address,
      periodLabel,
      generatedOn: new Date().toLocaleDateString('en-IN'),
      rows,
      totalTaxable: totals.taxable,
      totalGst: totals.gst,
      totalBilled: totals.billed,
      totalPaid: totals.paid,
      totalOutstanding: totals.outstanding,
      openingBalance: client?.opening_balance || 0,
    };
  };

  const handleDownload = async () => {
    if (!client || monthSales.length === 0) { toast.error('No bills for this client in the selected month'); return; }
    setGenerating(true);
    try { await downloadStatement(buildStatement()); } catch { toast.error('Could not generate PDF'); } finally { setGenerating(false); }
  };
  const handlePrint = async () => {
    if (!client || monthSales.length === 0) { toast.error('No bills for this client in the selected month'); return; }
    setGenerating(true);
    try { await printStatement(buildStatement()); } catch { toast.error('Could not generate PDF'); } finally { setGenerating(false); }
  };

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print/clients" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" /> Monthly Print Report</h1>
            <p className="text-sm text-gray-500">Per-client statement for month-end invoicing</p>
          </div>
        </div>
        <Link href="/admin/cmyk-print/clients" className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-gray-50">
          <Users className="w-4 h-4" /> Manage Clients
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-md p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="">Select client...</option>
            {(cmykClients || []).map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {clientId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border rounded-md p-3">
            <p className="text-xs text-gray-500">Total Billed</p>
            <p className="text-lg font-bold">{fmt(totals.billed)}</p>
          </div>
          <div className="bg-white border rounded-md p-3">
            <p className="text-xs text-gray-500">Total GST</p>
            <p className="text-lg font-bold">{fmt(totals.gst)}</p>
          </div>
          <div className="bg-white border rounded-md p-3">
            <p className="text-xs text-gray-500">Received</p>
            <p className="text-lg font-bold text-green-700">{fmt(totals.paid + collectedThisMonth)}</p>
            {collectedThisMonth > 0 && <p className="text-[11px] text-gray-400">incl. {fmt(collectedThisMonth)} collected</p>}
          </div>
          <div className="bg-white border rounded-md p-3">
            <p className="text-xs text-gray-500">{pending < 0 ? 'Advance' : 'Outstanding'}</p>
            <p className={`text-lg font-bold ${pending < 0 ? 'text-green-700' : 'text-amber-600'}`}>{fmt(Math.abs(pending))}</p>
          </div>
        </div>
      )}

      {/* Record a payment collected from this client */}
      {clientId && (
        <div className="bg-white border rounded-md p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">Received in account</label>
                <Link href="/admin/cmyk-print/accounts" className="text-[11px] text-gray-400 hover:text-gray-700 inline-flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Manage
                </Link>
              </div>
              {accountOptions.length === 0 ? (
                <p className="text-sm text-amber-600 py-2">
                  No CMYK accounts yet. <Link href="/admin/cmyk-print/accounts" className="underline">Add one</Link>.
                </p>
              ) : (
                <select value={payAccount} onChange={e => setPayAccount(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 min-w-[180px]">
                  {accountOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount received (₹)</label>
              <input type="number" min="0" value={payAmount} placeholder="0"
                onChange={e => setPayAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRecordPayment(); }}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <button onClick={handleRecordPayment} disabled={savingPay}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {savingPay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Record Payment
            </button>
          </div>

          {/* Payments collected this month */}
          {monthPayments.length > 0 && (
            <div className="mt-3 border-t pt-3 space-y-1.5">
              {monthPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {new Date(p.paid_on + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{accountName(p) || (p.method || '').toUpperCase()}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-green-700">{fmt(Number(p.amount))}</span>
                    <button onClick={() => handleDeletePayment(p.id)} className="text-gray-300 hover:text-red-500" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pending shown below */}
          <div className="mt-3 border-t pt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">{pending < 0 ? 'Advance with you' : 'Pending amount'}</span>
            <span className={`text-lg font-bold ${pending < 0 ? 'text-green-700' : 'text-amber-600'}`}>{fmt(Math.abs(pending))}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {clientId && (
        <div className="flex gap-2">
          <button onClick={handleDownload} disabled={generating || monthSales.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
          </button>
          <button onClick={handlePrint} disabled={generating || monthSales.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Print Statement
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Bill #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Particulars</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Taxable</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">GST</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(clientsLoading || salesLoading) ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</td></tr>
              ) : !clientId ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Select a client to see their monthly bills.</td></tr>
              ) : monthSales.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No bills for {client?.company || client?.name} in {periodLabel}.</td></tr>
              ) : monthSales.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-4 py-3 text-sm font-medium">{s.sale_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{itemsSummary(s)}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt((s.subtotal || 0) - (s.discount_amount || 0))}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(s.gst_amount || 0)}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">{fmt(s.total_amount || 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.payment_status === 'paid' ? 'bg-green-50 text-green-700' : s.payment_status === 'partial' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {s.payment_status === 'paid' ? 'Paid' : s.payment_status === 'partial' ? 'Partial' : 'Due'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {clientId && monthSales.length > 0 && (
              <tfoot className="border-t-2">
                <tr className="font-semibold bg-gray-50">
                  <td className="px-4 py-3 text-sm" colSpan={3}>Total — {monthSales.length} bill{monthSales.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(totals.taxable)}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(totals.gst)}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(totals.billed)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CMYKClientReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</div>}>
      <ReportInner />
    </Suspense>
  );
}
