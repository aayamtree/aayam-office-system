'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ShoppingBag, Receipt, Trash2, Loader2, Download } from 'lucide-react';
import { usePOSSales } from '@/lib/hooks';
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

export default function POSSalesListPage() {
  const { sales, loading, refetch } = usePOSSales();
  const { profile } = useAuth();
  const { settings } = useCompanySettings();
  const confirm = useConfirm();
  const isAdmin = profile?.role === 'admin';
  // Default to All time so the list always shows every bill; month is an optional filter.
  const [month, setMonth] = useState<string>('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
      paymentMode: s.payment_mode || 'cash',
      amountReceived: s.amount_received || s.total_amount || 0,
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

            <div className="text-sm text-right whitespace-nowrap">
              <span className="text-muted-foreground">{filtered.length} sale{filtered.length !== 1 ? 's' : ''} · </span>
              <span className="font-semibold text-foreground">{fmt(total)}</span>
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
                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/40 transition-colors">
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
                        <td className="px-3 py-2.5 text-right font-semibold">{fmt(s.total_amount)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
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
    </div>
  );
}
