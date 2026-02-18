'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Printer, ShoppingCart, Package, ListTodo, TrendingUp, Clock, CheckCircle, AlertTriangle, Loader2, Calculator, Lock, Unlock, RotateCcw } from 'lucide-react';
import { useJobs, usePaperStock, usePOSSales } from '@/lib/hooks';
import { Job, PaperStock, POSSale } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import DashboardGrid, { LayoutsMap, resetLayouts } from '@/components/dashboard/DashboardGrid';

const STORAGE_KEY = 'aayam-cmyk-layouts';

const DEFAULT_LAYOUTS: LayoutsMap = {
  lg: [
    { i: 'stat-sales', x: 0, y: 0, w: 3, h: 2 },
    { i: 'stat-pending', x: 3, y: 0, w: 3, h: 2 },
    { i: 'stat-completed', x: 6, y: 0, w: 3, h: 2 },
    { i: 'stat-stock', x: 9, y: 0, w: 3, h: 2 },
    { i: 'link-pos', x: 0, y: 2, w: 4, h: 3 },
    { i: 'link-paper', x: 4, y: 2, w: 4, h: 3 },
    { i: 'link-calc', x: 8, y: 2, w: 4, h: 3 },
    { i: 'recent-sales', x: 0, y: 5, w: 6, h: 5 },
    { i: 'pending-jobs', x: 6, y: 5, w: 6, h: 5 },
    { i: 'stock-alert', x: 0, y: 10, w: 12, h: 3 },
  ],
  md: [
    { i: 'stat-sales', x: 0, y: 0, w: 3, h: 2 },
    { i: 'stat-pending', x: 3, y: 0, w: 3, h: 2 },
    { i: 'stat-completed', x: 0, y: 2, w: 3, h: 2 },
    { i: 'stat-stock', x: 3, y: 2, w: 3, h: 2 },
    { i: 'link-pos', x: 0, y: 4, w: 3, h: 3 },
    { i: 'link-paper', x: 3, y: 4, w: 3, h: 3 },
    { i: 'link-calc', x: 0, y: 7, w: 6, h: 3 },
    { i: 'recent-sales', x: 0, y: 10, w: 6, h: 5 },
    { i: 'pending-jobs', x: 0, y: 15, w: 6, h: 5 },
    { i: 'stock-alert', x: 0, y: 20, w: 6, h: 3 },
  ],
  sm: [
    { i: 'stat-sales', x: 0, y: 0, w: 2, h: 2 },
    { i: 'stat-pending', x: 0, y: 2, w: 2, h: 2 },
    { i: 'stat-completed', x: 0, y: 4, w: 2, h: 2 },
    { i: 'stat-stock', x: 0, y: 6, w: 2, h: 2 },
    { i: 'link-pos', x: 0, y: 8, w: 2, h: 3 },
    { i: 'link-paper', x: 0, y: 11, w: 2, h: 3 },
    { i: 'link-calc', x: 0, y: 14, w: 2, h: 3 },
    { i: 'recent-sales', x: 0, y: 17, w: 2, h: 5 },
    { i: 'pending-jobs', x: 0, y: 22, w: 2, h: 5 },
    { i: 'stock-alert', x: 0, y: 27, w: 2, h: 3 },
  ],
};

export default function CMYKPrintPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading } = useJobs({
    filter: [{ column: 'current_stage', value: ['new', 'designing', 'printing', 'finishing', 'ready', 'dispatched', 'delivered'], op: 'in' }],
    orderBy: { column: 'created_at', ascending: false }
  });
  const { stock, loading: stockLoading } = usePaperStock();
  const { sales, loading: salesLoading } = usePOSSales();
  const [isLocked, setIsLocked] = useState(true);

  const loading = jobsLoading || stockLoading || salesLoading;

  const pendingJobs = jobs.filter(j => ['new', 'designing', 'printing', 'finishing'].includes(j.current_stage) && !j.vendor_id).slice(0, 5);
  const completedTodayJobs = jobs.filter(j => (j.current_stage === 'delivered' || j.current_stage === 'ready' || j.current_stage === 'dispatched') && !j.vendor_id);
  const lowStockItems = stock.filter(s => s.quantity <= s.reorder_level).slice(0, 5);
  const todaysSalesTotal = sales.slice(0, 10).reduce((sum, s) => sum + s.total_amount, 0);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const statCards = [
    { key: 'stat-sales', label: 'Recent POS Sales', value: formatCurrency(todaysSalesTotal), change: 'Last 10 sales', icon: TrendingUp, color: 'bg-white0' },
    { key: 'stat-pending', label: 'Pending Jobs', value: pendingJobs.length.toString(), change: 'In Queue', icon: Clock, color: 'bg-white0' },
    { key: 'stat-completed', label: 'Completed Recently', value: completedTodayJobs.length.toString(), change: 'Jobs done', icon: CheckCircle, color: 'bg-primary' },
    { key: 'stat-stock', label: 'Stock Alerts', value: lowStockItems.length.toString(), change: 'Items low', icon: Package, color: 'bg-red-500' },
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
    <div className="space-y-4 px-2 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
        <div>
          <h1 className="text-page-title text-gray-900">CMYK Print Station</h1>
          <p className="text-gray-500">Welcome, {profile?.full_name || 'Operator'} | Ready for Production</p>
        </div>
        <div className="flex items-center gap-2">
          <DriveConnectionStatus />
          {!isLocked && (
            <button onClick={() => { resetLayouts(STORAGE_KEY); window.location.reload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <button onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${isLocked ? 'border border-gray-200 hover:bg-gray-50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      </div>

      <DashboardGrid defaultLayouts={DEFAULT_LAYOUTS} isLocked={isLocked} storageKey={STORAGE_KEY}>
        {/* Stat Cards */}
        {statCards.map((stat) => (
          <div key={stat.key} className="h-full">
            <div className="bg-white rounded-lg p-4 border border-gray-100 h-full flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}><stat.icon className="w-5 h-5 text-white" /></div>
              </div>
              <p className="text-page-title text-gray-900">{loading ? '...' : stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              <p className="text-xs text-gray-400 mt-2">{stat.change}</p>
            </div>
          </div>
        ))}

        {/* Quick Links */}
        <div key="link-pos" className="h-full">
          <Link href="/admin/cmyk-print/retail-pos" className="bg-white rounded-lg p-4 border border-gray-100 transition-shadow group h-full flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"><ShoppingCart className="w-6 h-6 text-gray-900" /></div>
              <div><h2 className="text-section text-gray-900">Retail POS</h2><p className="text-sm text-gray-500">Quick billing</p></div>
            </div>
            <div className="text-sm text-gray-900">● Open Counter →</div>
          </Link>
        </div>

        <div key="link-paper" className="h-full">
          <Link href="/admin/cmyk-print/paper-stock" className="bg-white rounded-lg p-4 border border-gray-100 transition-shadow group h-full flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"><Package className="w-6 h-6 text-foreground" /></div>
              <div><h2 className="text-section text-gray-900">Paper Stock</h2><p className="text-sm text-gray-500">Inventory</p></div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={lowStockItems.length > 0 ? "text-red-600 font-medium" : "text-gray-500"}>● {lowStockItems.length} Low</span>
            </div>
          </Link>
        </div>

        <div key="link-calc" className="h-full">
          <Link href="/admin/cmyk-print/cost-calculator" className="bg-white rounded-lg p-4 border border-gray-100 transition-shadow group h-full flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"><Calculator className="w-6 h-6 text-amber-700" /></div>
              <div><h2 className="text-section text-gray-900">Cost Calculator</h2><p className="text-sm text-gray-500">Paper costing</p></div>
            </div>
            <div className="text-sm text-gray-900">● Estimate Costs →</div>
          </Link>
        </div>

        {/* Recent Sales */}
        <div key="recent-sales" className="h-full">
          <div className="bg-white rounded-lg p-4 border border-gray-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-section text-gray-900">Recent Sales</h2>
              <Link href="/admin/cmyk-print/retail-pos" className="text-sm text-primary hover:underline">View All →</Link>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {sales.length === 0 ? <div className="text-center text-gray-400 py-4">No recent sales.</div> : sales.slice(0, 5).map((sale) => (
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
        </div>

        {/* Pending Jobs */}
        <div key="pending-jobs" className="h-full">
          <div className="bg-white rounded-lg p-4 border border-gray-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-section text-gray-900">Pending Jobs</h2>
              <Link href="/admin/jobs/queue" className="text-sm text-primary hover:underline">View All →</Link>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {pendingJobs.length === 0 ? <div className="text-center text-gray-400 py-4">No pending jobs.</div> : pendingJobs.map((job) => (
                <div key={job.id} className={`p-3 rounded-lg border ${job.priority === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{job.job_number}</span>
                      {job.priority === 'urgent' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Urgent</span>}
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(job.current_stage)}`}>{job.current_stage}</span>
                  </div>
                  <p className="text-sm text-gray-600">{job.client?.company || job.client?.name}</p>
                  <p className="text-xs text-gray-400">{job.project_name} • {job.quantity}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stock Alert */}
        <div key="stock-alert" className="h-full">
          <div className={`rounded-lg p-4 border h-full flex flex-col ${lowStockItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-green-200'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${lowStockItems.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <Package className={`w-5 h-5 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-900'}`} />
                </div>
                <div>
                  <h2 className={`text-section ${lowStockItems.length > 0 ? 'text-red-900' : 'text-green-900'}`}>{lowStockItems.length > 0 ? 'Low Stock Alert' : 'Stock Levels Good'}</h2>
                  <p className={`text-sm ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStockItems.length > 0 ? `${lowStockItems.length} items need restock` : 'All items are sufficiently stocked'}</p>
                </div>
              </div>
              <Link href="/admin/cmyk-print/paper-stock" className={`text-sm hover:underline font-medium ${lowStockItems.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>Manage Stock →</Link>
            </div>
            {lowStockItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1">
                {lowStockItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-red-600">{item.quantity} {item.unit} left <span className="text-gray-400 ml-1">(min: {item.reorder_level})</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardGrid>
    </div>
  );
}
