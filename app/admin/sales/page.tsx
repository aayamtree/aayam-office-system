'use client';

import Link from 'next/link';
import { ShoppingCart, FileText, Users, TrendingUp, IndianRupee, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useDashboardStats, useJobs, useLeads, useQuotations } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { isClosedStatus } from '@/lib/lead-status';

export default function SalesPage() {
  const { stats: dashboardStats, loading: statsLoading } = useDashboardStats();
  const { jobs: recentJobs, loading: jobsLoading } = useJobs({ limit: 5 });
  const { leads, loading: leadsLoading } = useLeads();
  const { quotations, loading: quotesLoading } = useQuotations();

  const loading = statsLoading || jobsLoading || leadsLoading || quotesLoading;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const activeLeadsCount = leads.filter(l => !isClosedStatus(l.status)).length;
  const pendingQuotesCount = quotations.filter(q => q.status === 'draft' || q.status === 'sent' || q.status === 'viewed').length;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-muted text-foreground', 'designing': 'bg-primary/10 text-primary',
      'production': 'bg-amber-100 text-amber-700', 'printing': 'bg-amber-100 text-amber-700',
      'finishing': 'bg-orange-100 text-orange-700', 'qc': 'bg-pink-100 text-pink-700',
      'ready': 'bg-muted text-foreground', 'completed': 'bg-muted text-foreground',
      'delivered': 'bg-muted text-muted-foreground'
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const pipelineStats = dashboardStats.pipeline || {};
  const totalInPipeline = Object.values(pipelineStats).reduce((a, b) => a + b, 0) || 1;

  // Buckets group the unified pipeline (lib/job-workflow.ts) for a compact sales view
  const pipeline = [
    { stage: 'Design', count: (pipelineStats.new || 0) + (pipelineStats.designing || 0) + (pipelineStats.approval || 0) + (pipelineStats.pre_print_qc || 0) + (pipelineStats.print_file_ready || 0) + (pipelineStats.file_sent_client || 0), color: 'bg-primary' },
    { stage: 'Production', count: (pipelineStats.file_received || 0) + (pipelineStats.file_check || 0) + (pipelineStats.ready_to_print || 0) + (pipelineStats.printing || 0) + (pipelineStats.material_received || 0) + (pipelineStats.finishing || 0), color: 'bg-chart-2' },
    { stage: 'QC', count: pipelineStats.quality_check || 0, color: 'bg-chart-3' },
    { stage: 'Ready', count: (pipelineStats.ready || 0) + (pipelineStats.packed || 0), color: 'bg-chart-4' },
    { stage: 'Dispatched', count: (pipelineStats.dispatched || 0) + (pipelineStats.delivered || 0) + (pipelineStats.in_transit || 0), color: 'bg-muted-foreground' },
  ].map(p => ({ ...p, width: `${Math.max(5, (p.count / totalInPipeline) * 100)}%` }));

  const followUpsDue = dashboardStats.alerts?.followUpsDue || 0;
  const readyToDispatch = (pipelineStats?.ready || 0) + (pipelineStats?.packed || 0);

  const statCards = [
    { label: 'Total Jobs', value: dashboardStats.activeJobs.toString(), change: 'Active Now', icon: ShoppingCart },
    { label: 'Active Leads', value: activeLeadsCount.toString(), change: `${leads.length} total`, icon: Users },
    { label: 'Pending Quotes', value: pendingQuotesCount.toString(), change: `${quotations.length} total`, icon: FileText },
    { label: 'Total Revenue', value: formatCurrency(dashboardStats.totalRevenue), change: 'Lifetime', icon: IndianRupee },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Sales Overview</h1>
        <Button asChild>
          <Link href="/admin/sales/orders?new=true" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> New Order
          </Link>
        </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/sales/leads">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <Users className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Leads</CardTitle>
                  <p className="text-xs text-muted-foreground">{activeLeadsCount} active leads</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">View all leads →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sales/quotations">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <FileText className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Quotations</CardTitle>
                  <p className="text-xs text-muted-foreground">{pendingQuotesCount} pending</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">View all quotations →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sales/orders">
          <Card className="hover:shadow-sm transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Orders</CardTitle>
                  <p className="text-xs text-muted-foreground">{dashboardStats.activeJobs} active orders</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">View all orders →</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pipeline + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Order Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pipeline.map((item) => (
                <div key={item.stage} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.stage}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: item.width }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/admin/sales/orders">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentJobs.length === 0 ? <p className="text-muted-foreground text-center py-4 text-sm">No recent orders</p> : recentJobs.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{order.job_number}</p>
                      <p className="text-xs text-muted-foreground">{order.client?.company}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(order.total_amount)}</p>
                    <Badge variant="outline" className={`mt-1 text-xs ${getStatusColor(order.current_stage)}`}>
                      {order.current_stage}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href="/admin/sales/leads" className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 bg-destructive/10 rounded-md flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">Follow-ups</p>
                <p className="text-xs text-destructive">{followUpsDue} due today</p>
              </div>
            </Link>
            <Link href="/admin/sales/quotations" className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Quotations</p>
                <p className="text-xs text-primary">{pendingQuotesCount} pending review</p>
              </div>
            </Link>
            <Link href="/admin/dispatch" className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center shrink-0">
                <CheckCircle className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Ready</p>
                <p className="text-xs text-muted-foreground">{readyToDispatch} to dispatch</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
