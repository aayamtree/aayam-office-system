'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Package,
    ArrowUpRight,
    CreditCard,
    IndianRupee,
    Users,
    AlertTriangle,
    Clock,
    CheckCircle2,
    TrendingUp,
    ArrowRight,
    Activity,
    Target,
} from 'lucide-react';
import { useDashboardStats, useJobs } from '@/lib/hooks';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import NeedsAttentionBar from '@/components/dashboard/NeedsAttentionBar';
import OverdueAlertsWidget from '@/components/dashboard/OverdueAlertsWidget';
import MiniCalendarWidget from '@/components/dashboard/MiniCalendarWidget';
import QuickNotesWidget from '@/components/dashboard/QuickNotesWidget';
import TeamWorkloadWidget from '@/components/dashboard/TeamWorkloadWidget';
import DailySummaryWidget from '@/components/dashboard/DailySummaryWidget';
import RecentFilesWidget from '@/components/dashboard/RecentFilesWidget';
import InvoicePendingWidget from '@/components/dashboard/InvoicePendingWidget';

export default function AdminDashboardShadcn() {
    const { profile } = useAuth();
    const router = useRouter();
    const { stats: dashboardStats, loading: statsLoading } = useDashboardStats();
    const { jobs: recentJobs, loading: jobsLoading } = useJobs({
        limit: 5,
        orderBy: { column: 'created_at', ascending: false }
    });

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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Pipeline stages in order
    const pipelineStages = [
        { key: 'awaiting_admin', label: 'Pending Approval', color: 'bg-orange-500' },
        { key: 'new', label: 'New', color: 'bg-blue-500' },
        { key: 'designing', label: 'Designing', color: 'bg-violet-500' },
        { key: 'approval', label: 'Client Approval', color: 'bg-amber-500' },
        { key: 'printing', label: 'Printing', color: 'bg-gray-800' },
        { key: 'finishing', label: 'Finishing', color: 'bg-cyan-500' },
        { key: 'ready', label: 'Ready', color: 'bg-emerald-500' },
        { key: 'packed', label: 'Packed', color: 'bg-teal-500' },
        { key: 'dispatched', label: 'Dispatched', color: 'bg-gray-400' },
    ];

    const totalPipelineJobs = Object.values(dashboardStats.pipeline).reduce((a, b) => a + b, 0);

    const pendingApprovals = dashboardStats.pipeline['awaiting_admin'] || 0;

    return (
        <div className="flex-1 space-y-4 p-4 md:p-6 pt-6 overflow-x-hidden">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-page-title tracking-tight">Dashboard</h2>
            </div>

            {/* ═══════════════════════════════════════════════════════
                ROW 1: KPI Cards — 4 equal columns
               ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Link href="/admin/finance">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <IndianRupee className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-page-title">
                                {statsLoading ? '...' : formatCurrency(dashboardStats.totalRevenue)}
                            </div>
                            <p className="text-xs text-muted-foreground">Lifetime invoice total</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/jobs">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-page-title">
                                {statsLoading ? '...' : dashboardStats.activeJobs}
                            </div>
                            <p className="text-xs text-muted-foreground">Currently in production</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/finance/payments">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-page-title">
                                {statsLoading ? '...' : formatCurrency(dashboardStats.pendingPayments)}
                            </div>
                            <p className="text-xs text-muted-foreground">Outstanding invoices</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/sales/orders">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Orders This Month</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-page-title">
                                {statsLoading ? '...' : dashboardStats.ordersThisMonth}
                            </div>
                            <p className="text-xs text-muted-foreground">New orders created</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* ═══════════════════════════════════════════════════════
                ROW 2: Today's Focus (full width, compact)
               ═══════════════════════════════════════════════════════ */}
            <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" strokeWidth={1.5} />
                        Today&apos;s Focus
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                    <div className="grid grid-cols-4 gap-2">
                        <Link href="/admin/jobs" className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-100 hover:shadow-sm transition-shadow cursor-pointer">
                            <Clock className="h-4 w-4 text-amber-600 shrink-0" strokeWidth={1.5} />
                            <div>
                                <span className="text-lg font-bold text-amber-700">{statsLoading ? '-' : dashboardStats.todaysFocus.jobsDue}</span>
                                <span className="text-xs text-amber-600 ml-1.5">Jobs Due</span>
                            </div>
                        </Link>
                        <Link href="/admin/jobs" className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 border border-red-100 hover:shadow-sm transition-shadow cursor-pointer">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" strokeWidth={1.5} />
                            <div>
                                <span className="text-lg font-bold text-red-700">{statsLoading ? '-' : dashboardStats.todaysFocus.jobsDelayed}</span>
                                <span className="text-xs text-red-600 ml-1.5">Delayed</span>
                            </div>
                        </Link>
                        <Link href="/admin/jobs" className="flex items-center gap-2 p-2.5 rounded-md bg-green-50 border border-green-100 hover:shadow-sm transition-shadow cursor-pointer">
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" strokeWidth={1.5} />
                            <div>
                                <span className="text-lg font-bold text-green-700">{statsLoading ? '-' : dashboardStats.todaysFocus.jobsCompleted}</span>
                                <span className="text-xs text-green-600 ml-1.5">Completed</span>
                            </div>
                        </Link>
                        <Link href="/admin/finance" className="flex items-center gap-2 p-2.5 rounded-md bg-gray-50 border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer">
                            <IndianRupee className="h-4 w-4 text-gray-600 shrink-0" strokeWidth={1.5} />
                            <div>
                                <span className="text-lg font-bold text-gray-900">{statsLoading ? '-' : dashboardStats.todaysFocus.paymentsDue}</span>
                                <span className="text-xs text-gray-600 ml-1.5">Payments Due</span>
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════
                ROW 3: Alerts Row — Needs Attention + Invoice Pending
               ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <NeedsAttentionBar
                    overduePayments={dashboardStats.alerts.overduePayments}
                    pendingApprovals={pendingApprovals}
                    followUpsDue={dashboardStats.alerts.followUpsDue}
                    blockedJobs={dashboardStats.alerts.blockedJobs}
                    blockedFeedback={dashboardStats.alerts.blockedBreakdown.feedback}
                    loading={statsLoading}
                />
                <InvoicePendingWidget />
            </div>

            {/* ═══════════════════════════════════════════════════════
                ROW 4: Pipeline + Daily Summary — 1:1 split
               ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Job Pipeline */}
                <Card className="h-full">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Activity className="h-4 w-4" strokeWidth={1.5} />
                                Job Pipeline
                            </CardTitle>
                            <span className="text-xs text-muted-foreground">
                                {statsLoading ? '...' : `${totalPipelineJobs} active`}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                        {statsLoading ? (
                            <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
                        ) : totalPipelineJobs === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-4">No active jobs in pipeline</div>
                        ) : (
                            <div className="space-y-1.5">
                                {pipelineStages.map((stage) => {
                                    const count = dashboardStats.pipeline[stage.key] || 0;
                                    const overdue = dashboardStats.pipelineOverdue[stage.key] || 0;
                                    const percentage = totalPipelineJobs > 0 ? (count / totalPipelineJobs) * 100 : 0;

                                    if (count === 0) return null;

                                    return (
                                        <Link key={stage.key} href="/admin/jobs/queue" className="flex items-center gap-2 hover:bg-muted/50 rounded-sm px-1 -mx-1 py-0.5 transition-colors cursor-pointer">
                                            <span className="text-[11px] w-20 text-right text-muted-foreground truncate">{stage.label}</span>
                                            <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden relative">
                                                <div
                                                    className={`h-full ${stage.color} rounded-sm transition-all duration-500`}
                                                    style={{ width: `${Math.max(percentage, 8)}%` }}
                                                />
                                                <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium">
                                                    <span className={percentage > 15 ? 'text-white' : 'text-gray-700'}>
                                                        {count}
                                                    </span>
                                                </span>
                                            </div>
                                            {overdue > 0 && (
                                                <span className="text-[11px] text-red-600 font-medium whitespace-nowrap">
                                                    {overdue} late
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Summary */}
                <DailySummaryWidget />
            </div>

            {/* ═══════════════════════════════════════════════════════
                ROW 5: Overdue + Team Workload — 1:1 split
               ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <OverdueAlertsWidget />
                <TeamWorkloadWidget />
            </div>

            {/* ═══════════════════════════════════════════════════════
                ROW 6: Recent Orders (wider) + Quick Notes
               ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                <Card className="lg:col-span-3 overflow-hidden">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Recent Orders</CardTitle>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/admin/jobs" className="flex items-center gap-1 text-xs">
                                    View all <ArrowRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto px-4 pb-3">
                        <Table className="min-w-[500px] md:min-w-0">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Order ID</TableHead>
                                    <TableHead className="text-xs">Client</TableHead>
                                    <TableHead className="text-xs">Project</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-right text-xs">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : recentJobs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                                            No recent orders
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    recentJobs.map((job) => (
                                        <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/jobs/${job.id}`)}>
                                            <TableCell className="font-medium text-sm py-2">
                                                #{job.job_number}
                                            </TableCell>
                                            <TableCell className="text-sm py-2">{job.client?.name || '-'}</TableCell>
                                            <TableCell className="text-sm py-2">{job.project_name || '-'}</TableCell>
                                            <TableCell className="py-2">
                                                <Badge variant={
                                                    job.current_stage === 'delivered' ? 'default' :
                                                        job.current_stage === 'dispatched' ? 'secondary' :
                                                            'outline'
                                                }>
                                                    {job.current_stage?.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm py-2">
                                                {formatCurrency(job.total_amount || 0)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2">
                    <QuickNotesWidget />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                ROW 7: Sales Performance + Calendar — 1:1 split
               ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Sales Performance */}
                <Card className="h-full">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
                            Sales Performance
                        </CardTitle>
                        <CardDescription className="text-xs">Monthly revenue this year</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                        {statsLoading ? (
                            <div className="text-sm text-muted-foreground text-center py-6">Loading...</div>
                        ) : dashboardStats.salesPerformance.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-6">No sales data yet</div>
                        ) : (
                            <div className="space-y-2">
                                {dashboardStats.salesPerformance.map((month) => {
                                    const maxVal = Math.max(...dashboardStats.salesPerformance.map(m => m.value), 1);
                                    const percentage = (month.value / maxVal) * 100;
                                    return (
                                        <div key={month.month} className="flex items-center gap-2">
                                            <span className={`text-[11px] w-8 text-right ${month.active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                                                {month.month}
                                            </span>
                                            <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-sm transition-all duration-500 ${month.active ? 'bg-foreground' : 'bg-gray-300'}`}
                                                    style={{ width: `${Math.max(percentage, 3)}%` }}
                                                />
                                            </div>
                                            <span className={`text-[11px] w-16 text-right tabular-nums ${month.active ? 'font-bold' : 'text-muted-foreground'}`}>
                                                {formatCurrency(month.value)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <MiniCalendarWidget />
            </div>

            {/* ═══════════════════════════════════════════════════════
                ROW 8: Recent Files (full width)
               ═══════════════════════════════════════════════════════ */}
            <RecentFilesWidget showAll={true} limit={15} />
        </div>
    );
}
