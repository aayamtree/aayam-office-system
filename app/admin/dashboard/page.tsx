'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
    Package, CreditCard, IndianRupee, AlertTriangle, Clock,
    CheckCircle2, TrendingUp, ArrowRight, Activity, Target,
    Lock, Unlock, RotateCcw, GripVertical, Loader2,
} from 'lucide-react';
import { useDashboardStats, useJobs } from '@/lib/hooks';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import NeedsAttentionBar from '@/components/dashboard/NeedsAttentionBar';
import DashboardGrid, { resetLayouts, type LayoutsMap } from '@/components/dashboard/DashboardGrid';

// ─── Lazy-loaded widgets (deferred to reduce initial page load) ──
const WidgetSkeleton = () => (
    <Card className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </Card>
);

const OverdueAlertsWidget = dynamic(() => import('@/components/dashboard/OverdueAlertsWidget'), {
    loading: () => <WidgetSkeleton />, ssr: false
});
const MiniCalendarWidget = dynamic(() => import('@/components/dashboard/MiniCalendarWidget'), {
    loading: () => <WidgetSkeleton />, ssr: false
});
const QuickNotesWidget = dynamic(() => import('@/components/dashboard/QuickNotesWidget'), {
    loading: () => <WidgetSkeleton />, ssr: false
});
const TeamWorkloadWidget = dynamic(() => import('@/components/dashboard/TeamWorkloadWidget'), {
    loading: () => <WidgetSkeleton />, ssr: false
});
const DailySummaryWidget = dynamic(() => import('@/components/dashboard/DailySummaryWidget'), {
    loading: () => <WidgetSkeleton />, ssr: false
});
const RecentFilesWidget = dynamic(() => import('@/components/dashboard/RecentFilesWidget'), {
    loading: () => <WidgetSkeleton />, ssr: false
});
const InvoicePendingWidget = dynamic(() => import('@/components/dashboard/InvoicePendingWidget'), {
    loading: () => <WidgetSkeleton />, ssr: false
});

// ─── Default Grid Layouts per breakpoint ───────────────────────
const DEFAULT_LAYOUTS: LayoutsMap = {
    lg: [
        { i: 'kpi-revenue', x: 0, y: 0, w: 3, h: 2 },
        { i: 'kpi-jobs', x: 3, y: 0, w: 3, h: 2 },
        { i: 'kpi-payments', x: 6, y: 0, w: 3, h: 2 },
        { i: 'kpi-orders', x: 9, y: 0, w: 3, h: 2 },
        { i: 'todays-focus', x: 0, y: 2, w: 12, h: 2 },
        { i: 'needs-attention', x: 0, y: 4, w: 6, h: 3 },
        { i: 'invoice-pending', x: 6, y: 4, w: 6, h: 3 },
        { i: 'pipeline', x: 0, y: 7, w: 6, h: 5 },
        { i: 'daily-summary', x: 6, y: 7, w: 6, h: 5 },
        { i: 'overdue', x: 0, y: 12, w: 6, h: 4 },
        { i: 'team-workload', x: 6, y: 12, w: 6, h: 4 },
        { i: 'recent-orders', x: 0, y: 16, w: 7, h: 5 },
        { i: 'quick-notes', x: 7, y: 16, w: 5, h: 5 },
        { i: 'sales-perf', x: 0, y: 21, w: 6, h: 5 },
        { i: 'calendar', x: 6, y: 21, w: 6, h: 5 },
        { i: 'recent-files', x: 0, y: 26, w: 12, h: 5 },
    ],
    md: [
        { i: 'kpi-revenue', x: 0, y: 0, w: 3, h: 2 },
        { i: 'kpi-jobs', x: 3, y: 0, w: 3, h: 2 },
        { i: 'kpi-payments', x: 0, y: 2, w: 3, h: 2 },
        { i: 'kpi-orders', x: 3, y: 2, w: 3, h: 2 },
        { i: 'todays-focus', x: 0, y: 4, w: 6, h: 3 },
        { i: 'needs-attention', x: 0, y: 7, w: 6, h: 3 },
        { i: 'invoice-pending', x: 0, y: 10, w: 6, h: 3 },
        { i: 'pipeline', x: 0, y: 13, w: 6, h: 5 },
        { i: 'daily-summary', x: 0, y: 18, w: 6, h: 5 },
        { i: 'overdue', x: 0, y: 23, w: 3, h: 4 },
        { i: 'team-workload', x: 3, y: 23, w: 3, h: 4 },
        { i: 'recent-orders', x: 0, y: 27, w: 6, h: 5 },
        { i: 'quick-notes', x: 0, y: 32, w: 6, h: 5 },
        { i: 'sales-perf', x: 0, y: 37, w: 3, h: 5 },
        { i: 'calendar', x: 3, y: 37, w: 3, h: 5 },
        { i: 'recent-files', x: 0, y: 42, w: 6, h: 5 },
    ],
    sm: [
        { i: 'kpi-revenue', x: 0, y: 0, w: 1, h: 2 },
        { i: 'kpi-jobs', x: 1, y: 0, w: 1, h: 2 },
        { i: 'kpi-payments', x: 0, y: 2, w: 1, h: 2 },
        { i: 'kpi-orders', x: 1, y: 2, w: 1, h: 2 },
        { i: 'todays-focus', x: 0, y: 4, w: 2, h: 4 },
        { i: 'needs-attention', x: 0, y: 8, w: 2, h: 3 },
        { i: 'invoice-pending', x: 0, y: 11, w: 2, h: 3 },
        { i: 'pipeline', x: 0, y: 14, w: 2, h: 5 },
        { i: 'daily-summary', x: 0, y: 19, w: 2, h: 5 },
        { i: 'overdue', x: 0, y: 24, w: 2, h: 4 },
        { i: 'team-workload', x: 0, y: 28, w: 2, h: 4 },
        { i: 'recent-orders', x: 0, y: 32, w: 2, h: 5 },
        { i: 'quick-notes', x: 0, y: 37, w: 2, h: 5 },
        { i: 'sales-perf', x: 0, y: 42, w: 2, h: 5 },
        { i: 'calendar', x: 0, y: 47, w: 2, h: 5 },
        { i: 'recent-files', x: 0, y: 52, w: 2, h: 5 },
    ],
};

export default function AdminDashboardShadcn() {
    const { profile } = useAuth();
    const router = useRouter();
    const { stats: dashboardStats, loading: statsLoading } = useDashboardStats();
    // PERF: Fetch only the fields rendered in the Recent Orders table
    const { jobs: recentJobs, loading: jobsLoading } = useJobs({
        select: 'id, job_number, project_name, current_stage, total_amount, client:clients(name)',
        limit: 5,
        orderBy: { column: 'created_at', ascending: false }
    });

    const [isLocked, setIsLocked] = useState(true);

    // Redirect non-admin users
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

    if (profile?.role && profile.role !== 'admin') {
        return (
            <div className="h-screen flex items-center justify-center">
                <p className="text-muted-foreground">Redirecting to your dashboard...</p>
            </div>
        );
    }

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

    const pipelineStages = [
        { key: 'awaiting_admin', label: 'Pending', color: 'bg-orange-500' },
        { key: 'new', label: 'New', color: 'bg-blue-500' },
        { key: 'designing', label: 'Design', color: 'bg-violet-500' },
        { key: 'approval', label: 'Approval', color: 'bg-amber-500' },
        { key: 'printing', label: 'Print', color: 'bg-gray-800' },
        { key: 'finishing', label: 'Finish', color: 'bg-cyan-500' },
        { key: 'ready', label: 'Ready', color: 'bg-emerald-500' },
        { key: 'packed', label: 'Packed', color: 'bg-teal-500' },
        { key: 'dispatched', label: 'Dispatched', color: 'bg-gray-400' },
    ];

    const totalPipelineJobs = Object.values(dashboardStats.pipeline).reduce((a, b) => a + b, 0);
    const pendingApprovals = dashboardStats.pipeline['awaiting_admin'] || 0;

    const handleReset = () => {
        resetLayouts();
        window.location.reload();
    };

    return (
        <div className="flex-1 p-4 md:p-6 pt-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-page-title tracking-tight">Dashboard</h2>
                <div className="flex items-center gap-2">
                    {!isLocked && (
                        <Button variant="outline" size="sm" onClick={handleReset} className="text-xs gap-1.5">
                            <RotateCcw className="h-3 w-3" /> Reset Layout
                        </Button>
                    )}
                    <Button
                        variant={isLocked ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => setIsLocked(!isLocked)}
                        className="text-xs gap-1.5"
                    >
                        {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {isLocked ? 'Layout Locked' : 'Editing Layout'}
                    </Button>
                </div>
            </div>

            {!isLocked && (
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5" />
                    Drag widgets by the ⋮⋮ handle to rearrange. Click <strong className="mx-0.5">Layout Locked</strong> when done.
                </div>
            )}

            <DashboardGrid defaultLayouts={DEFAULT_LAYOUTS} isLocked={isLocked}>
                {/* ── KPI Cards ── */}
                <div key="kpi-revenue">
                    <Link href="/admin/finance" className="block h-full">
                        <Card className="h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                <IndianRupee className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{statsLoading ? '...' : formatCurrency(dashboardStats.totalRevenue)}</div>
                                <p className="text-xs text-muted-foreground">Lifetime invoice total</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                <div key="kpi-jobs">
                    <Link href="/admin/jobs" className="block h-full">
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{statsLoading ? '...' : dashboardStats.activeJobs}</div>
                                <p className="text-xs text-muted-foreground">Currently in production</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                <div key="kpi-payments">
                    <Link href="/admin/finance/payments" className="block h-full">
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                                <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{statsLoading ? '...' : formatCurrency(dashboardStats.pendingPayments)}</div>
                                <p className="text-xs text-muted-foreground">Outstanding invoices</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                <div key="kpi-orders">
                    <Link href="/admin/sales/orders" className="block h-full">
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Orders This Month</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{statsLoading ? '...' : dashboardStats.ordersThisMonth}</div>
                                <p className="text-xs text-muted-foreground">New orders created</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* ── Today's Focus ── */}
                <div key="todays-focus">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Target className="h-4 w-4" strokeWidth={1.5} /> Today&apos;s Focus
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 flex-1 flex flex-col">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
                                <Link href="/admin/jobs" className="flex items-center justify-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-100 hover:shadow-sm min-h-0">
                                    <Clock className="h-4 w-4 text-amber-600 shrink-0" strokeWidth={1.5} />
                                    <div><span className="text-lg font-bold text-amber-700">{statsLoading ? '-' : dashboardStats.todaysFocus.jobsDue}</span><span className="text-[11px] text-amber-600 ml-1">Due</span></div>
                                </Link>
                                <Link href="/admin/jobs" className="flex items-center justify-center gap-2 p-2 rounded-md bg-red-50 border border-red-100 hover:shadow-sm min-h-0">
                                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" strokeWidth={1.5} />
                                    <div><span className="text-lg font-bold text-red-700">{statsLoading ? '-' : dashboardStats.todaysFocus.jobsDelayed}</span><span className="text-[11px] text-red-600 ml-1">Delayed</span></div>
                                </Link>
                                <Link href="/admin/jobs" className="flex items-center justify-center gap-2 p-2 rounded-md bg-green-50 border border-green-100 hover:shadow-sm min-h-0">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" strokeWidth={1.5} />
                                    <div><span className="text-lg font-bold text-green-700">{statsLoading ? '-' : dashboardStats.todaysFocus.jobsCompleted}</span><span className="text-[11px] text-green-600 ml-1">Done</span></div>
                                </Link>
                                <Link href="/admin/finance" className="flex items-center justify-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-200 hover:shadow-sm min-h-0">
                                    <IndianRupee className="h-4 w-4 text-gray-600 shrink-0" strokeWidth={1.5} />
                                    <div><span className="text-lg font-bold text-gray-900">{statsLoading ? '-' : dashboardStats.todaysFocus.paymentsDue}</span><span className="text-[11px] text-gray-600 ml-1">₹ Due</span></div>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Alerts ── */}
                <div key="needs-attention">
                    <div className="h-full overflow-auto">
                        <NeedsAttentionBar
                            overduePayments={dashboardStats.alerts.overduePayments}
                            pendingApprovals={pendingApprovals}
                            followUpsDue={dashboardStats.alerts.followUpsDue}
                            blockedJobs={dashboardStats.alerts.blockedJobs}
                            blockedFeedback={dashboardStats.alerts.blockedBreakdown.feedback}
                            loading={statsLoading}
                        />
                    </div>
                </div>

                <div key="invoice-pending">
                    <div className="h-full overflow-auto"><InvoicePendingWidget /></div>
                </div>

                {/* ── Pipeline ── */}
                <div key="pipeline">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" strokeWidth={1.5} /> Job Pipeline</CardTitle>
                                <span className="text-xs text-muted-foreground">{statsLoading ? '...' : `${totalPipelineJobs} active`}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 overflow-auto flex-1">
                            {statsLoading ? (
                                <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
                            ) : totalPipelineJobs === 0 ? (
                                <div className="text-sm text-muted-foreground text-center py-4">No active jobs</div>
                            ) : (
                                <div className="space-y-1">
                                    {pipelineStages.map((stage) => {
                                        const count = dashboardStats.pipeline[stage.key] || 0;
                                        const overdue = dashboardStats.pipelineOverdue[stage.key] || 0;
                                        const pct = totalPipelineJobs > 0 ? (count / totalPipelineJobs) * 100 : 0;
                                        if (count === 0) return null;
                                        return (
                                            <Link key={stage.key} href="/admin/jobs/queue" className="flex items-center gap-2 hover:bg-muted/50 rounded-sm px-1 -mx-1 py-0.5 transition-colors">
                                                <span className="text-[11px] w-16 text-right text-muted-foreground truncate">{stage.label}</span>
                                                <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden relative">
                                                    <div className={`h-full ${stage.color} rounded-sm`} style={{ width: `${Math.max(pct, 8)}%` }} />
                                                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">
                                                        <span className={pct > 15 ? 'text-white' : 'text-gray-700'}>{count}</span>
                                                    </span>
                                                </div>
                                                {overdue > 0 && <span className="text-[10px] text-red-600 font-medium">{overdue} late</span>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Daily Summary ── */}
                <div key="daily-summary"><div className="h-full overflow-auto"><DailySummaryWidget /></div></div>

                {/* ── Overdue ── */}
                <div key="overdue"><div className="h-full overflow-auto"><OverdueAlertsWidget /></div></div>

                {/* ── Team Workload ── */}
                <div key="team-workload"><div className="h-full overflow-auto"><TeamWorkloadWidget /></div></div>

                {/* ── Recent Orders ── */}
                <div key="recent-orders">
                    <Card className="h-full overflow-hidden flex flex-col">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">Recent Orders</CardTitle>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href="/admin/jobs" className="flex items-center gap-1 text-xs">View all <ArrowRight className="h-3 w-3" /></Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-auto px-4 pb-3 flex-1">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">ID</TableHead>
                                        <TableHead className="text-xs">Client</TableHead>
                                        <TableHead className="text-xs">Project</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-right text-xs">Amt</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobsLoading ? (
                                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Loading...</TableCell></TableRow>
                                    ) : recentJobs.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">No recent orders</TableCell></TableRow>
                                    ) : (
                                        recentJobs.map((job) => (
                                            <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/jobs/${job.id}`)}>
                                                <TableCell className="font-medium text-xs py-1.5">#{job.job_number}</TableCell>
                                                <TableCell className="text-xs py-1.5">{job.client?.name || '-'}</TableCell>
                                                <TableCell className="text-xs py-1.5 max-w-[120px] truncate">{job.project_name || '-'}</TableCell>
                                                <TableCell className="py-1.5">
                                                    <Badge variant={job.current_stage === 'delivered' ? 'default' : job.current_stage === 'dispatched' ? 'secondary' : 'outline'}>
                                                        {job.current_stage?.replace('_', ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-xs py-1.5">{formatCurrency(job.total_amount || 0)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Quick Notes ── */}
                <div key="quick-notes"><div className="h-full overflow-auto"><QuickNotesWidget /></div></div>

                {/* ── Sales Performance ── */}
                <div key="sales-perf">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" strokeWidth={1.5} /> Sales Performance</CardTitle>
                            <CardDescription className="text-xs">Monthly revenue</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 overflow-auto flex-1">
                            {statsLoading ? (
                                <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
                            ) : dashboardStats.salesPerformance.length === 0 ? (
                                <div className="text-sm text-muted-foreground text-center py-4">No data</div>
                            ) : (
                                <div className="space-y-1.5">
                                    {dashboardStats.salesPerformance.map((month) => {
                                        const maxVal = Math.max(...dashboardStats.salesPerformance.map(m => m.value), 1);
                                        const pct = (month.value / maxVal) * 100;
                                        return (
                                            <div key={month.month} className="flex items-center gap-2">
                                                <span className={`text-[10px] w-7 text-right ${month.active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{month.month}</span>
                                                <div className="flex-1 h-3.5 bg-gray-100 rounded-sm overflow-hidden">
                                                    <div className={`h-full rounded-sm ${month.active ? 'bg-foreground' : 'bg-gray-300'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                                                </div>
                                                <span className={`text-[10px] w-14 text-right tabular-nums ${month.active ? 'font-bold' : 'text-muted-foreground'}`}>{formatCurrency(month.value)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Calendar ── */}
                <div key="calendar"><div className="h-full overflow-auto"><MiniCalendarWidget /></div></div>

                {/* ── Recent Files ── */}
                <div key="recent-files"><div className="h-full overflow-auto"><RecentFilesWidget showAll={true} limit={15} /></div></div>

            </DashboardGrid>
        </div>
    );
}
