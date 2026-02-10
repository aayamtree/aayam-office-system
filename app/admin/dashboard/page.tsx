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
    Zap,
    Target,
} from 'lucide-react';
import { useDashboardStats, useJobs } from '@/lib/hooks';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import OverdueAlertsWidget from '@/components/dashboard/OverdueAlertsWidget';
import MiniCalendarWidget from '@/components/dashboard/MiniCalendarWidget';
import QuickNotesWidget from '@/components/dashboard/QuickNotesWidget';
import TeamWorkloadWidget from '@/components/dashboard/TeamWorkloadWidget';
import DailySummaryWidget from '@/components/dashboard/DailySummaryWidget';

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
        { key: 'design', label: 'Design', color: 'bg-violet-500' },
        { key: 'approval', label: 'Approval', color: 'bg-amber-500' },
        { key: 'printing', label: 'Printing', color: 'bg-gray-800' },
        { key: 'finishing', label: 'Finishing', color: 'bg-cyan-500' },
        { key: 'ready', label: 'Ready', color: 'bg-emerald-500' },
        { key: 'packed', label: 'Packed', color: 'bg-teal-500' },
        { key: 'dispatched', label: 'Dispatched', color: 'bg-gray-400' },
    ];

    const totalPipelineJobs = Object.values(dashboardStats.pipeline).reduce((a, b) => a + b, 0);

    const hasAlerts = dashboardStats.alerts.overduePayments > 0 ||
        dashboardStats.alerts.followUpsDue > 0 ||
        dashboardStats.alerts.blockedJobs > 0;


    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-x-hidden">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-page-title tracking-tight">Dashboard</h2>
            </div>

            {/* Row 1: KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <IndianRupee className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-page-title">
                            {statsLoading ? '...' : formatCurrency(dashboardStats.totalRevenue)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Lifetime invoice total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-page-title">
                            {statsLoading ? '...' : dashboardStats.activeJobs}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Currently in production
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-page-title">
                            {statsLoading ? '...' : formatCurrency(dashboardStats.pendingPayments)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Outstanding invoices
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads This Month</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-page-title">
                            {statsLoading ? '...' : dashboardStats.leadsThisMonth}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            New opportunities
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Today's Focus + Pipeline | Activity Feed */}
            <div className="grid gap-4 lg:grid-cols-5">
                {/* Left Column (3/5) */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Today's Focus */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Target className="h-4 w-4" strokeWidth={1.5} />
                                Today&apos;s Focus
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="flex flex-col items-center p-3 rounded-md bg-amber-50 border border-amber-100">
                                    <Clock className="h-4 w-4 text-amber-600 mb-1" strokeWidth={1.5} />
                                    <span className="text-xl font-bold text-amber-700">
                                        {statsLoading ? '-' : dashboardStats.todaysFocus.jobsDue}
                                    </span>
                                    <span className="text-xs text-amber-600">Jobs Due</span>
                                </div>
                                <div className="flex flex-col items-center p-3 rounded-md bg-red-50 border border-red-100">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mb-1" strokeWidth={1.5} />
                                    <span className="text-xl font-bold text-red-700">
                                        {statsLoading ? '-' : dashboardStats.todaysFocus.jobsDelayed}
                                    </span>
                                    <span className="text-xs text-red-600">Delayed</span>
                                </div>
                                <div className="flex flex-col items-center p-3 rounded-md bg-green-50 border border-green-100">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mb-1" strokeWidth={1.5} />
                                    <span className="text-xl font-bold text-green-700">
                                        {statsLoading ? '-' : dashboardStats.todaysFocus.jobsCompleted}
                                    </span>
                                    <span className="text-xs text-green-600">Completed</span>
                                </div>
                                <div className="flex flex-col items-center p-3 rounded-md bg-gray-50 border border-gray-200">
                                    <IndianRupee className="h-4 w-4 text-gray-600 mb-1" strokeWidth={1.5} />
                                    <span className="text-xl font-bold text-gray-900">
                                        {statsLoading ? '-' : dashboardStats.todaysFocus.paymentsDue}
                                    </span>
                                    <span className="text-xs text-gray-600">Payments Due</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Alerts Banner - only if there are alerts */}
                    {!statsLoading && hasAlerts && (
                        <Card className="border-amber-200 bg-amber-50/50">
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <Zap className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
                                    <span className="text-sm font-medium text-amber-800">Needs Attention</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {dashboardStats.alerts.overduePayments > 0 && (
                                        <Link href="/admin/finance">
                                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer gap-1">
                                                <span className="font-bold">{dashboardStats.alerts.overduePayments}</span> Overdue Payments
                                            </Badge>
                                        </Link>
                                    )}
                                    {dashboardStats.alerts.followUpsDue > 0 && (
                                        <Link href="/admin/marketing/follow-ups">
                                            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 cursor-pointer gap-1">
                                                <span className="font-bold">{dashboardStats.alerts.followUpsDue}</span> Follow-ups Due
                                            </Badge>
                                        </Link>
                                    )}
                                    {dashboardStats.alerts.blockedJobs > 0 && (
                                        <Link href="/admin/jobs">
                                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer gap-1">
                                                <span className="font-bold">{dashboardStats.alerts.blockedJobs}</span> Blocked Jobs
                                                {dashboardStats.alerts.blockedBreakdown.feedback > 0 &&
                                                    <span className="text-xs opacity-70">({dashboardStats.alerts.blockedBreakdown.feedback} feedback)</span>
                                                }
                                            </Badge>
                                        </Link>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Job Pipeline */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Activity className="h-4 w-4" strokeWidth={1.5} />
                                    Job Pipeline
                                </CardTitle>
                                <span className="text-sm text-muted-foreground">
                                    {statsLoading ? '...' : `${totalPipelineJobs} active`}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {statsLoading ? (
                                <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
                            ) : totalPipelineJobs === 0 ? (
                                <div className="text-sm text-muted-foreground text-center py-4">No active jobs in pipeline</div>
                            ) : (
                                <div className="space-y-2">
                                    {pipelineStages.map((stage) => {
                                        const count = dashboardStats.pipeline[stage.key] || 0;
                                        const overdue = dashboardStats.pipelineOverdue[stage.key] || 0;
                                        const percentage = totalPipelineJobs > 0 ? (count / totalPipelineJobs) * 100 : 0;

                                        if (count === 0) return null;

                                        return (
                                            <div key={stage.key} className="flex items-center gap-3">
                                                <span className="text-xs w-16 text-right text-muted-foreground truncate">{stage.label}</span>
                                                <div className="flex-1 h-6 bg-gray-100 rounded-sm overflow-hidden relative">
                                                    <div
                                                        className={`h-full ${stage.color} rounded-sm transition-all duration-500`}
                                                        style={{ width: `${Math.max(percentage, 8)}%` }}
                                                    />
                                                    <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                                                        <span className={percentage > 15 ? 'text-white' : 'text-gray-700'}>
                                                            {count}
                                                        </span>
                                                    </span>
                                                </div>
                                                {overdue > 0 && (
                                                    <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                                                        {overdue} late
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column (2/5): Daily Summary + Overdue Alerts */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Daily Summary */}
                    <DailySummaryWidget />

                    {/* Overdue Alerts */}
                    <OverdueAlertsWidget />
                </div>
            </div>

            {/* Row 3: Calendar + Team Workload + Quick Notes */}
            <div className="grid gap-4 lg:grid-cols-3">
                <div>
                    <MiniCalendarWidget />
                </div>
                <div>
                    <TeamWorkloadWidget />
                </div>
                <div>
                    <QuickNotesWidget />
                </div>
            </div>

            {/* Row 4: Recent Orders + Sales Performance */}
            <div className="grid gap-4 lg:grid-cols-5">
                {/* Recent Orders (3/5) */}
                <Card className="lg:col-span-3 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Recent Orders</CardTitle>
                                <CardDescription>
                                    You have {dashboardStats.activeJobs || 0} active orders.
                                </CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/admin/jobs" className="flex items-center gap-1 text-xs">
                                    View all <ArrowRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table className="min-w-[500px] md:min-w-0">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : recentJobs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            No recent orders
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    recentJobs.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell className="font-medium">
                                                #{job.job_number}
                                            </TableCell>
                                            <TableCell>{job.client?.name || '-'}</TableCell>
                                            <TableCell>{job.project_name || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    job.current_stage === 'delivered' ? 'default' :
                                                        job.current_stage === 'dispatched' ? 'secondary' :
                                                            'outline'
                                                }>
                                                    {job.current_stage?.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(job.total_amount || 0)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Sales Performance (2/5) */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
                            Sales Performance
                        </CardTitle>
                        <CardDescription>Monthly revenue this year</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
                        ) : dashboardStats.salesPerformance.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-8">No sales data yet</div>
                        ) : (
                            <div className="space-y-3">
                                {dashboardStats.salesPerformance.map((month) => {
                                    const maxVal = Math.max(...dashboardStats.salesPerformance.map(m => m.value), 1);
                                    const percentage = (month.value / maxVal) * 100;
                                    return (
                                        <div key={month.month} className="flex items-center gap-3">
                                            <span className={`text-xs w-8 text-right ${month.active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                                                {month.month}
                                            </span>
                                            <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-sm transition-all duration-500 ${month.active ? 'bg-foreground' : 'bg-gray-300'}`}
                                                    style={{ width: `${Math.max(percentage, 3)}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs w-14 md:w-20 text-right tabular-nums ${month.active ? 'font-bold' : 'text-muted-foreground'}`}>
                                                {formatCurrency(month.value)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
