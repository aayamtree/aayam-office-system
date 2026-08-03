'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ShoppingBag, Receipt, Trash2, Loader2, Download, Eye, X, Pencil, Wallet, Banknote, Smartphone } from 'lucide-react';
import { usePOSSales, useCMYKAccounts } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import type { ReceiptData } from '@/components/receipt/ReceiptPDF';
// Lazy PDF: @react-pdf/renderer (~500KB) loads only when downloading a receipt
const downloadReceipt = async (d: ReceiptData) =>
  (await import('@/components/receipt/ReceiptPDF')).downloadReceipt(d);
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

/** What is actually still owed on a bill — the single source of truth for "unpaid". */
const dueOf = (s: any) => Math.max(0, (Number(s.total_amount) || 0) - (Number(s.amount_received) || 0));

export default function POSSalesListPage() {
  const { sales, loading, refetch } = usePOSSales();
  const { cmykAccounts } = useCMYKAccounts();
  const { profile } = useAuth();
  const { settings } = useCompanySettings();
  const confirm = useConfirm();
  const isAdmin = profile?.role === 'admin';
  // Correcting a bill is an admin / CMYK-team job — designers, marketing and dispatch
  // never see the button. The real lock is the role check in PUT /api/cmyk-print/sales/[id].
  const canEdit = ['admin', 'cmyk'].includes(profile?.role || '');
  // Default to All time so the list always shows every bill; month is an optional filter.
  const [month, setMonth] = useState<string>('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Bill selected for the on-screen detail popup (null = closed)
  const [viewSale, setViewSale] = useState<any | null>(null);
  // Bill being settled from the list + which account is taking the money
  const [receiveSale, setReceiveSale] = useState<any | null>(null);
  const [receiveAccount, setReceiveAccount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiving, setReceiving] = useState(false);

  const activeAccounts = useMemo(
    () => (cmykAccounts || []).filter((a: any) => a.is_active !== false),
    [cmykAccounts]
  );

  const openReceive = (s: any) => {
    setReceiveSale(s);
    setReceiveAccount(s.cmyk_account_id || activeAccounts[0]?.id || '');
    setReceiveAmount(String(dueOf(s)));
  };

  const handleReceive = async () => {
    if (!receiveSale) return;
    if (!receiveAccount) { toast.error('Choose which account received the money'); return; }
    setReceiving(true);
    try {
      const res = await fetch(`/api/cmyk-print/sales/${receiveSale.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmyk_account_id: receiveAccount, amount: receiveAmount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not record the payment');
      toast.success(`₹${json.amount_received} recorded into ${json.account_name} for ${json.sale_number}`);
      setReceiveSale(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Could not record the payment');
    } finally {
      setReceiving(false);
    }
  };

  // Rebuild the ESTIMATE PDF for a past bill from its stored line items.
  const buildEstimate = (s: any): ReceiptData => {
    const d = new Date(s.created_at);
    return {
      companyName: settings.companyName,
      companyAddress: `${settings.companyAddress}, ${settings.companyCity} ${settings.companyPincode}`.trim(),
      companyPhone: settings.companyPhone,
      receiptNumber: s.sale_number,
      date: d.toLocaleDateString('en-IN'),
      time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      customerName: s.customer_name || s.cmyk_client?.company || s.cmyk_client?.name || undefined,
      customerPhone: s.customer_phone || undefined,
      items: (s.items || []).map((it: any) => ({
        // Rebuild the printed item label: name + sides + design/matter details + paper
        name: `${it.product_name || 'Item'}${it.print_sides ? (it.print_sides === 'two' ? ' (2 Side)' : ' (1 Side)') : ''}${it.details ? ` — ${it.details}` : ''}${it.paper_name ? ` · ${it.paper_name}${it.sheets ? ` × ${it.sheets} sh` : ''}` : ''}`,
        qty: it.quantity,
        price: it.price,
        total: it.total,
      })),
      subtotal: s.subtotal || 0,
      discountPercent: s.discount_percent || 0,
      discountAmount: s.discount_amount || 0,
      gstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      grandTotal: s.total_amount || 0,
      // Never print money that was not collected. This used to fall back to the grand
      // total, so an unpaid bill's PDF read "Payment: Cash" and looked settled.
      paymentMode: dueOf(s) > 0 ? 'UNPAID · pay later' : (s.payment_mode || 'cash'),
      amountReceived: Number(s.amount_received) || 0,
      change: s.change_amount || 0,
      cashier: s.sold_by || 'CMYK',
    };
  };

  const handleDownload = async (s: any) => {
    setDownloadingId(s.id);
    try {
      await downloadReceipt(buildEstimate(s));
    } catch {
      toast.error('Could not generate the estimate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (sale: any) => {
    const { confirmed, inputValue } = await confirm({
      title: `Delete bill ${sale.sale_number}?`,
      message: `This permanently removes the bill (${sale.customer_name || 'Walk-in'} — ₹${sale.total_amount}) and returns any paper sheets to stock. This cannot be undone.\n\nEnter a reason for cancelling this bill (required — saved to the activity log):`,
      variant: 'danger',
      confirmLabel: 'Delete bill',
      showInput: true,
      inputRequired: true,
      inputPlaceholder: 'Reason for cancellation, e.g. "customer changed order"',
    });
    if (!confirmed) return;
    const reason = (inputValue || '').trim();
    if (reason.length < 3) {
      toast.error('Please enter a reason (at least 3 characters). Bill was not deleted.');
      return;
    }

    setDeletingId(sale.id);
    try {
      const res = await fetch(`/api/cmyk-print/sales/${sale.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      toast.success(`Bill ${sale.sale_number} deleted`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Could not delete bill');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sales || []).filter((s: any) => {
      // Month filter (blank = all months)
      if (month) {
        const d = new Date(s.created_at);
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (m !== month) return false;
      }
      if (!q) return true;
      const customer = (s.customer_name || s.cmyk_client?.name || '').toLowerCase();
      return (s.sale_number || '').toLowerCase().includes(q) || customer.includes(q);
    });
  }, [sales, month, query]);

  const total = filtered.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
  // Billed is not collected. Showing both side by side is the whole point of this fix.
  const collected = filtered.reduce((sum: number, s: any) => sum + (Number(s.amount_received) || 0), 0);
  const outstanding = filtered.reduce((sum: number, s: any) => sum + dueOf(s), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href="/admin/cmyk-print"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft size={16} /> Back to CMYK Print
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-md">
            <ShoppingBag size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">POS Sales</h1>
            <p className="text-sm text-muted-foreground">All counter bills, newest first</p>
          </div>
        </div>
      </div>

      {/* Filters + summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
              />
              {month && (
                <button
                  type="button"
                  onClick={() => setMonth('')}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  All time
                </button>
              )}
            </div>

            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bill no. or customer…"
                className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background"
              />
            </div>

            <div className="text-sm text-right whitespace-nowrap leading-tight">
              <div>
                <span className="text-muted-foreground">{filtered.length} sale{filtered.length !== 1 ? 's' : ''} · billed </span>
                <span className="font-semibold text-foreground">{fmt(total)}</span>
              </div>
              <div className="text-xs mt-0.5">
                <span className="text-green-700 font-medium">{fmt(collected)} collected</span>
                {outstanding > 0 && (
                  <span className="text-amber-600 font-medium"> · {fmt(outstanding)} unpaid</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt size={16} /> Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No sales found for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Bill No.</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium text-center">Items</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s: any) => {
                    const d = new Date(s.created_at);
                    const due = dueOf(s);
                    const partly = due > 0 && (Number(s.amount_received) || 0) > 0;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setViewSale(s)}
                        className="border-b hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          <span className="text-xs ml-1">
                            {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {s.sale_number}
                            {s.order_type === 'pickup' && (
                              <Badge variant="outline" className="text-[10px] px-1.5">Pickup</Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">{s.customer_name || s.cmyk_client?.name || 'Walk-in'}</td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground">{s.items?.length ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">
                          {fmt(s.total_amount)}
                          {due > 0 && (
                            <span className="block text-[10px] font-medium text-amber-600 mt-0.5">
                              {partly ? `${fmt(due)} still due` : 'UNPAID'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-end gap-1">
                            {canEdit && due > 0 && (
                              <button
                                type="button"
                                onClick={() => openReceive(s)}
                                title={`Record ${fmt(due)} received`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                              >
                                <Wallet size={13} /> Mark received
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewSale(s)}
                              title="View bill details"
                              className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Eye size={15} />
                            </button>
                            {canEdit && (
                              <Link
                                href={`/admin/cmyk-print/retail-pos?edit=${s.id}`}
                                title="Edit this bill (admin / CMYK team)"
                                className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              >
                                <Pencil size={15} />
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDownload(s)}
                              disabled={downloadingId === s.id}
                              title="Download estimate PDF"
                              className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                            >
                              {downloadingId === s.id
                                ? <Loader2 size={15} className="animate-spin" />
                                : <Download size={15} />}
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(s)}
                                disabled={deletingId === s.id}
                                title="Delete bill (admin only)"
                                className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                {deletingId === s.id
                                  ? <Loader2 size={15} className="animate-spin" />
                                  : <Trash2 size={15} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill detail popup — read-only, no download needed */}
      {viewSale && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
          onClick={() => setViewSale(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-background shadow-xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">{viewSale.sale_number}</h2>
                  {viewSale.order_type === 'pickup' && (
                    <Badge variant="outline" className="text-[10px] px-1.5">Pickup</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(viewSale.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}
                  {new Date(viewSale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewSale(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer */}
            <div className="px-5 py-3 border-b text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-foreground">
                  {viewSale.customer_name || viewSale.cmyk_client?.company || viewSale.cmyk_client?.name || 'Walk-in'}
                </span>
              </div>
              {viewSale.customer_phone && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="text-foreground">{viewSale.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="px-5 py-3 border-b">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 font-medium">Item</th>
                    <th className="py-1 font-medium text-center">Qty</th>
                    <th className="py-1 font-medium text-right">Rate</th>
                    <th className="py-1 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewSale.items || []).map((it: any, i: number) => (
                    <tr key={i} className="border-t align-top">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium text-foreground">
                          {it.product_name || 'Item'}
                          {it.print_sides ? (it.print_sides === 'two' ? ' (2 Side)' : ' (1 Side)') : ''}
                        </div>
                        {it.details && (
                          <div className="text-xs text-muted-foreground">{it.details}</div>
                        )}
                        {it.paper_name && (
                          <div className="text-xs text-muted-foreground">
                            {it.paper_name}{it.sheets ? ` × ${it.sheets} sh` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 text-center whitespace-nowrap">{it.quantity}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">{fmt(it.price)}</td>
                      <td className="py-1.5 text-right whitespace-nowrap font-medium">{fmt(it.total)}</td>
                    </tr>
                  ))}
                  {(!viewSale.items || viewSale.items.length === 0) && (
                    <tr><td colSpan={4} className="py-3 text-center text-muted-foreground text-xs">No line items stored for this bill.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-5 py-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{fmt(viewSale.subtotal || 0)}</span>
              </div>
              {(viewSale.discount_amount > 0 || viewSale.discount_percent > 0) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount{viewSale.discount_percent ? ` (${viewSale.discount_percent}%)` : ''}</span>
                  <span>− {fmt(viewSale.discount_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-foreground pt-1 border-t">
                <span>Grand Total</span>
                <span>{fmt(viewSale.total_amount || 0)}</span>
              </div>
              {/* "Payment" used to show only the mode, so an unpaid bill read "Cash" and
                  looked settled. Show what was actually collected, and what is still due. */}
              <div className="flex justify-between text-muted-foreground pt-1">
                <span>Received</span>
                <span className={dueOf(viewSale) > 0 ? 'text-amber-600 font-medium' : 'text-green-700 font-medium'}>
                  {fmt(Number(viewSale.amount_received) || 0)}
                  {(Number(viewSale.amount_received) || 0) > 0 && (
                    <span className="capitalize font-normal text-muted-foreground"> · {viewSale.payment_mode || 'cash'}</span>
                  )}
                </span>
              </div>
              {dueOf(viewSale) > 0 && (
                <div className="flex justify-between font-semibold text-amber-600">
                  <span>Still due</span>
                  <span>{fmt(dueOf(viewSale))}</span>
                </div>
              )}
              {viewSale.sold_by && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Billed by</span>
                  <span>{viewSale.sold_by}</span>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
              {canEdit && (
                <Link
                  href={`/admin/cmyk-print/retail-pos?edit=${viewSale.id}`}
                  className="mr-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil size={15} /> Edit bill
                </Link>
              )}
              {canEdit && dueOf(viewSale) > 0 && (
                <button
                  type="button"
                  onClick={() => { const s = viewSale; setViewSale(null); openReceive(s); }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Wallet size={15} /> Mark received
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDownload(viewSale)}
                disabled={downloadingId === viewSale.id}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {downloadingId === viewSale.id
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Download size={15} />}
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => setViewSale(null)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record money received against a past bill → lands in a real CMYK account */}
      {receiveSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReceiveSale(null)}>
          <div className="w-full max-w-md rounded-lg bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Record payment</h2>
                <p className="text-xs text-muted-foreground">
                  {receiveSale.sale_number} · {receiveSale.customer_name || receiveSale.cmyk_client?.name || 'Walk-in'}
                </p>
              </div>
              <button onClick={() => setReceiveSale(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Bill total</span><span>{fmt(receiveSale.total_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Already received</span><span>{fmt(Number(receiveSale.amount_received) || 0)}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-600 pt-1 border-t">
                  <span>Still due</span><span>{fmt(dueOf(receiveSale))}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Received in account</p>
                {activeAccounts.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    No CMYK accounts yet. <Link href="/admin/cmyk-print/accounts" className="underline">Add one</Link>.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {activeAccounts.map((a: any) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setReceiveAccount(a.id)}
                        className={`p-3 rounded-md border-2 flex flex-col items-center gap-1 text-center transition-all ${receiveAccount === a.id ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'}`}
                      >
                        {a.type === 'cash' ? <Banknote size={18} /> : <Smartphone size={18} />}
                        <span className="text-xs leading-tight">{a.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Amount received</label>
                <input
                  type="number"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 border rounded-md text-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Prefilled with the full balance. Lower it for a part payment.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={() => setReceiveSale(null)} className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReceive}
                disabled={receiving || !receiveAccount}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {receiving ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                Record payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
