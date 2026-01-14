'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Package,
  Printer,
  Truck,
  ArrowUpRight,
  Plus,
  AlertCircle,
  Check,
  Clock,
  CheckCircle,
  Receipt,
  Phone,
  Ban
} from 'lucide-react';
import { useDashboardStats, useJobs } from '@/lib/hooks';
import NotesWidget from '@/components/dashboard/NotesWidget';
import RemindersWidget from '@/components/dashboard/RemindersWidget';
import ActivityFeed from '@/components/dashboard/ActivityFeed';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const { stats: dashboardStats, loading: statsLoading } = useDashboardStats();
  const { jobs: recentJobs, loading: jobsLoading } = useJobs({
    limit: 5,
    orderBy: { column: 'created_at', ascending: false }
  });

  // Redirect Designers to their specific workspace
  useEffect(() => {
    if (profile?.role === 'designer') {
      router.replace('/admin/designers/tasks');
    }
  }, [profile, router]);

  // Prevent flash of admin content for designers
  if (profile?.role === 'designer') {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">Redirecting to workspace...</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Stat Cards Data
  const stats = [
    { label: 'Total Revenue', value: formatCurrency(dashboardStats.totalRevenue), subtext: 'Lifetime Invoice Total', positive: true, icon: TrendingUp },
    { label: 'Active Jobs', value: dashboardStats.activeJobs.toString(), change: '', positive: true, icon: Package },
    { label: 'Pending Payments', value: formatCurrency(dashboardStats.pendingPayments), subtext: 'Outstanding', icon: Printer },
    { label: 'Leads This Month', value: dashboardStats.leadsThisMonth.toString(), subtext: 'New Opportunities', urgent: false, icon: Truck },
  ];

  // Pipeline Data - Dynamic
  const pipeline = [
    { label: 'In Design', count: (dashboardStats.pipeline?.designing || 0) + (dashboardStats.pipeline?.approval || 0), color: 'bg-indigo-500', href: '/admin/designers/tasks?view=team_tasks', thresh: 10 },
    { label: 'Production', count: (dashboardStats.pipeline?.printing || 0) + (dashboardStats.pipeline?.finishing || 0), color: 'bg-amber-500', href: '/admin/jobs/queue', thresh: 15 },
    { label: 'QC Check', count: dashboardStats.pipeline?.quality_check || 0, color: 'bg-purple-500', href: '/admin/jobs?status=quality_check', thresh: 5 },
    { label: 'Ready/Packed', count: (dashboardStats.pipeline?.ready || 0) + (dashboardStats.pipeline?.packed || 0), color: 'bg-green-500', href: '/admin/dispatch', thresh: 20 },
    { label: 'Dispatched', count: (dashboardStats.pipeline?.dispatched || 0) + (dashboardStats.pipeline?.in_transit || 0), color: 'bg-blue-500', href: '/admin/dispatch/history', thresh: 999 },
  ];

  const totalPipeline = pipeline.reduce((acc, item) => acc + item.count, 0) || 1; // Avoid div by zero

  // Alerts - Dynamic with Sorting
  const alertsData = [
    {
      id: 'blocked',
      label: 'Blocked Jobs',
      count: dashboardStats.alerts?.blockedJobs || 0,
      priority: 0,
      href: '/admin/jobs?status=approval',
      activeText: `blocked (${dashboardStats.alerts?.blockedBreakdown?.feedback || 0} feedback, ${dashboardStats.alerts?.blockedBreakdown?.payment || 0} payment)`,
      emptyText: 'No blocked jobs',
      icon: <Ban size={20} />
    },
    {
      id: 'payments',
      label: 'Overdue Payments',
      count: dashboardStats.alerts?.overduePayments || 0,
      priority: 1,
      href: '/admin/finance/invoices',
      activeText: 'invoices are overdue',
      emptyText: 'All payments clear',
      icon: '₹'
    },
    {
      id: 'stock',
      label: 'Low Stock Items',
      count: dashboardStats.alerts?.lowStock || 0,
      priority: 2,
      href: '/admin/cmyk-print/paper-stock',
      activeText: 'items below threshold',
      emptyText: 'Stock levels healthy',
      icon: '⚠'
    },
    {
      id: 'followups',
      label: 'Follow-ups Due',
      count: dashboardStats.alerts?.followUpsDue || 0,
      priority: 3,
      href: '/admin/marketing/follow-ups',
      activeText: 'follow-ups due today',
      emptyText: 'No pending follow-ups',
      icon: '!'
    },
  ];

  const sortedAlerts = [...alertsData].sort((a, b) => {
    // 1. Alerting items first (count > 0)
    if (a.count > 0 && b.count === 0) return -1;
    if (a.count === 0 && b.count > 0) return 1;

    // 2. Then by Priority
    return a.priority - b.priority;
  });

  const getStatusColor = (stage: string) => {
    const map: any = {
      'new': 'bg-blue-100 text-blue-700',
      'designing': 'bg-indigo-100 text-indigo-700',
      'approval': 'bg-purple-100 text-purple-700',
      'printing': 'bg-amber-100 text-amber-700',
      'finishing': 'bg-orange-100 text-orange-700',
      'quality_check': 'bg-pink-100 text-pink-700',
      'ready': 'bg-green-100 text-green-700',
      'dispatched': 'bg-cyan-100 text-cyan-700',
      'delivered': 'bg-gray-100 text-gray-700'
    };
    return map[stage] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#4338ca] rounded-2xl p-6 lg:p-8 text-white shadow-lg">
        {/* DEBUG: Remove later */}
        <p className="text-xs text-yellow-300 font-mono mb-2">DEBUG ROLE: {profile?.role || 'loading...'}</p>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}
            </h1>
            <p className="text-indigo-200 text-base mt-2">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2.5 w-fit border border-white/10">
            <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse-soft"></span>
            <span className="text-base font-medium">Live Dashboard</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 hover:bg-white/15 transition-all duration-150 border border-white/5 shadow-inner">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-indigo-100 text-sm font-medium opacity-90">{stat.label}</p>
                  <Icon size={20} className="text-indigo-300" />
                </div>
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-white">
                  {statsLoading ? '...' : stat.value}
                </p>
                {stat.subtext && (
                  <span className="text-xs text-indigo-300 mt-1 block opacity-80">
                    {stat.subtext}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Briefing Panel (Focus + Activity) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fade-in-up">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Today's Focus Stats */}
          <div className="lg:col-span-2 space-y-5">
            <div className="min-w-[120px]">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                Today
              </h2>
              <p className="text-xs text-gray-400 pl-4 mt-1">Daily Focus</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              {/* Jobs Due */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${dashboardStats.todaysFocus?.jobsDue > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.todaysFocus?.jobsDue > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                  <AlertCircle size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.todaysFocus?.jobsDue > 0 ? 'text-red-700' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.jobsDue || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Jobs Due</div>
                </div>
              </div>

              {/* Jobs Delayed */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${dashboardStats.todaysFocus?.jobsDelayed > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.todaysFocus?.jobsDelayed > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Clock size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.todaysFocus?.jobsDelayed > 0 ? 'text-orange-700' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.jobsDelayed || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Delayed</div>
                </div>
              </div>

              {/* Jobs Completed */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${dashboardStats.todaysFocus?.jobsCompleted > 0 ? 'bg-green-50/50 border-green-100 hover:bg-green-50' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.todaysFocus?.jobsCompleted > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                  <CheckCircle size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.todaysFocus?.jobsCompleted > 0 ? 'text-green-700' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.jobsCompleted || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Completed</div>
                </div>
              </div>

              {/* Payments Due */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${dashboardStats.todaysFocus?.paymentsDue > 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.todaysFocus?.paymentsDue > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Receipt size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.todaysFocus?.paymentsDue > 0 ? 'text-blue-700' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.paymentsDue || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Payments</div>
                </div>
              </div>

              {/* Follow-ups */}
              <Link href="/admin/marketing/follow-ups" className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-105 ${dashboardStats.alerts?.followUpsDue > 0 ? 'bg-purple-50 border-purple-100 cursor-pointer' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.alerts?.followUpsDue > 0 ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Phone size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.alerts?.followUpsDue > 0 ? 'text-purple-700' : 'text-gray-500'}`}>{dashboardStats.alerts?.followUpsDue || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Follow-ups</div>
                </div>
              </Link>

              {/* --- VENDOR SNAPSHOT --- */}

              {/* Jobs At Vendor */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${dashboardStats.vendorStats?.jobsAtVendor > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.vendorStats?.jobsAtVendor > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Printer size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.vendorStats?.jobsAtVendor > 0 ? 'text-indigo-700' : 'text-gray-500'}`}>{dashboardStats.vendorStats?.jobsAtVendor || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">At Process</div>
                </div>
              </div>

              {/* Return Today */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${dashboardStats.vendorStats?.dueToday > 0 ? 'bg-cyan-50 border-cyan-100' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.vendorStats?.dueToday > 0 ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Truck size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.vendorStats?.dueToday > 0 ? 'text-cyan-700' : 'text-gray-500'}`}>{dashboardStats.vendorStats?.dueToday || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Return Today</div>
                </div>
              </div>

              {/* Vendor Delayed */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${dashboardStats.vendorStats?.delayed > 0 ? 'bg-rose-50 border-rose-100' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <div className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center ${dashboardStats.vendorStats?.delayed > 0 ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-500'}`}>
                  <AlertCircle size={16} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-none ${dashboardStats.vendorStats?.delayed > 0 ? 'text-rose-700' : 'text-gray-500'}`}>{dashboardStats.vendorStats?.delayed || 0}</div>
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Vendor Late</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Activity Feed (Merged) */}
          <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-gray-100 pt-6 lg:pt-0 lg:pl-8 h-full">
            <ActivityFeed variant="minimal" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        {/* Needs Attention */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
          <div className="flex items-center gap-2.5 mb-6">
            <AlertCircle size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">Needs Attention</h2>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-1">
            {sortedAlerts.map((alert) => {
              const isSafe = alert.count === 0;
              let colors = isSafe ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200';
              let iconColors = isSafe ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500';

              // Specific Alert Colors
              if (!isSafe) {
                if (alert.id === 'blocked') { colors = 'bg-slate-50 text-slate-700 border-slate-200'; iconColors = 'bg-slate-100 text-slate-600'; }
                if (alert.id === 'payments') { colors = 'bg-red-50 text-red-700 border-red-200'; iconColors = 'bg-red-100 text-red-600'; }
                if (alert.id === 'stock') { colors = 'bg-orange-50 text-orange-800 border-orange-200'; iconColors = 'bg-orange-100 text-orange-600'; }
                if (alert.id === 'followups') { colors = 'bg-amber-50 text-amber-800 border-amber-200'; iconColors = 'bg-amber-100 text-amber-600'; }
              }

              return (
                <Link key={alert.label} href={alert.href} className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md ${colors}`}>
                  <div className="flex items-center gap-4">
                    <span className={`w-10 h-10 ${iconColors} rounded-lg flex items-center justify-center text-lg font-bold shadow-sm`}>
                      {isSafe ? <Check size={20} /> : alert.icon}
                    </span>
                    <div>
                      <h4 className="text-base font-bold leading-tight">{alert.label}</h4>
                      <p className={`text-xs mt-0.5 font-medium opacity-80`}>
                        {isSafe ? alert.emptyText : `${alert.count} ${alert.activeText}`}
                      </p>
                    </div>
                  </div>

                  {!isSafe && (
                    <span className="font-bold text-xl">{alert.count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <NotesWidget />

        {/* Reminders */}
        <RemindersWidget />

        {/* Row 2: Main Business Data */}
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">

          {/* Sales Performance */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Sales Performance</h2>
                <p className="text-sm text-gray-500 mt-1">Monthly revenue overview</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-xl font-medium transition-colors hover:bg-indigo-100">Monthly</button>
                <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">Yearly</button>
              </div>
            </div>

            {/* Chart */}
            <div className="flex items-end justify-between gap-3 h-56 mb-8">
              {dashboardStats.salesPerformance?.map((item) => (
                <div key={item.month} className="flex flex-col items-center flex-1 group h-full justify-end">
                  <div className="relative w-full flex items-end justify-center h-full">
                    {item.active && (
                      <div className="absolute -top-10 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transform transition-all z-10 shadow-lg">
                        {formatCurrency(item.value)}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    )}
                    <div
                      className={`w-full max-w-[40px] rounded-t-lg transition-all duration-300 ${item.active
                        ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-lg shadow-indigo-200'
                        : 'bg-gray-100 group-hover:bg-gray-200'
                        }`}
                      style={{
                        height: `${Math.max(5, Math.min(100, (item.value / ((dashboardStats.totalRevenue || 1) / 6)) * 60))}%`
                      }}
                    />
                  </div>
                  <span className={`text-xs mt-4 font-semibold ${item.active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {item.month}
                  </span>
                </div>
              ))}
              {(!dashboardStats.salesPerformance || dashboardStats.salesPerformance.length === 0) && (
                <div className="w-full flex items-center justify-center text-gray-400 text-sm">No sales data available</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-gray-900">{formatCurrency(dashboardStats.totalRevenue)}</span>
                <span className="text-base text-gray-500 font-medium">YTD Revenue</span>
              </div>
              <Link href="/admin/sales/orders" className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-bold bg-indigo-50 px-4 py-2 rounded-xl transition-colors">
                View Report
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Jobs</h2>
              <Link href="/admin/sales/orders" className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-bold">
                View All
                <ArrowUpRight size={16} />
              </Link>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="pb-4 text-xs font-bold text-gray-500 uppercase tracking-wider pl-4">Order</th>
                    <th className="pb-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="pb-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dept</th>
                    <th className="pb-4 text-xs font-bold text-gray-500 uppercase tracking-wider">SLA / Time</th>
                    <th className="pb-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                    <th className="pb-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentJobs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No recent jobs found</td></tr>
                  ) : recentJobs.map((job) => {
                    // Logic for Dept
                    let dept = 'Design';
                    if (['printing', 'finishing', 'ready'].includes(job.current_stage)) dept = 'Print';
                    if (['dispatched', 'delivered'].includes(job.current_stage)) dept = 'Dispatch';

                    // Logic for SLA
                    const deadline = job.client_deadline ? new Date(job.client_deadline) : null;
                    const diffDays = deadline ? Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                    let slaText = '-';
                    let slaColor = 'text-gray-400';

                    if (diffDays !== null) {
                      if (diffDays < 0) { slaText = `${Math.abs(diffDays)}d Overdue`; slaColor = 'text-red-600 font-bold'; }
                      else if (diffDays === 0) { slaText = 'Due Today'; slaColor = 'text-orange-600 font-bold'; }
                      else { slaText = `⏳ ${diffDays} days left`; slaColor = 'text-indigo-600 font-medium'; }
                    }

                    // Row Class
                    let rowClass = 'hover:bg-gray-50/80 transition-colors group';
                    if (job.current_stage === 'new') rowClass = 'bg-blue-50/40 hover:bg-blue-50/60 transition-colors group';
                    if (diffDays !== null && diffDays < 0 && job.current_stage !== 'delivered') rowClass = 'bg-red-50/40 hover:bg-red-50/60 transition-colors group';

                    return (
                      <tr key={job.id} className={rowClass}>
                        <td className="py-4 pl-4"><span className="font-bold text-indigo-900 bg-indigo-50 px-2 py-1 rounded-md text-xs">{job.job_number}</span></td>
                        <td className="py-4">
                          <div className="font-bold text-gray-800 text-sm">{job.project_name}</div>
                          <div className="text-xs text-gray-500">{job.client?.company || '-'}</div>
                        </td>
                        <td className="py-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full bg-white">{dept}</span>
                        </td>
                        <td className={`py-4 text-xs ${slaColor}`}>
                          {slaText}
                        </td>
                        <td className="py-4 text-right font-bold text-gray-900 text-sm">{formatCurrency(job.total_amount)}</td>
                        <td className="py-4 text-right pr-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${getStatusColor(job.current_stage)} shadow-sm`}>
                            {job.current_stage.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {recentJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No recent jobs found</div>
              ) : recentJobs.map((job) => (
                <div key={job.id} className="border border-gray-100 p-4 rounded-xl shadow-sm bg-gray-50/30">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-indigo-900 bg-indigo-50 px-3 py-1 rounded-lg text-sm">{job.job_number}</span>
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${getStatusColor(job.current_stage)}`}>
                      {job.current_stage}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-800 mb-1 leading-snug">{job.project_name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{job.client?.company || '-'}</p>

                  <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                    <span className="text-xs text-gray-400 font-medium uppercase">Total Amount</span>
                    <span className="font-bold text-gray-900">{formatCurrency(job.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="lg:col-span-1 space-y-6 lg:space-y-8">

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/admin/sales/orders" className="p-4 bg-gray-900 text-white rounded-xl text-center text-sm font-semibold hover:bg-gray-800 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
                + New Order
              </Link>
              <Link href="/admin/cmyk-print" className="p-4 bg-indigo-50 text-indigo-700 rounded-xl text-center text-sm font-semibold hover:bg-indigo-100 transition-all">
                Print Job
              </Link>
              <Link href="/admin/dispatch" className="p-4 bg-green-50 text-green-700 rounded-xl text-center text-sm font-semibold hover:bg-green-100 transition-all">
                QC Check
              </Link>
              <Link href="/admin/crm/clients" className="p-4 bg-purple-50 text-purple-700 rounded-xl text-center text-sm font-semibold hover:bg-purple-100 transition-all">
                Clients
              </Link>
            </div>
          </div>

          {/* Work Pipeline */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Work Pipeline</h2>

            <div className="relative w-48 h-48 mx-auto mb-8">
              <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90 drop-shadow-md">
                <circle cx="60" cy="60" r="45" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#4f46e5" strokeWidth="10"
                  strokeDasharray={`${(dashboardStats.activeJobs > 0 ? 283 : 0)} 283`} strokeDashoffset="0" strokeLinecap="round" className="transition-all duration-1000 ease-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-4xl font-extrabold text-gray-900">{dashboardStats.activeJobs}</span>
                  <p className="text-sm text-gray-500 font-medium mt-1">Active Jobs</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {pipeline.map((item) => {
                const percent = Math.round((item.count / totalPipeline) * 100);
                const isBottleneck = item.count > item.thresh;

                // Calculate Overdue for this stage group
                let overdueCount = 0;
                if (item.label === 'In Design') overdueCount = (dashboardStats.pipelineOverdue?.designing || 0) + (dashboardStats.pipelineOverdue?.approval || 0);
                if (item.label === 'Production') overdueCount = (dashboardStats.pipelineOverdue?.printing || 0) + (dashboardStats.pipelineOverdue?.finishing || 0);
                if (item.label === 'QC Check') overdueCount = (dashboardStats.pipelineOverdue?.quality_check || 0);
                if (item.label === 'Ready/Packed') overdueCount = (dashboardStats.pipelineOverdue?.ready || 0) + (dashboardStats.pipelineOverdue?.packed || 0);

                return (
                  <Link key={item.label} href={item.href} className={`block group`}>
                    <div className={`flex items-center justify-between p-3 rounded-xl transition-all border 
                      ${isBottleneck || overdueCount > 0 ? 'bg-red-50/50 border-red-100' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}
                  `}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${item.color.split(' ')[0]} shadow-sm`}></span>
                          <span className={`text-sm font-bold ${isBottleneck || overdueCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>{item.label}</span>
                        </div>

                        {/* Health Status */}
                        <div className="text-[10px] font-medium mb-2 pl-4">
                          {overdueCount > 0 ? (
                            <span className="text-red-600 flex items-center gap-1">⚠️ {overdueCount} overdue</span>
                          ) : isBottleneck ? (
                            <span className="text-amber-600 flex items-center gap-1">🟡 High Load</span>
                          ) : (
                            <span className="text-green-600 flex items-center gap-1">✅ On Track</span>
                          )}
                        </div>

                        {/* Prorgess Bar */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${item.color.replace('text-', 'bg-')} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>

                      <div className="ml-4 text-right">
                        <span className={`text-lg font-bold ${isBottleneck || overdueCount > 0 ? 'text-red-600' : 'text-gray-900 group-hover:text-indigo-600'}`}>{item.count}</span>
                        <p className="text-[10px] text-gray-400 font-medium">{percent}%</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
