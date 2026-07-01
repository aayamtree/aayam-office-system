'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ShoppingBag, Receipt } from 'lucide-react';
import { usePOSSales } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// YYYY-MM for the current month (local time)
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function POSSalesListPage() {
  const { sales, loading } = usePOSSales();
  const [month, setMonth] = useState<string>(currentMonth());
  const [query, setQuery] = useState('');

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
