'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Printer, ShoppingCart, Receipt, ShoppingBag, X, Loader2, BookOpen } from 'lucide-react';
import { useCMYKJobLogs, usePOSSales, useCMYKExpenses, useCMYKPaperPurchases } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type LogEntry = {
  id: string;
  type: 'print' | 'pos' | 'expense' | 'purchase';
  date: string;
  title: string;
  subtitle: string;
  detail: string;
  amount: number;
  amountColor?: string;
  badge?: string;
  badgeColor?: string;
};

export default function CMYKJobLogPage() {
  const { logs, loading: logsLoading } = useCMYKJobLogs();
  const { sales, loading: salesLoading } = usePOSSales();
  const { expenses, loading: expLoading } = useCMYKExpenses();
  const { purchases, loading: purLoading } = useCMYKPaperPurchases();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'print' | 'pos' | 'expense' | 'purchase'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loading = logsLoading || salesLoading || expLoading || purLoading;

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const allEntries: LogEntry[] = useMemo(() => {
    const entries: LogEntry[] = [];

    (logs || []).forEach(l => entries.push({
      id: l.id, type: 'print',
      date: l.completed_at || l.created_at,
      title: l.job_number || 'Print Job',
      subtitle: `${l.client_name || '—'} · ${l.project_name || '—'}`,
      detail: `${l.sheets_used} sheets · ${l.paper_name || '—'} · By ${l.operator_name || '—'}`,
      amount: l.paper_cost,
      amountColor: 'text-foreground',
      badge: 'Printed', badgeColor: 'bg-blue-100 text-blue-700',
    }));

    (sales || []).forEach(s => entries.push({
      id: s.id, type: 'pos',
      date: s.created_at,
      title: s.sale_number,
      subtitle: s.customer_name || 'Walk-in customer',
      detail: `${s.payment_mode?.toUpperCase()} · ${s.payment_status || 'paid'}`,
      amount: s.total_amount,
      amountColor: 'text-green-700',
      badge: 'POS Sale', badgeColor: 'bg-green-100 text-green-700',
    }));

    (expenses || []).forEach(e => entries.push({
      id: e.id, type: 'expense',
      date: e.expense_date + 'T00:00:00',
      title: e.category.charAt(0).toUpperCase() + e.category.slice(1),
      subtitle: e.description || 'Operational expense',
      detail: new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      amount: -e.amount,
      amountColor: 'text-destructive',
      badge: 'Expense', badgeColor: 'bg-amber-100 text-amber-700',
    }));

    (purchases || []).forEach(p => entries.push({
      id: p.id, type: 'purchase',
      date: p.purchase_date + 'T00:00:00',
      title: p.paper_name || 'Paper Purchase',
      subtitle: p.vendor_name || 'Supplier',
      detail: `${p.quantity} ${p.unit} × ₹${p.rate} · ${p.payment_status}`,
      amount: -p.grand_total,
      amountColor: 'text-destructive',
      badge: 'Purchase', badgeColor: 'bg-purple-100 text-purple-700',
    }));

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, sales, expenses, purchases]);

  const filtered = allEntries.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.subtitle.toLowerCase().includes(q) && !e.detail.toLowerCase().includes(q)) return false;
    }
    const eDate = e.date.split('T')[0];
    if (dateFrom && eDate < dateFrom) return false;
    if (dateTo && eDate > dateTo) return false;
    return true;
  });

  const typeIcon = (type: string) => {
    if (type === 'print') return <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0"><Printer className="w-4 h-4 text-blue-700" /></div>;
    if (type === 'pos') return <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0"><ShoppingCart className="w-4 h-4 text-green-700" /></div>;
    if (type === 'expense') return <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0"><Receipt className="w-4 h-4 text-amber-700" /></div>;
    return <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center flex-shrink-0"><ShoppingBag className="w-4 h-4 text-purple-700" /></div>;
  };

  const totalRevenue = filtered.filter(e => e.type === 'pos').reduce((s, e) => s + Math.abs(e.amount), 0);
  const totalCosts = filtered.filter(e => e.type !== 'pos' && e.type !== 'print').reduce((s, e) => s + Math.abs(e.amount), 0);
  const paperCosts = filtered.filter(e => e.type === 'print').reduce((s, e) => s + Math.abs(e.amount), 0);

  // Group by date
  const grouped: Record<string, LogEntry[]> = {};
  filtered.forEach(e => {
    const day = e.date.split('T')[0];
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  });
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const clearFilters = () => { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-muted rounded-md border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">CMYK Job Log</h1>
            <p className="text-sm text-muted-foreground">All activity — jobs, sales, expenses, purchases</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">POS Revenue</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Paper Used (cost)</p>
          <p className="text-lg font-bold">{formatCurrency(paperCosts)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Expenses + Purchases</p>
          <p className="text-lg font-bold text-destructive">{formatCurrency(totalCosts)}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search jobs, sales, expenses..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-border rounded-md text-sm bg-background w-60 focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1">
          {(['all', 'print', 'pos', 'expense', 'purchase'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {t === 'all' ? 'All' : t === 'print' ? '🖨️ Print' : t === 'pos' ? '🛒 POS' : t === 'expense' ? '📋 Expense' : '📦 Purchase'}
            </button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        <span className="text-muted-foreground text-xs">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        {(search || typeFilter !== 'all' || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" />Clear</Button>
        )}
      </div>

      {/* Log */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading activity log...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No entries found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map(day => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {new Date(day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{grouped[day].length} entries</span>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {grouped[day].map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                        {typeIcon(entry.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{entry.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${entry.badgeColor}`}>{entry.badge}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{entry.subtitle}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`text-sm font-semibold ${entry.amountColor}`}>
                            {entry.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(entry.amount))}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
