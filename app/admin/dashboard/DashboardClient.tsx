'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    Package, CreditCard, IndianRupee, AlertTriangle, Clock,
    CheckCircle2, TrendingUp, ArrowRight, Activity, Target,
    Lock, Unlock, RotateCcw, GripVertical, Settings,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import NeedsAttentionBar from '@/components/dashboard/NeedsAttentionBar';
import DashboardGrid, { resetLayouts, type LayoutsMap } from '@/components/dashboard/DashboardGrid';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import OverdueAlertsWidget from '@/components/dashboard/OverdueAlertsWidget';
import MiniCalendarWidget from '@/components/dashboard/MiniCalendarWidget';
import QuickNotesWidget from '@/components/dashboard/QuickNotesWidget';
import TeamWorkloadWidget from '@/components/dashboard/TeamWorkloadWidget';
import DailySummaryWidget from '@/components/dashboard/DailySummaryWidget';
import RecentFilesWidget from '@/components/dashboard/RecentFilesWidget';
import InvoicePendingWidget from '@/components/dashboard/InvoicePendingWidget';

import type { DashboardData } from '@/lib/dashboard-data';

// ─── Default Grid Layouts per breakpoint ───────────────────────
const DEFAULT_LAYOUTS: LayoutsMap = {
    lg: [
        { i: 'kpi-revenue', x: 0, y: 0, w: 3, h: 2 },
        { i: 'kpi-jobs', x: 3, y: 0, w: 3, h: 2 },
        { i: 'kpi-payments', x: 6, y: 0, w: 3, h: 2 },
        { i: 'kpi-orders', x: 9, y: 0, w: 3, h: 2 },
        { i: 'todays-focus', x: 0, y: 2, w: 12, h: 2 },
        { i: 'pipeline', x: 0, y: 4, w: 6, h: 5 },
        { i: 'daily-summary', x: 6, y: 4, w: 6, h: 5 },
        { i: 'needs-attention', x: 0, y: 9, w: 6, h: 4 },
        { i: 'invoice-pending', x: 6, y: 9, w: 6, h: 4 },
        { i: 'overdue', x: 0, y: 13, w: 6, h: 4 },
        { i: 'team-workload', x: 6, y: 13, w: 6, h: 4 },
        { i: 'recent-orders', x: 0, y: 17, w: 6, h: 5 },
        { i: 'quick-notes', x: 6, y: 17, w: 6, h: 5 },
        { i: 'sales-perf', x: 0, y: 22, w: 6, h: 5 },
        { i: 'calendar', x: 6, y: 22, w: 6, h: 5 },
        { i: 'recent-files', x: 0, y: 27, w: 12, h: 4 },
    ],
    md: [
        { i: 'kpi-revenue', x: 0, y: 0, w: 3, h: 2 },
        { i: 'kpi-jobs', x: 3, y: 0, w: 3, h: 2 },
        { i: 'kpi-payments', x: 0, y: 2, w: 3, h: 2 },
        { i: 'kpi-orders', x: 3, y: 2, w: 3, h: 2 },
        { i: 'todays-focus', x: 0, y: 4, w: 6, h: 3 },
        { i: 'pipeline', x: 0, y: 7, w: 6, h: 5 },
        { i: 'daily-summary', x: 0, y: 12, w: 6, h: 5 },
        { i: 'needs-attention', x: 0, y: 17, w: 6, h: 4 },
        { i: 'invoice-pending', x: 0, y: 21, w: 6, h: 4 },
        { i: 'overdue', x: 0, y: 25, w: 3, h: 4 },
        { i: 'team-workload', x: 3, y: 25, w: 3, h: 4 },
        { i: 'recent-orders', x: 0, y: 29, w: 6, h: 5 },
        { i: 'quick-notes', x: 0, y: 34, w: 6, h: 5 },
        { i: 'sales-perf', x: 0, y: 39, w: 3, h: 5 },
        { i: 'calendar', x: 3, y: 39, w: 3, h: 5 },
        { i: 'recent-files', x: 0, y: 44, w: 6, h: 4 },
    ],
    sm: [
        { i: 'kpi-revenue', x: 0, y: 0, w: 1, h: 2 },
        { i: 'kpi-jobs', x: 1, y: 0, w: 1, h: 2 },
        { i: 'kpi-payments', x: 0, y: 2, w: 1, h: 2 },
        { i: 'kpi-orders', x: 1, y: 2, w: 1, h: 2 },
        { i: 'todays-focus', x: 0, y: 4, w: 2, h: 3 },
        { i: 'daily-summary', x: 0, y: 7, w: 2, h: 5 },
        { i: 'pipeline', x: 0, y: 12, w: 2, h: 5 },
        { i: 'needs-attention', x: 0, y: 17, w: 2, h: 4 },
        { i: 'invoice-pending', x: 0, y: 21, w: 2, h: 4 },
        { i: 'overdue', x: 0, y: 25, w: 2, h: 4 },
        { i: 'team-workload', x: 0, y: 29, w: 2, h: 4 },
        { i: 'recent-orders', x: 0, y: 33, w: 2, h: 5 },
        { i: 'quick-notes', x: 0, y: 38, w: 2, h: 5 },
        { i: 'sales-perf', x: 0, y: 43, w: 2, h: 5 },
        { i: 'calendar', x: 0, y: 48, w: 2, h: 5 },
        { i: 'recent-files', x: 0, y: 53, w: 2, h: 4 },
    ],
};

// ─── Widget registry (key → human-readable label) ─────────────
const WIDGET_LABELS: Record<string, string> = {
    'kpi-revenue': '💰 Total Revenue',
    'kpi-jobs': '📦 Active Jobs',
    'kpi-payments': '💳 Pending Payments',
    'kpi-orders': '📋 Orders This Month',
    'todays-focus': '🎯 Today\'s Focus',
    'needs-attention': '⚠️ Needs Attention',
    'invoice-pending': '🧾 Pending Invoices',
    'pipeline': '📊 Job Pipeline',
    'daily-summary': '📝 Daily Summary',
    'overdue': '⏰ Overdue Alerts',
    'team-workload': '👥 Team Workload',
    'recent-orders': '🛒 Recent Orders',
    'quick-notes': '📌 Quick Notes',
    'sales-perf': '📈 Sales Performance',
    'calendar': '📅 Calendar',
    'recent-files': '📁 Recent Files',
};
const ALL_WIDGET_KEYS = Object.keys(WIDGET_LABELS);
const WIDGET_VISIBILITY_KEY = 'aayam-dashboard-widgets-v1';

function loadWidgetVisibility(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
        const saved = localStorage.getItem(WIDGET_VISIBILITY_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
}

function saveWidgetVisibility(vis: Record<string, boolean>) {
    try { localStorage.setItem(WIDGET_VISIBILITY_KEY, JSON.stringify(vis)); } catch { }
}

interface DashboardClientProps {
    serverData: DashboardData;
}

export default function DashboardClient({ serverData }: DashboardClientProps) {
    const { profile } = useAuth();
    const router = useRouter();

    // Use server-fetched data directly — no SWR, no client-side fetch
    const dashboardStats = serverData;
    const recentJobs = serverData.recentJobs;

    const [isLocked, setIsLocked] = useState(true);
    const [showWidgetSettings, setShowWidgetSettings] = useState(false);

    // Widget visibility: default all ON, user can toggle OFF
    const [widgetVisibility, setWidgetVisibility] = useState<Record<string, boolean>>(() => {
        const saved = loadWidgetVisibility();
        const vis: Record<string, boolean> = {};
        ALL_WIDGET_KEYS.forEach(k => vis[k] = saved[k] !== undefined ? saved[k] : true);
        return vis;
    });

    const toggleWidget = (key: string) => {
        setWidgetVisibility(prev => {
            const next = { ...prev, [key]: !prev[key] };
            saveWidgetVisibility(next);
            return next;
        });
    };

    const showAllWidgets = () => {
        const all: Record<string, boolean> = {};
        ALL_WIDGET_KEYS.forEach(k => all[k] = true);
        setWidgetVisibility(all);
        saveWidgetVisibility(all);
    };

    const isWidgetVisible = (key: string) => widgetVisibility[key] !== false;

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
        // Also clear widget visibility + old storage keys
        localStorage.removeItem(WIDGET_VISIBILITY_KEY);
        localStorage.removeItem('aayam-dashboard-layouts-v3');
        showAllWidgets();
        window.location.reload();
    };

    return (
        <div className="flex-1 p-4 md:p-6 pt-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-page-title tracking-tight">Dashboard</h2>
                <div className="flex items-center gap-2">
                    <Popover open={showWidgetSettings} onOpenChange={setShowWidgetSettings}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs gap-1.5">
                                <Settings className="h-3 w-3" /> Widgets
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 p-0">
                            <div className="px-3 py-2 border-b flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-700">Show / Hide Widgets</span>
                                <button onClick={showAllWidgets} className="text-[10px] text-blue-600 hover:underline">Show All</button>
                            </div>
                            <div className="max-h-72 overflow-y-auto py-1">
                                {ALL_WIDGET_KEYS.map(key => (
                                    <label key={key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={widgetVisibility[key] !== false}
                                            onChange={() => toggleWidget(key)}
                                            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                        />
                                        <span className="text-xs text-gray-700">{WIDGET_LABELS[key]}</span>
                                    </label>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
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
                {isWidgetVisible('kpi-revenue') && <div key="kpi-revenue">
                    <Link href="/admin/finance" className="block h-full">
                        <Card className="h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                <IndianRupee className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{formatCurrency(dashboardStats.totalRevenue)}</div>
                                <p className="text-xs text-muted-foreground">Lifetime invoice total</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>}

                {isWidgetVisible('kpi-jobs') && <div key="kpi-jobs">
                    <Link href="/admin/jobs" className="block h-full">
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{dashboardStats.activeJobs}</div>
                                <p className="text-xs text-muted-foreground">Currently in production</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>}

                {isWidgetVisible('kpi-payments') && <div key="kpi-payments">
                    <Link href="/admin/finance/payments" className="block h-full">
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                                <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{formatCurrency(dashboardStats.pendingPayments)}</div>
                                <p className="text-xs text-muted-foreground">Outstanding invoices</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>}

                {isWidgetVisible('kpi-orders') && <div key="kpi-orders">
                    <Link href="/admin/sales/orders" className="block h-full">
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-medium">Orders This Month</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            </CardHeader>
                            <CardContent className="px-4 pb-3 flex-1 flex flex-col justify-center">
                                <div className="text-xl font-bold">{dashboardStats.ordersThisMonth}</div>
                                <p className="text-xs text-muted-foreground">New orders created</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>}

                {/* ── Today's Focus ── */}
                {isWidgetVisible('todays-focus') && <div key="todays-focus">
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
                                    <div><span className="text-lg font-bold text-amber-700">{dashboardStats.todaysFocus.jobsDue}</span><span className="text-[11px] text-amber-600 ml-1">Due</span></div>
                                </Link>
                                <Link href="/admin/jobs" className="flex items-center justify-center gap-2 p-2 rounded-md bg-red-50 border border-red-100 hover:shadow-sm min-h-0">
                                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" strokeWidth={1.5} />
                                    <div><span className="text-lg font-bold text-red-700">{dashboardStats.todaysFocus.jobsDelayed}</span><span className="text-[11px] text-red-600 ml-1">Delayed</span></div>
                                </Link>
                                <Link href="/admin/jobs" className="flex items-center justify-center gap-2 p-2 rounded-md bg-green-50 border border-green-100 hover:shadow-sm min-h-0">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" strokeWidth={1.5} />
                                    <div><span className="text-lg font-bold text-green-700">{dashboardStats.todaysFocus.jobsCompleted}</span><span className="text-[11px] text-green-600 ml-1">Done</span></div>
                                </Link>
                                <Link href="/admin/finance" className="flex items-center justify-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-200 hover:shadow-sm min-h-0">
                                    <IndianRupee className="h-4 w-4 text-gray-600 shrink-0" strokeWidth={1.5} />
                                    <div><span className="text-lg font-bold text-gray-900">{dashboardStats.todaysFocus.paymentsDue}</span><span className="text-[11px] text-gray-600 ml-1">₹ Due</span></div>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>}

                {/* ── Alerts ── */}
                {isWidgetVisible('needs-attention') && <div key="needs-attention">
                    <div className="h-full overflow-auto">
                        <NeedsAttentionBar
                            overduePayments={dashboardStats.alerts.overduePayments}
                            pendingApprovals={pendingApprovals}
                            followUpsDue={dashboardStats.alerts.followUpsDue}
                            blockedJobs={dashboardStats.alerts.blockedJobs}
                            blockedFeedback={dashboardStats.alerts.blockedBreakdown.feedback}
                            loading={false}
                        />
                    </div>
                </div>}

                {isWidgetVisible('invoice-pending') && <div key="invoice-pending">
                    <div className="h-full overflow-auto"><InvoicePendingWidget /></div>
                </div>}

                {/* ── Pipeline ── */}
                {isWidgetVisible('pipeline') && <div key="pipeline">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" strokeWidth={1.5} /> Job Pipeline</CardTitle>
                                <span className="text-xs text-muted-foreground">{`${totalPipelineJobs} active`}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 overflow-auto flex-1">
                            {totalPipelineJobs === 0 ? (
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
                </div>}

                {/* ── Daily Summary ── */}
                {isWidgetVisible('daily-summary') && <div key="daily-summary"><div className="h-full overflow-auto"><DailySummaryWidget /></div></div>}

                {/* ── Overdue ── */}
                {isWidgetVisible('overdue') && <div key="overdue"><div className="h-full overflow-auto"><OverdueAlertsWidget /></div></div>}

                {/* ── Team Workload ── */}
                {isWidgetVisible('team-workload') && <div key="team-workload"><div className="h-full overflow-auto"><TeamWorkloadWidget /></div></div>}

                {/* ── Recent Orders ── */}
                {isWidgetVisible('recent-orders') && <div key="recent-orders">
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
                                    {recentJobs.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">No recent orders</TableCell></TableRow>
                                    ) : (
                                        recentJobs.map((job: any) => (
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
                </div>}

                {/* ── Quick Notes ── */}
                {isWidgetVisible('quick-notes') && <div key="quick-notes"><div className="h-full overflow-auto"><QuickNotesWidget /></div></div>}

                {/* ── Sales Performance ── */}
                {isWidgetVisible('sales-perf') && <div key="sales-perf">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" strokeWidth={1.5} /> Sales Performance</CardTitle>
                            <CardDescription className="text-xs">Monthly revenue</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 overflow-auto flex-1">
                            {dashboardStats.salesPerformance.length === 0 ? (
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
                </div>}

                {/* ── Calendar ── */}
                {isWidgetVisible('calendar') && <div key="calendar"><div className="h-full overflow-auto"><MiniCalendarWidget /></div></div>}

                {/* ── Recent Files ── */}
                {isWidgetVisible('recent-files') && <div key="recent-files"><div className="h-full overflow-auto"><RecentFilesWidget showAll={true} limit={15} /></div></div>}

            </DashboardGrid>
        </div>
    );
}
