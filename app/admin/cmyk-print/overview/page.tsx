'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Package, AlertTriangle, Layers, Receipt } from 'lucide-react';
import { usePOSSales, useCMYKJobLogs, useCMYKExpenses, usePaperStock } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CMYKOverviewPage() {
  const now = new Date();
  const [period, setPeriod] = useState<'today' | 'month'>('today');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { sales, loading: salesLoading } = usePOSSales();
  const { logs } = useCMYKJobLogs();
  const { expenses } = useCMYKExpenses();
  const { stock } = usePaperStock();

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const formatNum = (n: number) => (n || 0).toLocaleString('en-IN');

  // Period predicate
  const inPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (period === 'today') return d.toDateString() === now.toDateString();
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  };

  // Sales in period
  const periodSales = sales.filter(s => inPeriod(s.created_at));
  const taxableOf = (s: typeof periodSales[number]) => (s.subtotal || 0) - (s.discount_amount || 0);

  // Money actually in (incl. GST) — paid in full = bill total; advance = amount collected; credit = 0
  const collectedRevenue = periodSales.reduce((sum, s) => {
    if (s.payment_status === 'pending') return sum;
    if (s.payment_status === 'partial') return sum + (s.amount_received || 0);
    return sum + (s.total_amount || 0);
  }, 0);
  const pendingRevenue = periodSales
    .filter(s => s.payment_status === 'pending' || s.payment_status === 'partial')
    .reduce((sum, s) => sum + (s.balance_due ?? 0), 0);
  const totalBilled = periodSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const gstCollected = periodSales.reduce((sum, s) => sum + ((s as any).gst_amount || 0), 0);
  const taxableValue = periodSales.reduce((sum, s) => sum + taxableOf(s), 0);
  const transactions = periodSales.length;

  // Net sales for profit = ex-GST (GST is a pass-through to govt, not income)
  const salesExGst = periodSales.reduce((sum, s) => {
    if (s.payment_status === 'pending') return sum;
    if (s.payment_status === 'partial') {
      const ratio = (s.total_amount || 0) > 0 ? (s.amount_received || 0) / (s.total_amount || 1) : 0;
      return sum + taxableOf(s) * ratio;
    }
    return sum + taxableOf(s);
  }, 0);

  // Costs in period
  const periodLogs = logs.filter(l => inPeriod(l.completed_at || l.created_at));
  const paperCost = periodLogs.reduce((sum, l) => sum + (l.paper_cost || 0), 0);
  const sheetsUsed = periodLogs.reduce((sum, l) => sum + (l.sheets_used || 0), 0);
  const periodExpenses = (expenses || []).filter(e => inPeriod(e.expense_date));
  const operationalCost = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalCosts = paperCost + operationalCost;
  const netProfit = salesExGst - totalCosts;
  const margin = salesExGst > 0 ? ((netProfit / salesExGst) * 100).toFixed(1) : '0';

  const lowStock = stock.filter(s => s.quantity <= s.reorder_level);
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
  const loading = salesLoading;
  const periodLabel = period === 'today' ? 'Today' : `${MONTHS[month - 1]} ${year}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-muted rounded-md border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Money — Profit &amp; Loss</h1>
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        {/* Period toggle + month picker */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-md">
            <button onClick={() => setPeriod('today')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${period === 'today' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Today</button>
            <button onClick={() => setPeriod('month')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${period === 'month' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Month</button>
          </div>
          {period === 'month' && (
            <>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Revenue (collected)</CardTitle>
            <IndianRupee className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '…' : formatCurrency(collectedRevenue)}</div>
            {pendingRevenue > 0 && <p className="text-xs text-amber-600 mt-1">{formatCurrency(pendingRevenue)} pending</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Costs</CardTitle>
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '…' : formatCurrency(totalCosts)}</div>
            <p className="text-xs text-muted-foreground mt-1">Paper + Operations</p>
          </CardContent>
        </Card>

        <Card className={netProfit >= 0 ? 'border-green-200' : 'border-destructive/30'}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Net Profit</CardTitle>
            <TrendingUp className={`w-4 h-4 ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-destructive'}`}>{loading ? '…' : formatCurrency(netProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">Margin {margin}% · ex-GST</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">GST Collected</CardTitle>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '…' : formatCurrency(gstCollected)}</div>
            <p className="text-xs text-muted-foreground mt-1">Output tax payable</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Revenue Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Collected</span><span className="text-sm font-semibold text-green-700">{formatCurrency(collectedRevenue)}</span></div>
            <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Outstanding (credit)</span><span className="text-sm font-semibold text-amber-600">{formatCurrency(pendingRevenue)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between items-center"><span className="text-sm font-medium">Total Billed</span><span className="text-sm font-bold">{formatCurrency(totalBilled)}</span></div>
          </CardContent>
        </Card>

        {/* Cost */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Cost Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2"><Package className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Paper Cost</span></div>
              <span className="text-sm font-semibold">{formatCurrency(paperCost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Operational</span></div>
              <span className="text-sm font-semibold">{formatCurrency(operationalCost)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between items-center"><span className="text-sm font-medium">Total Costs</span><span className="text-sm font-bold text-destructive">{formatCurrency(totalCosts)}</span></div>
          </CardContent>
        </Card>

        {/* GST summary */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">GST Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Taxable Value</span><span className="text-sm font-semibold">{formatCurrency(taxableValue)}</span></div>
            <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">CGST</span><span className="text-sm font-semibold">{formatCurrency(gstCollected / 2)}</span></div>
            <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">SGST</span><span className="text-sm font-semibold">{formatCurrency(gstCollected / 2)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between items-center"><span className="text-sm font-medium">Total GST</span><span className="text-sm font-bold">{formatCurrency(gstCollected)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Transactions</CardTitle>
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNum(transactions)}</div>
            <p className="text-xs text-muted-foreground mt-1">POS sales · {periodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Paper Used</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNum(sheetsUsed)} <span className="text-sm font-normal text-muted-foreground">sheets</span></div>
            <p className="text-xs text-muted-foreground mt-1">Cost {formatCurrency(paperCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Low Stock — {lowStock.length} item{lowStock.length > 1 ? 's' : ''} need restock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(item => (
                <Badge key={item.id} variant="destructive" className="text-xs">{item.name}: {item.quantity} {item.unit} left</Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/admin/cmyk-print/paper-stock">Manage Stock →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild><Link href="/admin/cmyk-print/retail-pos">→ Open POS</Link></Button>
        <Button variant="outline" size="sm" asChild><Link href="/admin/cmyk-print/expenses">→ Add Expense</Link></Button>
        <Button variant="outline" size="sm" asChild><Link href="/admin/cmyk-print/paper-stock">→ Manage Stock</Link></Button>
      </div>
    </div>
  );
}
