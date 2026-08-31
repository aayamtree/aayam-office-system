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
  Ban,
  IndianRupee
} from 'lucide-react';
import { useDashboardStats, useJobs } from '@/lib/hooks';
import NotesWidget from '@/components/dashboard/NotesWidget';
import RemindersWidget from '@/components/dashboard/RemindersWidget';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import { usePageVisibility } from '@/lib/usePageVisibility';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const { stats: dashboardStats, loading: statsLoading } = useDashboardStats();
  const { jobs: recentJobs, loading: jobsLoading } = useJobs({
    limit: 5,
    orderBy: { column: 'created_at', ascending: false }
  });

  // Redirect non-admin users to their specific dashboards
  useEffect(() => {
    if (profile?.role === 'designer') {
      router.replace('/admin/designers/tasks');
    } else if (profile?.role === 'dispatch') {
      router.replace('/admin/dispatch');
    } else if (profile?.role === 'marketing') {
      router.replace('/admin/marketing');
    } else if (profile?.role === 'cmyk') {
      router.replace('/admin/cmyk-print');
    }
  }, [profile, router]);

  // Prevent flash of admin content for non-admin users
  if (profile?.role && profile.role !== 'admin') {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">Redirecting to your dashboard...</div>;
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
    { label: 'In Design', count: (dashboardStats.pipeline?.designing || 0) + (dashboardStats.pipeline?.approval || 0), color: 'bg-primary', href: '/admin/designers/tasks?view=team_tasks', thresh: 10 },
    { label: 'Production', count: (dashboardStats.pipeline?.printing || 0) + (dashboardStats.pipeline?.finishing || 0), color: 'bg-white0', href: '/admin/jobs/queue', thresh: 15 },
    { label: 'QC Check', count: dashboardStats.pipeline?.quality_check || 0, color: 'bg-primary', href: '/admin/jobs?status=quality_check', thresh: 5 },
    { label: 'Ready/Packed', count: (dashboardStats.pipeline?.ready || 0) + (dashboardStats.pipeline?.packed || 0), color: 'bg-white0', href: '/admin/dispatch', thresh: 20 },
    { label: 'Dispatched', count: (dashboardStats.pipeline?.dispatched || 0) + (dashboardStats.pipeline?.in_transit || 0), color: 'bg-primary', href: '/admin/dispatch/history', thresh: 999 },
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
      icon: <Ban className="w-3 h-3 md:w-5 md:h-5" />
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
      'new': 'bg-muted text-foreground',
      'designing': 'bg-gray-900 text-white',
      'approval': 'bg-gray-900 text-white',
      'printing': 'bg-amber-100 text-amber-700',
      'finishing': 'bg-orange-100 text-orange-700',
      'quality_check': 'bg-pink-100 text-pink-700',
      'ready': 'bg-gray-100 text-gray-900',
      'dispatched': 'bg-cyan-100 text-cyan-700',
      'delivered': 'bg-gray-100 text-gray-700'
    };
    return map[stage] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in pb-6 md:pb-10">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-3.5 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4 mb-3 md:mb-1.5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}
            </h1>
            <p className="text-body text-gray-500 mt-1 md:mt-2 leading-tight">{dateStr}</p>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <DriveConnectionStatus />
            <div className="flex items-center gap-1.5 md:gap-2 bg-gray-900/10 backdrop-blur-sm rounded-full px-3 md:px-5 py-1.5 md:py-2.5 w-fit border border-primary/10">
              <span className="w-2 h-2 md:w-2.5 md:h-2.5 bg-green-400 rounded-full animate-pulse-soft"></span>
              <span className="text-xs md:text-base font-medium text-gray-900">Live Dashboard</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-lg md:rounded-lg p-2.5 md:p-3 border-2 border-gray-100 hover:border-primary/20 transition-all duration-150">
                <div className="flex items-start justify-between mb-1 md:mb-3">
                  <p className="text-gray-600 text-xs md:text-sm font-medium">{stat.label}</p>
                  <Icon className="w-4 h-4 text-primary md:hidden" />
                  <Icon className="w-3 h-3 md:w-5 md:h-5 text-primary hidden md:block" />
                </div>
                <p className="text-xl md:text-3xl lg:text-page-title tracking-tight text-gray-900 font-semibold">
                  {statsLoading ? '...' : stat.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Briefing Panel (Focus + Activity) */}
      <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 border border-gray-100 animate-fade-in-up">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Today's Focus Stats */}
          <div className="lg:col-span- 2 space-y-4 md:space-y-5">
            <div className="min-w-[120px]">
              <h2 className="text-section text-gray-900 flex items-center gap-2">
                <span className="w-2 h-8 bg-gray-900 rounded-full"></span>
                Today
              </h2>
              <p className="text-xs text-gray-400 pl-4 mt-1">Daily Focus</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
              {/* Jobs Due */}
              <div className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border ${dashboardStats.todaysFocus?.jobsDue > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <AlertCircle className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.todaysFocus?.jobsDue > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.todaysFocus?.jobsDue > 0 ? 'text-red-700' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.jobsDue || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">Jobs Due</div>
                </div>
              </div>

              {/* Jobs Delayed */}
              <div className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border ${dashboardStats.todaysFocus?.jobsDelayed > 0 ? 'bg-[rgba(255,102,0,0.08)] border-[rgba(255,102,0,0.15)]' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <Clock className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.todaysFocus?.jobsDelayed > 0 ? 'text-destructive' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.todaysFocus?.jobsDelayed > 0 ? 'text-destructive' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.jobsDelayed || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">Delayed</div>
                </div>
              </div>

              {/* Jobs Completed */}
              <div className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border transition-colors ${dashboardStats.todaysFocus?.jobsCompleted > 0 ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <CheckCircle className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.todaysFocus?.jobsCompleted > 0 ? 'text-gray-600' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.todaysFocus?.jobsCompleted > 0 ? 'text-gray-700' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.jobsCompleted || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">Completed</div>
                </div>
              </div>

              {/* Payments Due */}
              <div className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border ${dashboardStats.todaysFocus?.paymentsDue > 0 ? 'bg-muted border-[rgba(0,0,255,0.1)]' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <IndianRupee className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.todaysFocus?.paymentsDue > 0 ? 'text-primary' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.todaysFocus?.paymentsDue > 0 ? 'text-primary' : 'text-gray-500'}`}>{dashboardStats.todaysFocus?.paymentsDue || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">Payments</div>
                </div>
              </div>

              {/* Follow-ups */}
              <Link href="/admin/marketing/follow-ups" className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border transition-all hover:scale-105 ${dashboardStats.alerts?.followUpsDue > 0 ? 'bg-muted border-[rgba(0,0,255,0.1)] cursor-pointer' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <Phone className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.alerts?.followUpsDue > 0 ? 'text-primary' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.alerts?.followUpsDue > 0 ? 'text-primary' : 'text-gray-500'}`}>{dashboardStats.alerts?.followUpsDue || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">Follow-ups</div>
                </div>
              </Link>

              {/* --- VENDOR SNAPSHOT --- */}

              {/* Jobs At Vendor */}
              <div className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border ${dashboardStats.vendorStats?.jobsAtVendor > 0 ? 'bg-muted border-[rgba(0,0,255,0.1)]' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <Printer className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.vendorStats?.jobsAtVendor > 0 ? 'text-primary' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.vendorStats?.jobsAtVendor > 0 ? 'text-primary' : 'text-gray-500'}`}>{dashboardStats.vendorStats?.jobsAtVendor || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">At Process</div>
                </div>
              </div>

              {/* Return Today */}
              <div className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border ${dashboardStats.vendorStats?.dueToday > 0 ? 'bg-muted border-[rgba(0,0,255,0.1)]' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <Truck className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.vendorStats?.dueToday > 0 ? 'text-primary' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.vendorStats?.dueToday > 0 ? 'text-primary' : 'text-gray-500'}`}>{dashboardStats.vendorStats?.dueToday || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">Return Today</div>
                </div>
              </div>

              {/* Vendor Delayed */}
              <div className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg md:rounded-lg border ${dashboardStats.vendorStats?.delayed > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent opacity-60'}`}>
                <AlertCircle className={`w-5 h-5 md:w-5.5 md:h-5.5 flex-shrink-0 ${dashboardStats.vendorStats?.delayed > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                <div className="flex flex-col min-w-0">
                  <div className={`text-base md:text-lg font-bold leading-none ${dashboardStats.vendorStats?.delayed > 0 ? 'text-red-700' : 'text-gray-500'}`}>{dashboardStats.vendorStats?.delayed || 0}</div>
                  <div className="text-xs md:text-xs text-gray-600 font-medium whitespace-nowrap">Vendor Late</div>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-4">

        {/* Needs Attention */}
        <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-3.5 border border-gray-100 flex flex-col h-full">
          <div className="flex items-center gap-2.5 mb-1.5">
            <AlertCircle className="w-3 h-3 md:w-5 md:h-5 text-destructive" />
            <h2 className="text-section text-gray-900">Needs Attention</h2>
          </div>

          <div className="space-y-2 md:space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-1">
            {sortedAlerts.map((alert) => {
              const isSafe = alert.count === 0;
              let colors = isSafe ? 'bg-gray-50 text-gray-700 border-gray-200' : 'bg-[rgba(255,102,0,0.05)] text-destructive border-[rgba(255,102,0,0.1)]';
              let iconColors = isSafe ? 'bg-gray-200 text-gray-500' : 'bg-[rgba(255,102,0,0.1)] text-destructive';

              // Specific Alert Colors
              if (!isSafe) {
                if (alert.id === 'blocked') { colors = 'bg-muted text-primary border-[rgba(0,0,255,0.1)]'; iconColors = 'bg-gray-900 text-white'; }
                if (alert.id === 'payments') { colors = 'bg-red-50 text-red-700 border-red-200'; iconColors = 'bg-red-100 text-red-600'; }
                if (alert.id === 'stock') { colors = 'bg-[rgba(255,102,0,0.1)] text-destructive border-[rgba(255,102,0,0.2)]'; iconColors = 'bg-[rgba(255,102,0,0.15)] text-destructive'; }
                if (alert.id === 'followups') { colors = 'bg-[rgba(255,102,0,0.08)] text-destructive border-[rgba(255,102,0,0.15)]'; iconColors = 'bg-[rgba(255,102,0,0.12)] text-destructive'; }
              }

              return (
                <Link key={alert.label} href={alert.href} className={`flex items-center justify-between p-3 md:p-4 rounded-lg md:rounded-lg border transition-all  ${colors}`}>
                  <div className="flex items-center gap-4">
                    <span className={`w-10 h-10 ${iconColors} rounded-lg flex items-center justify-center text-section`}>
                      {isSafe ? <Check className="w-3 h-3 md:w-5 md:h-5" /> : alert.icon}
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
        <div className="lg:col-span-2 space-y-3 md:space-y-4">

          {/* Sales Performance */}
          <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-3.5 border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-1.5">
              <div>
                <h2 className="text-lg md:text-section text-gray-900">Sales Performance</h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1">Monthly revenue overview</p>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <button className="px-4 md:px-5 py-2 text-sm bg-gray-900 text-white rounded-md font-semibold transition-colors hover:bg-gray-800">Monthly</button>
                <button className="px-4 md:px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-md font-medium transition-colors">Yearly</button>
              </div>
            </div>

            {/* Chart */}
            <div className="flex items-end justify-between gap-3 h-40 mb-1">
              {dashboardStats.salesPerformance?.map((item) => (
                <div key={item.month} className="flex flex-col items-center flex-1 group h-full justify-end">
                  <div className="relative w-full flex items-end justify-center h-full">
                    {item.active && (
                      <div className="absolute -top-10 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transform transition-all z-10">
                        {formatCurrency(item.value)}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    )}
                    <div
                      className={`w-full max-w-[40px] rounded-t-lg transition-all duration-300 ${item.active
                        ? 'bg-gray-900 -200'
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
                <span className="text-page-title text-gray-900">{formatCurrency(dashboardStats.totalRevenue)}</span>
                <span className="text-base text-gray-500 font-medium">YTD Revenue</span>
              </div>
              <Link href="/admin/sales/orders" className="flex items-center gap-2 text-sm text-primary hover:opacity-80 font-bold bg-muted px-4 py-2 rounded-md transition-colors">
                View Report
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-3.5 border border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-section text-gray-900">Recent Jobs</h2>
              <Link href="/admin/sales/orders" className="flex items-center gap-1 text-sm text-primary hover:text-primary font-bold">
                View All
                <ArrowUpRight className="w-4 h-4" />
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
                      else { slaText = `⏳ ${diffDays} days left`; slaColor = 'text-primary font-medium'; }
                    }

                    // Row Class
                    let rowClass = 'hover:bg-gray-50/80 transition-colors group';
                    if (job.current_stage === 'new') rowClass = 'bg-muted/40 hover:bg-muted/60 transition-colors group';
                    if (diffDays !== null && diffDays < 0 && job.current_stage !== 'delivered') rowClass = 'bg-red-50/40 hover:bg-red-50/60 transition-colors group';

                    return (
                      <tr key={job.id} className={rowClass}>
                        <td className="py-4 pl-4"><span className="font-bold text-indigo-900 bg-gray-900 px-2 py-1 rounded-md text-xs">{job.job_number}</span></td>
                        <td className="py-4">
                          <div className="font-bold text-gray-800 text-sm">{job.project_name}</div>
                          <div className="text-xs text-gray-500">{job.client?.company || '-'}</div>
                        </td>
                        <td className="py-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 border border-gray-200 px-2 py-0.5 rounded-md bg-white">{dept}</span>
                        </td>
                        <td className={`py-4 text-xs ${slaColor}`}>
                          {slaText}
                        </td>
                        <td className="py-4 text-right font-bold text-gray-900 text-sm">{formatCurrency(job.total_amount)}</td>
                        <td className="py-4 text-right pr-4">
                          <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md ${getStatusColor(job.current_stage)}`}>
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
            <div className="md:hidden space-y-2">
              {recentJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No recent jobs found</div>
              ) : recentJobs.map((job) => (
                <div key={job.id} className="border border-gray-100 p-3 rounded-lg bg-gray-50/30">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-indigo-900 bg-gray-900 px-3 py-1 rounded-lg text-sm">{job.job_number}</span>
                    <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-md ${getStatusColor(job.current_stage)}`}>
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
        <div className="lg:col-span-1 space-y-3 md:space-y-6 lg:space-y-8">

          {/* Quick Actions */}
          <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 lg:p-5 border border-gray-100">
            <h2 className="text-base md:text-section text-gray-900 mb-3 md:mb-5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Link href="/admin/sales/orders" className="px-4 py-3 bg-gray-900 text-white rounded-md text-center text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm">
                + New Order
              </Link>
              <Link href="/admin/cmyk-print" className="px-4 py-3 bg-white border-2 border-gray-200 text-primary rounded-lg text-center text-sm font-semibold hover:bg-gray-50 transition-colors">
                Print Job
              </Link>
              <Link href="/admin/dispatch" className="px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-lg text-center text-sm font-semibold hover:bg-gray-50 transition-colors">
                QC Check
              </Link>
              <Link href="/admin/crm/clients" className="px-4 py-3 bg-white border-2 border-gray-200 text-primary rounded-lg text-center text-sm font-semibold hover:bg-gray-50 transition-colors">
                Clients
              </Link>
            </div>
          </div>

          {/* Work Pipeline */}
          <div className="bg-white rounded-lg md:rounded-lg p-3 md:p-4 lg:p-5 border border-gray-100">
            <h2 className="text-base md:text-section text-gray-900 mb-1.5">Work Pipeline</h2>

            <div className="relative w-48 h-48 mx-auto mb-1.5">
              <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90 drop-">
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

            <div className="space-y-2 md:space-y-4">
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
                    <div className={`flex items-center justify-between p-3 rounded-lg transition-all border 
                      ${isBottleneck || overdueCount > 0 ? 'bg-red-50/50 border-red-100' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}
                  `}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${item.color.split(' ')[0]}`}></span>
                          <span className={`text-sm font-bold ${isBottleneck || overdueCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>{item.label}</span>
                        </div>

                        {/* Health Status */}
                        <div className="text-xs font-medium mb-2 pl-4">
                          {overdueCount > 0 ? (
                            <span className="text-red-600 flex items-center gap-1">⚠️ {overdueCount} overdue</span>
                          ) : isBottleneck ? (
                            <span className="text-destructive flex items-center gap-1">🟡 High Load</span>
                          ) : (
                            <span className="text-gray-900 flex items-center gap-1">✅ On Track</span>
                          )}
                        </div>

                        {/* Prorgess Bar */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${item.color.replace('text-', 'bg-')} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>

                      <div className="ml-4 text-right">
                        <span className={`text-section ${isBottleneck || overdueCount > 0 ? 'text-red-600' : 'text-gray-900 group-hover:text-primary'}`}>{item.count}</span>
                        <p className="text-xs text-gray-400 font-medium">{percent}%</p>
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
