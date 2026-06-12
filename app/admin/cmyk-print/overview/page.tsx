'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Package, AlertTriangle, Layers } from 'lucide-react';
import { useCMYKMonthlyOverview, usePaperStock } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CMYKOverviewPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { overview, loading } = useCMYKMonthlyOverview(year, month);
  const { stock } = usePaperStock();

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const formatNum = (n: number) => (n || 0).toLocaleString('en-IN');

  const totalRevenue = (overview?.total_revenue || 0) + (overview?.pending_revenue || 0);
  const totalCosts = (overview?.total_expenses || 0) + (overview?.paper_cost || 0);
  const netProfit = (overview?.total_revenue || 0) - totalCosts;
  const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';
  const lowStock = stock.filter(s => s.quantity <= s.reorder_level);

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-muted rounded-md border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Monthly Overview</h1>
            <p className="text-sm text-muted-foreground">Profit & loss summary</p>
          </div>
        </div>
        {/* Month/Year Selector */}
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted animate-pulse rounded-md" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Revenue</CardTitle>
                <IndianRupee className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                {(overview?.pending_revenue || 0) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">{formatCurrency(overview!.pending_revenue)} pending</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Costs</CardTitle>
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalCosts)}</div>
                <p className="text-xs text-muted-foreground mt-1">Paper + Operations</p>
              </CardContent>
            </Card>

            <Card className={netProfit >= 0 ? 'border-green-200' : 'border-destructive/30'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Net Profit</CardTitle>
                <TrendingUp className={`w-4 h-4 ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-destructive'}`}>
                  {formatCurrency(netProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Margin: {margin}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Transactions</CardTitle>
                <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNum(overview?.total_transactions || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">POS sales</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Collected</span>
                  <span className="text-sm font-semibold text-green-700">{formatCurrency(overview?.total_revenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Outstanding (credit)</span>
                  <span className="text-sm font-semibold text-amber-600">{formatCurrency(overview?.pending_revenue || 0)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium">Total Billed</span>
                  <span className="text-sm font-bold">{formatCurrency(totalRevenue)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Paper Cost</span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(overview?.paper_cost || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Operational</span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(overview?.total_expenses || 0)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium">Total Costs</span>
                  <span className="text-sm font-bold text-destructive">{formatCurrency(totalCosts)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Paper Usage */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Paper Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Sheets Used</span>
                  <span className="text-sm font-semibold">{formatNum(overview?.sheets_used || 0)} sheets</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg per Sale</span>
                  <span className="text-sm font-semibold">
                    {overview?.total_transactions ? Math.round((overview.sheets_used || 0) / overview.total_transactions) : 0} sheets
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paper Cost</span>
                  <span className="text-sm font-semibold">{formatCurrency(overview?.paper_cost || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alert */}
          {lowStock.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Low Stock Alert — {lowStock.length} item{lowStock.length > 1 ? 's' : ''} need restock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {lowStock.map(item => (
                    <Badge key={item.id} variant="destructive" className="text-xs">
                      {item.name}: {item.quantity} {item.unit} left
                    </Badge>
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
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/cmyk-print/retail-pos">→ Open POS</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/cmyk-print/expenses">→ Add Expense</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/cmyk-print/paper-stock">→ Manage Stock</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
