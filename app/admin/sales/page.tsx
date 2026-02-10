'use client';

import Link from 'next/link';
import { ShoppingCart, FileText, Users, TrendingUp, IndianRupee, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useDashboardStats, useJobs, useLeads, useQuotations } from '@/lib/hooks';

export default function SalesPage() {
  // Use multiple hooks to gather data for this overview
  // In a production app with high scale, we'd creating a dedicated RPC or 'useSalesStats' hook
  const { stats: dashboardStats, loading: statsLoading } = useDashboardStats();
  const { jobs: recentJobs, loading: jobsLoading } = useJobs({ limit: 5 });
  const { leads, loading: leadsLoading } = useLeads();
  const { quotations, loading: quotesLoading } = useQuotations();

  const loading = statsLoading || jobsLoading || leadsLoading || quotesLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const activeLeadsCount = leads.filter(l => l.status !== 'converted' && l.status !== 'lost').length;
  // Approximation for "Active" vs "Pending"
  const pendingQuotesCount = quotations.filter(q => q.status === 'draft' || q.status === 'sent' || q.status === 'viewed').length;

  const stats = [
    { label: 'Total Jobs', value: dashboardStats.activeJobs.toString(), change: 'Active Now', icon: ShoppingCart, color: 'bg-primary' },
    { label: 'Active Leads', value: activeLeadsCount.toString(), change: `${leads.length} total`, icon: Users, color: 'bg-white0' },
    { label: 'Pending Quotes', value: pendingQuotesCount.toString(), change: `${quotations.length} total`, icon: FileText, color: 'bg-muted0' },
    { label: 'Total Revenue', value: formatCurrency(dashboardStats.totalRevenue), change: 'Lifetime', icon: IndianRupee, color: 'bg-white0' },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-muted text-foreground',
      'designing': 'bg-gray-900 text-white',
      'production': 'bg-amber-100 text-amber-700',
      'printing': 'bg-amber-100 text-amber-700',
      'finishing': 'bg-orange-100 text-orange-700',
      'qc': 'bg-pink-100 text-pink-700',
      'ready': 'bg-gray-100 text-gray-900',
      'completed': 'bg-gray-100 text-gray-900',
      'delivered': 'bg-gray-100 text-gray-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // Pipeline Data - Dynamic from DashboardStats
  const pipelineStats = dashboardStats.pipeline || {};
  const totalInPipeline = Object.values(pipelineStats).reduce((a, b) => a + b, 0) || 1; // avoid divide by zero

  const pipeline = [
    { stage: 'Design', count: (pipelineStats.designing || 0) + (pipelineStats.approval || 0), color: 'bg-white0' },
    { stage: 'Production', count: (pipelineStats.printing || 0) + (pipelineStats.finishing || 0), color: 'bg-primary' },
    { stage: 'QC', count: pipelineStats.quality_check || 0, color: 'bg-muted0' },
    { stage: 'Ready', count: (pipelineStats.ready || 0) + (pipelineStats.packed || 0), color: 'bg-white0' },
    { stage: 'Dispatched', count: (pipelineStats.dispatched || 0) + (pipelineStats.in_transit || 0), color: 'bg-gray-500' },
  ].map(p => ({
    ...p,
    width: `${Math.max(5, (p.count / totalInPipeline) * 100)}%`
  }));

  const followUpsDue = dashboardStats.alerts?.followUpsDue || 0;
  const readyToDispatch = (pipelineStats?.ready || 0) + (pipelineStats?.packed || 0);

  return (
    <div className="space-y-3 md:space-y-6 lg:space-y-8 animate-fade-in px-2 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h1 className="text-page-title text-gray-900 tracking-tight">Sales Overview</h1>
          <p className="text-gray-500 mt-1">Manage leads, quotations, and orders</p>
        </div>
        <Link
          href="/admin/sales/orders?new=true"
          className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg -900/20 transition-all hover:scale-105 active:scale-95 font-medium"
        >
          <ShoppingCart size={20} />
          <span>New Order</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg p-5 border border-gray-100 transition-shadow  group">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <stat.icon size={22} className="text-white" />
              </div>
            </div>
            <p className="text-page-title text-gray-900">
              {loading ? '...' : stat.value}
            </p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
            <p className="text-label text-gray-500 mt-2 bg-gray-100 w-fit px-2 py-1 rounded-full">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Link href="/admin/sales/leads" className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100  hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center gap-2 md:gap-4 mb-4">
            <div className="w-14 h-14 bg-amber-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={28} className="text-destructive" />
            </div>
            <div>
              <h2 className="text-section text-gray-900">Leads</h2>
              <p className="text-sm font-medium text-gray-500">{activeLeadsCount} active leads</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-label text-gray-500">
            <span>View all leads &rarr;</span>
          </div>
        </Link>

        <Link href="/admin/sales/quotations" className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100  hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center gap-2 md:gap-4 mb-4">
            <div className="w-14 h-14 bg-gray-900 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText size={28} className="text-primary" />
            </div>
            <div>
              <h2 className="text-section text-gray-900">Quotations</h2>
              <p className="text-sm font-medium text-gray-500">{pendingQuotesCount} pending</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-label text-gray-500">
            <span>View all quotations &rarr;</span>
          </div>
        </Link>

        <Link href="/admin/sales/orders" className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100  hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center gap-2 md:gap-4 mb-4">
            <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingCart size={28} className="text-foreground" />
            </div>
            <div>
              <h2 className="text-section text-gray-900">Orders</h2>
              <p className="text-sm font-medium text-gray-500">{dashboardStats.activeJobs} active orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-label text-gray-500">
            <span>View all orders &rarr;</span>
          </div>
        </Link>
      </div>

      {/* Order Pipeline & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Order Pipeline */}
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center gap-3 mb-3 md:mb-1.5">
            <div className="w-1 h-6 bg-muted0 rounded-full"></div>
            <h2 className="text-section text-gray-900">Order Pipeline</h2>
          </div>
          <div className="space-y-5">
            {pipeline.map((item) => (
              <div key={item.stage} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{item.stage}</span>
                  <span className="font-bold text-gray-900">{item.count}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: item.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3 md:mb-1.5">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-gray-900 rounded-full"></div>
              <h2 className="text-section text-gray-900">Recent Orders</h2>
            </div>
            <Link href="/admin/sales/orders" className="text-sm font-medium text-primary hover:text-primary bg-muted px-3 py-1.5 rounded-lg transition-colors">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentJobs.length === 0 ? <p className="text-gray-500 text-center py-4">No recent orders</p> : recentJobs.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3.5 bg-gray-50/80 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg border border-gray-100">
                    <ShoppingCart size={16} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{order.job_number}</p>
                    <p className="text-label text-gray-500">{order.client?.company}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCurrency(order.total_amount)}</p>
                  <span className={`inline-block px-2 py-0.5 text-xs uppercase font-bold tracking-wider rounded-full mt-1 ${getStatusColor(order.current_stage)}`}>
                    {order.current_stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
        <div className="flex items-center gap-3 mb-3 md:mb-1.5">
          <div className="w-1 h-6 bg-white0 rounded-full"></div>
          <h2 className="text-section text-gray-900">Pending Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
          <Link href="/admin/sales/leads" className="flex items-center gap-2 md:gap-4 p-4 bg-white/80 rounded-lg border border-gray-100 transition-colors hover:bg-amber-100 cursor-pointer">
            <div className="bg-white p-3 rounded-lg">
              <Clock size={24} className="text-destructive" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Follow-ups</p>
              <p className="text-sm font-medium text-amber-700 mt-0.5">{followUpsDue} due today</p>
            </div>
          </Link>
          <Link href="/admin/sales/quotations" className="flex items-center gap-2 md:gap-4 p-4 bg-muted/80 rounded-lg border border-gray-200 transition-colors hover:bg-gray-900 cursor-pointer">
            <div className="bg-white p-3 rounded-lg">
              <AlertCircle size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Quotations</p>
              <p className="text-sm font-medium text-primary mt-0.5">{pendingQuotesCount} pending review</p>
            </div>
          </Link>
          <Link href="/admin/dispatch" className="flex items-center gap-2 md:gap-4 p-4 bg-white/80 rounded-lg border border-green-100 transition-colors hover:bg-gray-100 cursor-pointer">
            <div className="bg-white p-3 rounded-lg">
              <CheckCircle size={24} className="text-gray-900" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Ready</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{readyToDispatch} to dispatch</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
