'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, Download, Printer, Loader2, Users } from 'lucide-react';
import { useCMYKClients, usePOSSales } from '@/lib/hooks';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { downloadStatement, printStatement, StatementData, StatementRow } from '@/components/receipt/StatementPDF';
import { toast } from '@/lib/toast';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ReportInner() {
  const params = useSearchParams();
  const { cmykClients, loading: clientsLoading } = useCMYKClients();
  const { sales, loading: salesLoading } = usePOSSales();
  const { settings } = useCompanySettings();

  const now = new Date();
  const [clientId, setClientId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

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
    const first = items[0]?.product_name || 'Item';
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

  const periodLabel = `${MONTHS[month]} ${year}`;
  const [generating, setGenerating] = useState(false);

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
            <p className="text-lg font-bold text-green-700">{fmt(totals.paid)}</p>
          </div>
          <div className="bg-white border rounded-md p-3">
            <p className="text-xs text-gray-500">Outstanding</p>
            <p className="text-lg font-bold text-amber-600">{fmt(totals.outstanding + (client?.opening_balance || 0))}</p>
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
