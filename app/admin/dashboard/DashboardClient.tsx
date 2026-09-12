'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    Package, IndianRupee, AlertTriangle, Clock,
    ArrowRight, Activity, Target, CheckCircle2, TrendingUp,
    Settings, Eye, EyeOff, TrendingDown, Minus,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import NeedsAttentionBar from '@/components/dashboard/NeedsAttentionBar';
import OverdueAlertsWidget from '@/components/dashboard/OverdueAlertsWidget';
import QuickNotesWidget from '@/components/dashboard/QuickNotesWidget';
import MiniCalendarWidget from '@/components/dashboard/MiniCalendarWidget';
import TeamWorkloadWidget from '@/components/dashboard/TeamWorkloadWidget';
import DailySummaryWidget from '@/components/dashboard/DailySummaryWidget';
import RecentFilesWidget from '@/components/dashboard/RecentFilesWidget';
import InvoicePendingWidget from '@/components/dashboard/InvoicePendingWidget';
import RecentActivityWidget from '@/components/dashboard/RecentActivityWidget';
import CMYKDashboardWidget from '@/components/dashboard/CMYKDashboardWidget';
import MissingRecordsStrip from '@/components/dashboard/MissingRecordsStrip';
import { GlobalErrorBoundary } from '@/components/ErrorBoundary';

import type { DashboardData } from '@/lib/dashboard-data';

// ─── Widget registry ───────────────────────────────────────────
const WIDGET_LABELS: Record<string, string> = {
    'kpi': '💰 KPI Cards',
    'todays-focus': '🎯 Today\'s Focus',
    'needs-attention': '⚡ Needs Attention',
    'pipeline': '📊 Job Pipeline',
    'invoice-pending': '🧾 Invoice Pending',
    'recent-orders': '📋 Recent Orders',
    'overdue': '⏰ Overdue Alerts',
    'daily-summary': '📝 Daily Summary',
    'team-workload': '👥 Team Workload',
    'sales-perf': '📈 Sales Performance',
    'calendar': '📅 Calendar',
    'quick-notes': '🗒️ Quick Notes',
    'recent-activity': '⚡ Recent Activity',
};
const ALL_WIDGET_KEYS = Object.keys(WIDGET_LABELS);
const WIDGET_VISIBILITY_KEY = 'aayam-dashboard-widgets-v2';

function loadWidgetVisibility(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
        const saved = localStorage.getItem(WIDGET_VISIBILITY_KEY);
        if (saved) return JSON.parse(saved);
    } catch { }
    return {};
}

function saveWidgetVisibility(vis: Record<string, boolean>) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(WIDGET_VISIBILITY_KEY, JSON.stringify(vis)); } catch { }
}

// ─── Component ─────────────────────────────────────────────────
interface DashboardClientProps { serverData: DashboardData; }

export default function DashboardClient({ serverData }: DashboardClientProps) {
    const { profile } = useAuth();
    const router = useRouter();

    const dashboardStats = serverData;
    const recentJobs = serverData.recentJobs;

    const [showWidgetSettings, setShowWidgetSettings] = useState(false);
    const [widgetVisibility, setWidgetVisibility] = useState<Record<string, boolean>>(() => {
        const saved = loadWidgetVisibility();
        const vis: Record<string, boolean> = {};
        ALL_WIDGET_KEYS.forEach(k => vis[k] = saved[k] !== undefined ? saved[k] : true);
        return vis;
    });
    // Recent Orders — approve state
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});
    const [approveErrors, setApproveErrors] = useState<Record<string, string>>({});

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

    const isVisible = (key: string) => widgetVisibility[key] !== false;

    // One-click approve for Recent Orders table
    const handleRecentOrderApprove = async (jobId: string, action: 'approve' | 'reject') => {
        setApprovingId(jobId);
        setApproveErrors(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        try {
            const res = await fetch(`/api/jobs/${jobId}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed');
            setStageOverrides(prev => ({ ...prev, [jobId]: action === 'approve' ? 'designing' : 'new' }));
        } catch (e: any) {
            // Show error inline in table — no alert() popup
            setApproveErrors(prev => ({ ...prev, [jobId]: e.message || 'Error' }));
        } finally {
            setApprovingId(null);
        }
    };

    // Redirect non-admin users
    useEffect(() => {
        if (!profile?.role) return;
        if (profile.role === 'admin') return;

        if (profile.role === 'designer') router.replace('/admin/designers/tasks');
        else if (profile.role === 'dispatch') router.replace('/admin/dispatch');
        else if (profile.role === 'marketing') router.replace('/admin/marketing');
        else if (profile.role === 'cmyk') router.replace('/admin/cmyk-print');
        else if (profile.role === 'finance') router.replace('/admin/finance');
        else router.replace('/'); // Fallback
    }, [profile, router]);

    if (profile?.role && profile.role !== 'admin') {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-3 border-muted border-t-foreground rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Redirecting to your workspace...</p>
                </div>
            </div>
        );
    }

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

    // ── Trend Badge: shows ▲▼ vs last month ──────────────────────
    const TrendBadge = ({ current, previous, isCurrency = false }: { current: number; previous: number; isCurrency?: boolean }) => {
        if (previous === 0) return <span className="text-xs text-muted-foreground">New</span>;
        const pct = Math.round(((current - previous) / previous) * 100);
        if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />same as last mo.</span>;
        const up = pct > 0;
        return (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-destructive'}`}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? '+' : ''}{pct}% vs last mo.
            </span>
        );
    };

    // Mirrors the unified master pipeline (lib/job-workflow.ts) in order
    const pipelineStages = [
        { key: 'awaiting_admin', label: 'Pending', color: 'bg-orange-500' },
        { key: 'new', label: 'Brief', color: 'bg-blue-500' },
        { key: 'designing', label: 'Design', color: 'bg-violet-500' },
        { key: 'approval', label: 'Approval', color: 'bg-amber-500' },
        { key: 'pre_print_qc', label: 'Pre-Print QC', color: 'bg-cyan-500' },
        { key: 'print_file_ready', label: 'File Ready', color: 'bg-blue-600' },
        { key: 'file_sent_client', label: 'File Sent', color: 'bg-green-500' },
        { key: 'file_received', label: 'File In', color: 'bg-stone-500' },
        { key: 'file_check', label: 'Printability', color: 'bg-cyan-600' },
        { key: 'ready_to_print', label: 'To Print', color: 'bg-indigo-500' },
        { key: 'printing', label: 'Print', color: 'bg-foreground' },
        { key: 'material_received', label: 'Material', color: 'bg-teal-500' },
        { key: 'quality_check', label: 'Mat QC', color: 'bg-cyan-700' },
        { key: 'ready', label: 'Ready', color: 'bg-emerald-600' },
        { key: 'dispatched', label: 'Sent', color: 'bg-muted-foreground' },
        { key: 'delivered', label: 'Done', color: 'bg-gray-400' },
    ];

    const totalPipelineJobs = Object.values(dashboardStats.pipeline).reduce((a, b) => a + b, 0);
    const pendingApprovals = dashboardStats.pipeline['awaiting_admin'] || 0;

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
                <Popover open={showWidgetSettings} onOpenChange={setShowWidgetSettings}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
                            <Settings className="h-4 w-4" /> Widgets
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-0">
                        <div className="px-3 py-2 border-b flex items-center justify-between">
                            <span className="text-xs font-semibold">Show / Hide</span>
                            <button onClick={showAllWidgets} className="text-xs text-muted-foreground hover:text-foreground">Show All</button>
                        </div>
                        <div className="max-h-72 overflow-y-auto py-1">
                            {ALL_WIDGET_KEYS.map(key => (
                                <label key={key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={widgetVisibility[key] !== false}
                                        onChange={() => toggleWidget(key)}
                                        className="rounded border-border text-foreground focus:ring-ring h-3.5 w-3.5"
                                    />
                                    <span className="text-xs">{WIDGET_LABELS[key]}</span>
                                </label>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* ── Band B — money on hand, and what is not recorded ──
                 Deliberately NOT in the widget show/hide list: the one thing on
                 this page that must never be switched off is the one that says
                 whether the rest can be trusted. */}
            <GlobalErrorBoundary>
                <MissingRecordsStrip data={dashboardStats.completeness} />
            </GlobalErrorBoundary>

            {/* ── KPI Row ── */}
            {isVisible('kpi') && (
                <div className="grid grid-cols-2 gap-4">
                    <Link href="/admin/jobs">
                        <Card className="hover:shadow-sm transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between pb-1">
                                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{dashboardStats.activeJobs}</div>
                                <p className="text-xs text-muted-foreground mt-1">Currently in production</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/admin/sales/orders">
                        <Card className="hover:shadow-sm transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between pb-1">
                                <CardTitle className="text-sm font-medium">Orders This Month</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{dashboardStats.ordersThisMonth}</div>
                                <TrendBadge current={dashboardStats.ordersThisMonth} previous={dashboardStats.lastMonthOrders} />
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            )}

            {/* ── Today's Focus + Needs Attention ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isVisible('todays-focus') && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Target className="h-4 w-4" /> Today&apos;s Focus
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {dashboardStats.todaysFocus.jobsDue === 0 &&
                                dashboardStats.todaysFocus.jobsDelayed === 0 &&
                                dashboardStats.todaysFocus.jobsCompleted === 0 ? (
                                <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                    <p className="text-sm font-medium text-emerald-700">All clear today! 🎉</p>
                                    <p className="text-xs text-muted-foreground">No jobs due or delayed</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <Link href="/admin/jobs" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                                        <div>
                                            <span className="text-lg font-bold">{dashboardStats.todaysFocus.jobsDue}</span>
                                            <span className="text-xs text-muted-foreground ml-1.5">Due</span>
                                        </div>
                                    </Link>
                                    <Link href="/admin/jobs" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                                        <div>
                                            <span className="text-lg font-bold">{dashboardStats.todaysFocus.jobsDelayed}</span>
                                            <span className="text-xs text-muted-foreground ml-1.5">Delayed</span>
                                        </div>
                                    </Link>
                                    <Link href="/admin/jobs" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="text-lg font-bold">{dashboardStats.todaysFocus.jobsCompleted}</span>
                                            <span className="text-xs text-muted-foreground ml-1.5">Done</span>
                                        </div>
                                    </Link>
                                    <Link href="/admin/finance" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                        <IndianRupee className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div>
                                            <span className="text-lg font-bold">{dashboardStats.todaysFocus.paymentsDue}</span>
                                            <span className="text-xs text-muted-foreground ml-1.5">₹ Due</span>
                                        </div>
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {isVisible('needs-attention') && (
                    <GlobalErrorBoundary>
                        <NeedsAttentionBar
                            overduePayments={dashboardStats.alerts.overduePayments}
                            pendingApprovals={pendingApprovals}
                            followUpsDue={dashboardStats.alerts.followUpsDue}
                            blockedJobs={dashboardStats.alerts.blockedJobs}
                            blockedFeedback={dashboardStats.alerts.blockedBreakdown.feedback}
                            loading={false}
                        />
                    </GlobalErrorBoundary>
                )}
            </div>

            {/* ── Pipeline + Invoice Pending ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isVisible('pipeline') && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Activity className="h-4 w-4" /> Job Pipeline
                                </CardTitle>
                                <span className="text-xs text-muted-foreground">{totalPipelineJobs} active</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {totalPipelineJobs === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">No active jobs</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {pipelineStages.map((stage) => {
                                        const count = dashboardStats.pipeline[stage.key] || 0;
                                        const overdue = dashboardStats.pipelineOverdue[stage.key] || 0;
                                        const pct = totalPipelineJobs > 0 ? (count / totalPipelineJobs) * 100 : 0;
                                        if (count === 0) return null;
                                        return (
                                            <Link key={stage.key} href="/admin/jobs/queue" className="flex items-center gap-2 hover:bg-muted/50 rounded-md px-1 -mx-1 py-1 transition-colors">
                                                <span className="text-xs w-14 text-right text-muted-foreground truncate">{stage.label}</span>
                                                <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden relative">
                                                    <div className={`h-full ${stage.color} rounded-md transition-all`} style={{ width: `${Math.max(pct, 8)}%` }} />
                                                    <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                                                        <span className={pct > 15 ? 'text-white' : 'text-foreground'}>{count}</span>
                                                    </span>
                                                </div>
                                                {overdue > 0 && <span className="text-xs text-destructive font-medium whitespace-nowrap">{overdue} late</span>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {isVisible('invoice-pending') && <GlobalErrorBoundary><InvoicePendingWidget /></GlobalErrorBoundary>}
            </div>

            {/* ── Recent Orders + Overdue Alerts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isVisible('recent-orders') && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
                                <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                                    <Link href="/admin/jobs" className="flex items-center gap-1">View all <ArrowRight className="h-4 w-4" /></Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
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
                                        <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No recent orders</TableCell></TableRow>
                                    ) : (
                                        recentJobs.map((job: any) => {
                                            const stage = stageOverrides[job.id] || job.current_stage;
                                            const isAwaiting = stage === 'awaiting_admin';
                                            const isProcessing = approvingId === job.id;
                                            return (
                                                <TableRow key={job.id} className="hover:bg-muted/50">
                                                    <TableCell className="font-medium text-xs py-2">
                                                        <Link href={`/admin/jobs/${job.id}`} className="text-primary hover:underline">
                                                            #{job.job_number}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-xs py-2">{(job.client as any)?.company || job.client?.name || '-'}</TableCell>
                                                    <TableCell className="text-xs py-2 max-w-[100px] truncate">
                                                        <Link href={`/admin/jobs/${job.id}`} className="hover:underline">
                                                            {job.project_name || '-'}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        {isAwaiting ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleRecentOrderApprove(job.id, 'approve')}
                                                                        disabled={isProcessing}
                                                                        className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                                                                    >
                                                                        {isProcessing ? '...' : '⚡ Approve'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRecentOrderApprove(job.id, 'reject')}
                                                                        disabled={isProcessing}
                                                                        className="px-1.5 py-0.5 text-red-500 text-[10px] font-bold rounded hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50"
                                                                    >
                                                                        ✗
                                                                    </button>
                                                                </div>
                                                                {approveErrors[job.id] && (
                                                                    <span className="text-[9px] text-red-500">{approveErrors[job.id]}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <Badge variant={stage === 'delivered' ? 'default' : stage === 'dispatched' ? 'secondary' : 'outline'}>
                                                                {stage?.replace('_', ' ')}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs py-2">{formatCurrency(job.total_amount || 0)}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {isVisible('overdue') && <GlobalErrorBoundary><OverdueAlertsWidget /></GlobalErrorBoundary>}
            </div>

            {/* ── CMYK Print Station Summary ── */}
            <CMYKDashboardWidget />

            {/* ── Daily Summary + Team Workload + Sales Performance ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isVisible('daily-summary') && <GlobalErrorBoundary><DailySummaryWidget initialStats={dashboardStats} /></GlobalErrorBoundary>}
                {isVisible('team-workload') && <GlobalErrorBoundary><TeamWorkloadWidget /></GlobalErrorBoundary>}

                {isVisible('sales-perf') && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Sales Performance
                            </CardTitle>
                            <CardDescription className="text-xs">Monthly revenue</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dashboardStats.salesPerformance.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">No data</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {dashboardStats.salesPerformance.map((month) => {
                                        const maxVal = Math.max(...dashboardStats.salesPerformance.map(m => m.value), 1);
                                        const pct = (month.value / maxVal) * 100;
                                        return (
                                            <div key={month.month} className="flex items-center gap-2">
                                                <span className={`text-xs w-8 text-right ${month.active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{month.month}</span>
                                                <div className="flex-1 h-4 bg-muted rounded-md overflow-hidden">
                                                    <div className={`h-full rounded-md ${month.active ? 'bg-foreground' : 'bg-muted-foreground/30'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                                                </div>
                                                <span className={`text-xs w-16 text-right tabular-nums ${month.active ? 'font-semibold' : 'text-muted-foreground'}`}>{formatCurrency(month.value)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Calendar + Quick Notes + GST Calculator ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {isVisible('calendar') && <GlobalErrorBoundary><MiniCalendarWidget /></GlobalErrorBoundary>}
                {isVisible('quick-notes') && <GlobalErrorBoundary><QuickNotesWidget /></GlobalErrorBoundary>}
            </div>

            {/* ── Recent Activity (full width) ── */}
            {isVisible('recent-activity') && (
                <GlobalErrorBoundary>
                    <RecentActivityWidget limit={10} />
                </GlobalErrorBoundary>
            )}
        </div>
    );
}
