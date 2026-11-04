'use client';

import { useConfirm } from '@/components/ConfirmModal';
import { useState, useMemo, useEffect, Suspense, Fragment } from 'react';
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
  const confirm = useConfirm();
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
  // 'month' = one month's statement; 'pending' = every unpaid bill till date
  const [view, setView] = useState<'month' | 'pending'>(() => (params.get('client') ? 'month' : 'pending'));
  const isPending = view === 'pending';

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
      if (isPending) return ((s as any).balance_due || 0) > 0; // all dates, unpaid only
      const d = new Date(s.created_at);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [sales, clientId, year, month, isPending]);

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

  // Pending view: bills grouped month by month, each with its own subtotal.
  const monthGroups = useMemo(() => {
    const map = new Map<string, { label: string; sales: any[]; billed: number; balance: number }>();
    for (const s of monthSales as any[]) {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, sales: [], billed: 0, balance: 0 });
      const g = map.get(key)!;
      g.sales.push(s);
      g.billed += s.total_amount || 0;
      g.balance += s.balance_due || 0;
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, g]) => ({ key, ...g }));
  }, [monthSales]);

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
      if (isPending) return true; // all payments till date
      const d = new Date(p.paid_on + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a: any, b: any) => new Date(b.paid_on).getTime() - new Date(a.paid_on).getTime());
  }, [payments, clientId, year, month, isPending]);

  const collectedThisMonth = useMemo(
    () => monthPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
    [monthPayments]
  );

  // What the client still owes: opening balance + this month's unpaid bills − payments collected now.
  const openingBalance = client?.opening_balance || 0;
  const pending = openingBalance + totals.outstanding - collectedThisMonth;

  const dFmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  // Oldest unpaid bill = where the pending amount starts (monthSales is sorted oldest first)
  const pendingSince = isPending && monthSales.length > 0 ? new Date((monthSales[0] as any).created_at) : null;
  const periodLabel = isPending
    ? `All pending ${pendingSince ? `from ${dFmt(pendingSince)} ` : ''}till ${dFmt(now)}`
    : `${MONTHS[month]} ${year}`;
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

  const handleDeletePayment = async (id: string, p?: any) => {
    // This was a bare Remove button with no dialog at all — one click and a
    // receipt was gone, silently changing the client's outstanding balance.
    const { confirmed } = await confirm({
      title: 'Delete this payment?',
      message: p
        ? `${fmt(Number(p.amount) || 0)} received on ${new Date(p.paid_on || p.created_at).toLocaleDateString('en-IN')}.`
        : 'This receipt is removed permanently.',
      consequences: [
        'The receipt is deleted, not reversed — there is no record it ever existed.',
        'This client\u2019s outstanding balance changes immediately.',
      ],
      variant: 'danger',
      confirmLabel: 'Delete payment',
      requireExactInput: 'DELETE',
    });
    if (!confirmed) return;
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
      totalPaid: totals.paid + (isPending ? collectedThisMonth : 0),
      // PDF shows Amount Due = totalOutstanding + openingBalance, so in the
      // pending view take the collected payments off here.
      totalOutstanding: isPending ? totals.outstanding - collectedThisMonth : totals.outstanding,
      openingBalance: client?.opening_balance || 0,
    };
  };

  const handleDownload = async () => {
    if (!client || monthSales.length === 0) { toast.error(isPending ? 'No pending bills for this client' : 'No bills for this client in the selected month'); return; }
    setGenerating(true);
    try { await downloadStatement(buildStatement()); } catch { toast.error('Could not generate PDF'); } finally { setGenerating(false); }
  };
  const handlePrint = async () => {
    if (!client || monthSales.length === 0) { toast.error(isPending ? 'No pending bills for this client' : 'No bills for this client in the selected month'); return; }
    setGenerating(true);
    try { await printStatement(buildStatement()); } catch { toast.error('Could not generate PDF'); } finally { setGenerating(false); }
  };


  // ---------- Overall matrix (no client selected) ----------
  // One row per client. In 'pending' mode payments are applied oldest-first
  // (opening balance, then oldest bills), so the age columns add up to Pending.
  const overall = useMemo(() => {
    const DAY = 86400000;
    const nowMs = Date.now();
    const rows = (cmykClients || []).map((c: any) => {
      const opening = Number(c.opening_balance) || 0;
      const mySales = (sales || []).filter((s: any) => s.cmyk_client_id === c.id);
      const myPays = (payments || []).filter((p: any) => p.cmyk_client_id === c.id);
      const r = { id: c.id as string, name: (c.company || c.name || 'Client') as string, bills: 0, oldest: null as Date | null,
        opening, b0: 0, b30: 0, b60: 0, b90: 0, openingLeft: 0, billed: 0, taxable: 0, gst: 0, received: 0, pending: 0 };
      if (isPending) {
        let credit = myPays.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        if (opening > 0) { const take = Math.min(opening, credit); credit -= take; r.openingLeft = opening - take; }
        else credit += -opening;
        const unpaid = mySales.filter((s: any) => (s.balance_due || 0) > 0)
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        for (const s of unpaid as any[]) {
          const take = Math.min(s.balance_due, credit); credit -= take;
          const rem = s.balance_due - take;
          r.billed += s.total_amount || 0;
          r.bills += 1;
          if (rem <= 0) continue;
          const created = new Date(s.created_at);
          if (!r.oldest) r.oldest = created;
          const age = Math.floor((nowMs - created.getTime()) / DAY);
          if (age <= 30) r.b0 += rem; else if (age <= 60) r.b30 += rem; else if (age <= 90) r.b60 += rem; else r.b90 += rem;
        }
        r.received = myPays.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        r.pending = r.openingLeft + r.b0 + r.b30 + r.b60 + r.b90 - credit;
      } else {
        const inMonth = (d: Date) => d.getFullYear() === year && d.getMonth() === month;
        const ms = mySales.filter((s: any) => inMonth(new Date(s.created_at)));
        const mp = myPays.filter((p: any) => inMonth(new Date(p.paid_on + 'T00:00:00')));
        const collected = mp.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        r.bills = ms.length;
        for (const s of ms as any[]) {
          r.billed += s.total_amount || 0;
          r.taxable += (s.subtotal || 0) - (s.discount_amount || 0);
          r.gst += s.gst_amount || 0;
          r.received += paidOf(s);
        }
        r.received += collected;
        r.pending = opening + ms.reduce((sum: number, s: any) => sum + (s.balance_due || 0), 0) - collected;
      }
      return r;
    }).filter(r => isPending ? (r.pending !== 0 || r.bills > 0) : (r.bills > 0 || r.received > 0))
      .sort((a, b) => b.pending - a.pending);
    const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
    return {
      rows,
      totals: { bills: sum(r => r.bills), openingLeft: sum(r => r.openingLeft), opening: sum(r => r.opening),
        b0: sum(r => r.b0), b30: sum(r => r.b30), b60: sum(r => r.b60), b90: sum(r => r.b90),
        billed: sum(r => r.billed), taxable: sum(r => r.taxable), gst: sum(r => r.gst), received: sum(r => r.received), pending: sum(r => r.pending) },
    };
  }, [cmykClients, sales, payments, isPending, year, month]);

  const renderRow = (s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-4 py-3 text-sm font-medium">{s.sale_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{itemsSummary(s)}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt((s.subtotal || 0) - (s.discount_amount || 0))}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(s.gst_amount || 0)}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">{fmt(s.total_amount || 0)}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-amber-600">{(s.balance_due || 0) > 0 ? fmt(s.balance_due) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.payment_status === 'paid' ? 'bg-green-50 text-green-700' : s.payment_status === 'partial' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {s.payment_status === 'paid' ? 'Paid' : s.payment_status === 'partial' ? 'Partial' : 'Due'}
                    </span>
                  </td>
                </tr>
  );

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print/clients" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" /> Monthly Print Report</h1>
            <p className="text-sm text-gray-500">Per-client statement for month-end invoicing, or all pending till date</p>
          </div>
        </div>
        <Link href="/admin/cmyk-print/clients" className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-gray-50">
          <Users className="w-4 h-4" /> Manage Clients
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-md p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="">All clients (overall)</option>
            {(cmykClients || []).map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Show</label>
          <select value={view} onChange={e => setView(e.target.value as 'month' | 'pending')}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="month">One month</option>
            <option value="pending">All pending till date</option>
          </select>
        </div>
        <div className={isPending ? 'opacity-40' : ''}>
          <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
          <select value={month} disabled={isPending} onChange={e => setMonth(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>
        <div className={isPending ? 'opacity-40' : ''}>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <select value={year} disabled={isPending} onChange={e => setYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {clientId && isPending && (
        <p className="text-sm text-gray-600">
          {pendingSince
            ? <>Pending from the oldest unpaid bill, <span className="font-semibold">{dFmt(pendingSince)}</span>, till today ({dFmt(now)}).{openingBalance ? ' Opening balance is added on top.' : ''}</>
            : 'Nothing pending.'}
        </p>
      )}

      {/* Summary cards */}
      {clientId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border rounded-md p-3">
            <p className="text-xs text-gray-500">{isPending ? 'Billed (pending bills)' : 'Total Billed'}</p>
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
                    <button onClick={() => handleDeletePayment(p.id, p)} className="text-gray-300 hover:text-red-500" title="Remove">
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
      {/* Overall matrix — shown until a client is picked */}
      {!clientId ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border rounded-md p-3">
              <p className="text-xs text-gray-500">{isPending ? 'Total pending' : 'Total billed'}</p>
              <p className="text-lg font-bold text-amber-600">{fmt(isPending ? overall.totals.pending : overall.totals.billed)}</p>
            </div>
            <div className="bg-white border rounded-md p-3">
              <p className="text-xs text-gray-500">Clients {isPending ? 'owing' : 'billed'}</p>
              <p className="text-lg font-bold">{isPending ? overall.rows.filter(r => r.pending > 0).length : overall.rows.length}</p>
            </div>
            <div className="bg-white border rounded-md p-3">
              <p className="text-xs text-gray-500">{isPending ? 'Older than 60 days' : 'Received'}</p>
              <p className={`text-lg font-bold ${isPending ? 'text-red-600' : 'text-green-700'}`}>{fmt(isPending ? overall.totals.b60 + overall.totals.b90 : overall.totals.received)}</p>
            </div>
            <div className="bg-white border rounded-md p-3">
              <p className="text-xs text-gray-500">{isPending ? 'Opening balances' : 'Pending'}</p>
              <p className="text-lg font-bold">{fmt(isPending ? overall.totals.openingLeft : overall.totals.pending)}</p>
            </div>
          </div>
          <div className="bg-white border rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-gray-50 text-sm font-semibold">
              All clients — {periodLabel}
              <span className="ml-2 text-xs font-normal text-gray-500">Click a client to open their statement</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-xs font-semibold text-gray-500 uppercase">
                    <th className="text-left px-4 py-3">Client</th>
                    {isPending ? (<>
                      <th className="text-right px-4 py-3">Opening</th>
                      <th className="text-right px-4 py-3">0–30 d</th>
                      <th className="text-right px-4 py-3">31–60 d</th>
                      <th className="text-right px-4 py-3">61–90 d</th>
                      <th className="text-right px-4 py-3">90+ d</th>
                      <th className="text-right px-4 py-3">Pending</th>
                      <th className="text-right px-4 py-3">Oldest bill</th>
                    </>) : (<>
                      <th className="text-right px-4 py-3">Bills</th>
                      <th className="text-right px-4 py-3">Taxable</th>
                      <th className="text-right px-4 py-3">GST</th>
                      <th className="text-right px-4 py-3">Billed</th>
                      <th className="text-right px-4 py-3">Received</th>
                      <th className="text-right px-4 py-3">Pending</th>
                    </>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(clientsLoading || salesLoading) ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</td></tr>
                  ) : overall.rows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">{isPending ? 'Nothing pending for any client.' : `No bills in ${periodLabel}.`}</td></tr>
                  ) : overall.rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setClientId(r.id)}>
                      <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                      {isPending ? (<>
                        <td className="px-4 py-3 text-sm text-right">{r.openingLeft ? fmt(r.openingLeft) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-right">{r.b0 ? fmt(r.b0) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-right">{r.b30 ? fmt(r.b30) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-right text-amber-700">{r.b60 ? fmt(r.b60) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{r.b90 ? fmt(r.b90) : '—'}</td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${r.pending < 0 ? 'text-green-700' : 'text-amber-600'}`}>{r.pending < 0 ? `${fmt(-r.pending)} adv.` : fmt(r.pending)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">{r.oldest ? dFmt(r.oldest) : '—'}</td>
                      </>) : (<>
                        <td className="px-4 py-3 text-sm text-right">{r.bills}</td>
                        <td className="px-4 py-3 text-sm text-right">{fmt(r.taxable)}</td>
                        <td className="px-4 py-3 text-sm text-right">{fmt(r.gst)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">{fmt(r.billed)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-700">{fmt(r.received)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${r.pending < 0 ? 'text-green-700' : 'text-amber-600'}`}>{r.pending < 0 ? `${fmt(-r.pending)} adv.` : fmt(r.pending)}</td>
                      </>)}
                    </tr>
                  ))}
                </tbody>
                {overall.rows.length > 0 && (
                  <tfoot className="border-t-2">
                    <tr className="font-semibold bg-gray-50 text-sm">
                      <td className="px-4 py-3">Total — {overall.rows.length} client{overall.rows.length !== 1 ? 's' : ''}</td>
                      {isPending ? (<>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.openingLeft)}</td>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.b0)}</td>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.b30)}</td>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.b60)}</td>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.b90)}</td>
                        <td className="px-4 py-3 text-right text-amber-600">{fmt(overall.totals.pending)}</td>
                        <td className="px-4 py-3"></td>
                      </>) : (<>
                        <td className="px-4 py-3 text-right">{overall.totals.bills}</td>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.taxable)}</td>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.gst)}</td>
                        <td className="px-4 py-3 text-right">{fmt(overall.totals.billed)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmt(overall.totals.received)}</td>
                        <td className="px-4 py-3 text-right text-amber-600">{fmt(overall.totals.pending)}</td>
                      </>)}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          {isPending && <p className="text-[11px] text-gray-400">Payments received are applied to the opening balance first, then to the oldest bills. Bills without a client (walk-in) are not included.</p>}
        </div>
      ) : (
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(clientsLoading || salesLoading) ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</td></tr>
              ) : !clientId ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Select a client to see their bills.</td></tr>
              ) : monthSales.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">{isPending ? `No pending bills for ${client?.company || client?.name}.` : `No bills for ${client?.company || client?.name} in ${periodLabel}.`}</td></tr>
              ) : isPending ? monthGroups.map(g => (
                <Fragment key={g.key}>
                  <tr className="bg-gray-100">
                    <td className="px-4 py-2 text-sm font-semibold" colSpan={5}>{g.label} — {g.sales.length} bill{g.sales.length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold">{fmt(g.billed)}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-amber-600">{fmt(g.balance)}</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                  {g.sales.map((s: any) => renderRow(s))}
                </Fragment>
              )) : monthSales.map((s: any) => renderRow(s))}
            </tbody>
            {clientId && monthSales.length > 0 && (
              <tfoot className="border-t-2">
                <tr className="font-semibold bg-gray-50">
                  <td className="px-4 py-3 text-sm" colSpan={3}>Total — {monthSales.length} bill{monthSales.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(totals.taxable)}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(totals.gst)}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(totals.billed)}</td>
                  <td className="px-4 py-3 text-sm text-right text-amber-600">{fmt(totals.outstanding)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}
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
