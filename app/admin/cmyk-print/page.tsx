'use client';

import Link from 'next/link';
import { Printer, ShoppingCart, Package, Clock, CheckCircle, AlertTriangle, Calculator, BarChart2, Receipt } from 'lucide-react';
import { useJobs, usePaperStock, usePOSSales } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function CMYKPrintPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading } = useJobs({
    filter: [{ column: 'current_stage', value: ['new', 'designing', 'printing', 'finishing', 'ready', 'dispatched', 'delivered'], op: 'in' }],
    orderBy: { column: 'created_at', ascending: false }
  });
  const { stock, loading: stockLoading } = usePaperStock();
  const { sales, loading: salesLoading } = usePOSSales();

  const loading = jobsLoading || stockLoading || salesLoading;

  const pendingJobs = jobs.filter(j => ['new', 'designing', 'printing', 'finishing'].includes(j.current_stage) && !j.vendor_id).slice(0, 5);
  const completedTodayJobs = jobs.filter(j => (j.current_stage === 'delivered' || j.current_stage === 'ready' || j.current_stage === 'dispatched') && !j.vendor_id);
  const lowStockItems = stock.filter(s => s.quantity <= s.reorder_level).slice(0, 5);
  const todaysSalesTotal = sales.slice(0, 10).reduce((sum, s) => sum + s.total_amount, 0);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'printing': return 'bg-muted text-foreground';
      case 'finishing': return 'bg-primary/10 text-primary';
      case 'ready': return 'bg-muted text-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statCards = [
    { label: 'Recent POS Sales', value: formatCurrency(todaysSalesTotal), change: 'Last 10 sales', icon: ShoppingCart },
    { label: 'Pending Jobs', value: pendingJobs.length.toString(), change: 'In Queue', icon: Clock },
    { label: 'Completed Recently', value: completedTodayJobs.length.toString(), change: 'Jobs done', icon: CheckCircle },
    { label: 'Stock Alerts', value: lowStockItems.length.toString(), change: 'Items low', icon: Package },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">CMYK Print Station</h1>
          <p className="text-sm text-muted-foreground">Welcome, {profile?.full_name || profile?.email?.split('@')[0] || 'CMYK User'}</p>
        </div>
        <div className="w-fit">
          <DriveConnectionStatus />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Link href="/admin/cmyk-print/retail-pos">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Retail POS</CardTitle>
                  <p className="text-xs text-muted-foreground">Quick billing</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Open Counter →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/cmyk-print/paper-stock">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <Package className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Paper Stock</CardTitle>
                  <p className="text-xs text-muted-foreground">Inventory</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs">
                {lowStockItems.length > 0 ? (
                  <Badge variant="destructive">{lowStockItems.length} Low</Badge>
                ) : (
                  <Badge variant="outline">All Stocked</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/cmyk-print/cost-calculator">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <Calculator className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Cost Calculator</CardTitle>
                  <p className="text-xs text-muted-foreground">Paper costing</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Estimate Costs →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/cmyk-print/expenses">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Expenses</CardTitle>
                  <p className="text-xs text-muted-foreground">Daily costs</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Record Expenses →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/cmyk-print/overview">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <BarChart2 className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Monthly Overview</CardTitle>
                  <p className="text-xs text-muted-foreground">Profit & loss</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">View Report →</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Sales + Pending Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Sales</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/admin/cmyk-print/retail-pos">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sales.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No recent sales.</p> : sales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{sale.sale_number}</span>
                      <span className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{sale.customer_name || 'Walk-in'}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(sale.total_amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
              <span className="text-xs text-muted-foreground">In queue</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingJobs.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No pending jobs.</p> : pendingJobs.map((job) => (
                <div key={job.id} className={`p-3 rounded-md border ${job.priority === 'urgent' ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{job.job_number}</span>
                      {job.priority === 'urgent' && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
                    </div>
                    <Badge variant="outline" className={`text-xs ${getStatusColor(job.current_stage)}`}>{job.current_stage}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{job.client?.company || job.client?.name}</p>
                  <p className="text-xs text-muted-foreground">{job.project_name} • {job.quantity}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Alert */}
      <Card className={lowStockItems.length > 0 ? 'border-destructive/30 bg-destructive/5' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              {lowStockItems.length > 0 ? 'Low Stock Alert' : 'Stock Levels Good'}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link href="/admin/cmyk-print/paper-stock">Manage Stock</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {lowStockItems.length > 0 ? `${lowStockItems.length} items need restock` : 'All items are sufficiently stocked'}
          </p>
        </CardHeader>
        {lowStockItems.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lowStockItems.map((item, idx) => (
                <div key={idx} className="p-3 rounded-md bg-background border">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-destructive">{item.quantity} {item.unit} left <span className="text-muted-foreground ml-1">(min: {item.reorder_level})</span></p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
