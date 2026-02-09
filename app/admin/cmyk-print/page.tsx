'use client';

import Link from 'next/link';
import { Printer, ShoppingCart, Package, ListTodo, TrendingUp, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useJobs, usePaperStock, usePOSSales } from '@/lib/hooks';
import { Job, PaperStock, POSSale } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';

export default function CMYKPrintPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading } = useJobs({
    orderBy: { column: 'created_at', ascending: false }
  });
  const { stock, loading: stockLoading } = usePaperStock();
  const { sales, loading: salesLoading } = usePOSSales();

  const loading = jobsLoading || stockLoading || salesLoading;

  // Filter Data
  const pendingJobs = jobs.filter(j =>
    ['new', 'designing', 'printing', 'finishing'].includes(j.current_stage) && !j.vendor_id
  ).slice(0, 5);

  const completedTodayJobs = jobs.filter(j =>
    (j.current_stage === 'delivered' || j.current_stage === 'ready' || j.current_stage === 'dispatched') && !j.vendor_id
    // In a real app, check date
  );

  const lowStockItems = stock.filter(s => s.quantity <= s.reorder_level).slice(0, 5);

  const todaysSalesTotal = sales
    // .filter(s => isToday(s.created_at)) // simplifying for now
    .slice(0, 10) // just taking recent
    .reduce((sum, s) => sum + s.total_amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const stats = [
    { label: 'Recent POS Sales', value: formatCurrency(todaysSalesTotal), change: 'Last 10 sales', icon: TrendingUp, color: 'bg-white0' },
    { label: 'Pending Jobs', value: pendingJobs.length.toString(), change: 'In Queue', icon: Clock, color: 'bg-white0' },
    { label: 'Completed Recently', value: completedTodayJobs.length.toString(), change: 'Jobs done', icon: CheckCircle, color: 'bg-primary' },
    { label: 'Stock Alerts', value: lowStockItems.length.toString(), change: 'Items low', icon: Package, color: 'bg-red-500' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'printing': return 'bg-muted text-foreground';
      case 'finishing': return 'bg-gray-900 text-white';
      case 'ready': return 'bg-gray-100 text-gray-900';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-3 md:space-y-6 px-2 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
        <div>
          <h1 className="text-page-title text-gray-900">CMYK Print Station</h1>
          <p className="text-gray-500">Welcome, {profile?.full_name || 'Operator'} | Ready for Production</p>
        </div>
        <DriveConnectionStatus />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 lg:p-4 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-page-title text-gray-900">
              {loading ? '...' : stat.value}
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-1">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-2">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">

        <Link href="/admin/cmyk-print/retail-pos" className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100  transition-shadow group">
          <div className="flex items-center gap-2 md:gap-4 mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-6 h-6 text-gray-900" />
            </div>
            <div>
              <h2 className="text-section text-gray-900">Retail POS</h2>
              <p className="text-sm text-gray-500">Quick billing</p>
            </div>
          </div>
          <div className="text-sm text-gray-900">● Open Counter →</div>
        </Link>

        <Link href="/admin/cmyk-print/paper-stock" className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100  transition-shadow group">
          <div className="flex items-center gap-2 md:gap-4 mb-4">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h2 className="text-section text-gray-900">Paper Stock</h2>
              <p className="text-sm text-gray-500">Inventory</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 text-sm">
            <span className={lowStockItems.length > 0 ? "text-red-600 font-medium" : "text-gray-500"}>
              ● {lowStockItems.length} Low
            </span>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Recent Sales */}
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section text-gray-900">Recent Sales</h2>
            <Link href="/admin/cmyk-print/retail-pos" className="text-sm text-primary hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {sales.length === 0 ? (
              <div className="text-center text-gray-400 py-4">No recent sales.</div>
            ) : sales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{sale.sale_number}</span>
                    <span className="text-xs text-gray-400">{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-gray-600">{sale.customer_name || 'Walk-in'}</p>
                </div>
                <p className="font-semibold text-gray-900">{formatCurrency(sale.total_amount)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Jobs */}
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section text-gray-900">Pending Jobs</h2>
            <Link href="/admin/jobs/queue" className="text-sm text-primary hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {pendingJobs.length === 0 ? (
              <div className="text-center text-gray-400 py-4">No pending jobs.</div>
            ) : pendingJobs.map((job) => (
              <div key={job.id} className={`p-3 rounded-lg border ${job.priority === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{job.job_number}</span>
                    {job.priority === 'urgent' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Urgent</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(job.current_stage)}`}>
                    {job.current_stage}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{job.client?.company || job.client?.name}</p>
                <p className="text-xs text-gray-400">{job.project_name} • {job.quantity}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      <div className={`rounded-lg md:rounded-lg p-3 md:p-4 sm:p-4 border ${lowStockItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-green-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${lowStockItems.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Package className={`w-5 h-5 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-900'}`} />
            </div>
            <div>
              <h2 className={`text-base sm:text-section ${lowStockItems.length > 0 ? 'text-red-900' : 'text-green-900'}`}>
                {lowStockItems.length > 0 ? 'Low Stock Alert' : 'Stock Levels Good'}
              </h2>
              <p className={`text-sm ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {lowStockItems.length > 0 ? `${lowStockItems.length} items need restock` : 'All items are sufficiently stocked'}
              </p>
            </div>
          </div>
          <Link href="/admin/cmyk-print/paper-stock" className={`text-sm hover:underline font-medium ${lowStockItems.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            Manage Stock →
          </Link>
        </div>
        {lowStockItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {lowStockItems.map((item, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg">
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-red-600">
                  {item.quantity} {item.unit} left
                  <span className="text-gray-400 ml-1">(min: {item.reorder_level})</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
