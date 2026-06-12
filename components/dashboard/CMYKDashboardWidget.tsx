'use client';

import Link from 'next/link';
import { Printer, ShoppingCart, Package, AlertTriangle, ArrowRight, IndianRupee } from 'lucide-react';
import { useCMYKJobLogs, usePOSSales, usePaperStock, useCMYKPaperPurchases } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function CMYKDashboardWidget() {
  const { logs } = useCMYKJobLogs();
  const { sales } = usePOSSales();
  const { stock } = usePaperStock();
  const { purchases } = useCMYKPaperPurchases();

  const today = new Date().toDateString();

  const todayJobs = (logs || []).filter(l =>
    l.status === 'completed' && new Date(l.completed_at || l.created_at).toDateString() === today
  );
  const todayRevenue = (sales || []).filter(s =>
    new Date(s.created_at).toDateString() === today
  ).reduce((sum, s) => sum + s.total_amount, 0);

  const todaySheets = todayJobs.reduce((sum, l) => sum + l.sheets_used, 0);
  const lowStock = (stock || []).filter(s => s.quantity <= s.reorder_level);
  const supplierDues = (purchases || [])
    .filter(p => p.payment_status !== 'paid')
    .reduce((s, p) => s + (p.grand_total - p.amount_paid), 0);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Printer className="h-4 w-4" /> CMYK Print Station — Today
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
            <Link href="/admin/cmyk-print" className="flex items-center gap-1">
              Open Station <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="bg-muted rounded-md p-3 text-center">
            <p className="text-xl font-bold">{todayJobs.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Jobs Printed</p>
          </div>
          <div className="bg-muted rounded-md p-3 text-center">
            <p className="text-xl font-bold">{todaySheets.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sheets Used</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-md p-3 text-center">
            <p className="text-xl font-bold text-green-700">{formatCurrency(todayRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">POS Revenue</p>
          </div>
          <div className={`rounded-md p-3 text-center ${supplierDues > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-muted'}`}>
            <p className={`text-xl font-bold ${supplierDues > 0 ? 'text-amber-700' : ''}`}>{formatCurrency(supplierDues)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Supplier Dues</p>
          </div>
        </div>

        {/* Today's printed jobs */}
        {todayJobs.length > 0 && (
          <div className="space-y-1 mb-3">
            {todayJobs.slice(0, 3).map(log => (
              <div key={log.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-muted/50">
                <span className="font-medium">{log.job_number}</span>
                <span className="text-muted-foreground">{log.client_name}</span>
                <span>{log.sheets_used} sheets · {log.paper_name}</span>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-100">Done</Badge>
              </div>
            ))}
            {todayJobs.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">+{todayJobs.length - 3} more jobs today</p>
            )}
          </div>
        )}

        {/* Low stock warning */}
        {lowStock.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive flex-1">
              {lowStock.length} paper stock item{lowStock.length > 1 ? 's' : ''} low — {lowStock.slice(0, 2).map(s => s.name).join(', ')}{lowStock.length > 2 ? '...' : ''}
            </p>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" asChild>
              <Link href="/admin/cmyk-print/paper-stock">View</Link>
            </Button>
          </div>
        )}

        {/* Quick links */}
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" className="text-xs h-7" asChild>
            <Link href="/admin/cmyk-print/job-log">Job Log</Link>
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" asChild>
            <Link href="/admin/cmyk-print/overview">Monthly P&L</Link>
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" asChild>
            <Link href="/admin/cmyk-print/paper-purchases">Supplier Dues</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
