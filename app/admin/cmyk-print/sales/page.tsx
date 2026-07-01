'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ShoppingBag, Receipt, Trash2, Loader2 } from 'lucide-react';
import { usePOSSales } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function POSSalesListPage() {
  const { sales, loading, refetch } = usePOSSales();
  const { profile } = useAuth();
  const confirm = useConfirm();
  const isAdmin = profile?.role === 'admin';
  // Default to All time so the list always shows every bill; month is an optional filter.
  const [month, setMonth] = useState<string>('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (sale: any) => {
    const { confirmed, inputValue } = await confirm({
      title: `Delete bill ${sale.sale_number}?`,
      message: `This permanently removes the bill (${sale.customer_name || 'Walk-in'} — ₹${sale.total_amount}) and returns any paper sheets to stock. This cannot be undone.\n\nType "Delete" below to confirm.`,
      variant: 'danger',
      confirmLabel: 'Delete bill',
      showInput: true,
      inputRequired: true,
      inputPlaceholder: 'Type Delete to confirm',
    });
    if (!confirmed) return;
    if ((inputValue || '').trim().toLowerCase() !== 'delete') {
      toast.error('You must type "Delete" to confirm. Bill was not deleted.');
      return;
    }

    setDeletingId(sale.id);
    try {
      const res = await fetch(`/api/cmyk-print/sales/${sale.id}`, { method: 'DELETE' });
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
                    {isAdmin && <th className="px-3 py-2 font-medium text-right">Action</th>}
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
                        {isAdmin && (
                          <td className="px-3 py-2.5 text-right">
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
                          </td>
                        )}
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
