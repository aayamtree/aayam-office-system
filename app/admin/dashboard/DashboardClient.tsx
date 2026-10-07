// ═══════════════════════════════════════════════════════════════════════════
// THE DASHBOARD — one grid, one type scale, colour that means something
// ═══════════════════════════════════════════════════════════════════════════
//
// Satish, 2026-09-14: "there is no alignment or placement... you see big gaps
// in Team, tools & history... Quick Notes is scrolling down."
//
// All three were the same bug. This page used to be a STACK OF INDEPENDENT
// GRID ROWS — every row declared its own `lg:grid-cols-N`. Columns therefore
// could not line up from one row to the next, and a row with three slots
// holding two cards left a visible hole. Quick Notes "scrolled" because grid
// rows stretch by default, so a card with one note in it was forced to match
// the height of the calendar beside it and hollowed out in the middle.
//
// THE RULES THIS FILE NOW KEEPS
//
//   1. ONE 12-COLUMN GRID governs the whole page. Every card spans a whole
//      number of those columns, so card edges line up top to bottom.
//
//   2. A ROW NEVER RENDERS WITH AN EMPTY SLOT. Every block here can be
//      switched off in the Widgets menu, so spans are computed from how many
//      of a row's cards actually survived — see `pair()` and `COLS` below.
//      A fixed `lg:grid-cols-3` is what produced the hole he photographed.
//
//   3. A CARD WITH LITTLE IN IT STAYS SHORT. `self-start` beats stretching
//      and hollowing out; a void inside a bordered card is what reads as
//      broken, not a short card.
//
//   4. TYPE CARRIES THE HIERARCHY. Figures are 24–29px and bold, labels are
//      10px uppercase grey. Previously everything sat around 20px and the eye
//      had nowhere to land first.
//
//   5. COLOUR MEANS SOMETHING. Ink and greyscale by default; oms-orange marks
//      the ONE figure that matters in a block; destructive red is reserved for
//      money and records being wrong. The pipeline's old sixteen-colour
//      rainbow is gone — it made colour meaningless, and only the bottleneck
//      stage now carries the accent.
//
//   6. A CARD NEVER GROWS WITH ITS DATA (2026-10-07). A calendar day with ~100
//      dispatches made one card ~3000px tall and the whole row followed.
//      Any list of unknown length goes in <ScrollList> (components/ui), and
//      `npm run audit:layout` fails if one doesn't.
//
// The notes board is deliberately NOT in the Widgets menu and deliberately
// sits above Money & records. See components/dashboard/NotesBoard.tsx.
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    IndianRupee, AlertTriangle, Clock,
    ArrowRight, CheckCircle2, TrendingUp,
    Settings, TrendingDown, Minus,
    Wallet, Sun, Factory, Store, Users,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import NeedsAttentionBar from '@/components/dashboard/NeedsAttentionBar';
import OverdueAlertsWidget from '@/components/dashboard/OverdueAlertsWidget';
import MiniCalendarWidget from '@/components/dashboard/MiniCalendarWidget';
import TeamWorkloadWidget from '@/components/dashboard/TeamWorkloadWidget';
import InvoicePendingWidget from '@/components/dashboard/InvoicePendingWidget';
import RecentActivityWidget from '@/components/dashboard/RecentActivityWidget';
import CMYKDashboardWidget from '@/components/dashboard/CMYKDashboardWidget';
import MissingRecordsStrip from '@/components/dashboard/MissingRecordsStrip';
import NotesBoard from '@/components/dashboard/NotesBoard';
import SectionHeading from '@/components/dashboard/SectionHeading';
import HeadlineBar from '@/components/dashboard/HeadlineBar';
import { GlobalErrorBoundary } from '@/components/ErrorBoundary';

import type { DashboardData } from '@/lib/dashboard-data';

// ─── Widget registry ───────────────────────────────────────────
// 'quick-notes' left this list on 2026-09-14. The notes board is now the
// channel admin and team pass work through, and a channel you can switch off
// is not a channel.
const WIDGET_LABELS: Record<string, string> = {
    'kpi': '💰 KPI Cards',
    'todays-focus': '🎯 Today\'s Focus',
    'needs-attention': '⚡ Needs Attention',
    'pipeline': '📊 Job Pipeline',
    'invoice-pending': '🧾 Invoice Pending',
    'recent-orders': '📋 Recent Orders',
    'overdue': '⏰ Overdue Alerts',
    'team-workload': '👥 Team Workload',
    'sales-perf': '📈 Sales Performance',
    'calendar': '📅 Calendar',
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

// ─── Grid helpers — rule 2 ─────────────────────────────────────
/** Equal split of twelve columns between however many cards survived. */
const COLS: Record<number, string> = {
    1: 'lg:col-span-12',
    2: 'lg:col-span-6',
    3: 'lg:col-span-4',
    4: 'lg:col-span-3',
};

/**
 * An asymmetric pair (7/5) — but only while BOTH halves are on screen.
 * Alone, a card takes the full width rather than leaving five columns of
 * paper beside it.
 */
function pair(bothShown: boolean, half: 'wide' | 'narrow'): string {
    if (!bothShown) return 'lg:col-span-12';
    return half === 'wide' ? 'lg:col-span-7' : 'lg:col-span-5';
}

// ─── Shared presentation ───────────────────────────────────────
const CARD = 'rounded-xl border bg-card p-5 flex flex-col min-w-0';
/**
 * A row-shaped card. This exists because `${CARD} flex-row` does NOT work:
 * Tailwind emits .flex-row BEFORE .flex-col, so flex-col wins on specificity
 * order whatever sequence the class names appear in. Caught in review — it
 * would have silently stacked the KPI figures under their labels.
 */
const CARD_ROW = 'rounded-xl border bg-card p-5 flex items-center justify-between gap-4 min-w-0';
const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.085em] text-muted-foreground';
const TITLE = 'text-[13px] font-semibold tracking-[-0.008em]';
const BIG = 'text-[29px] font-bold leading-none tracking-[-0.03em] tabular-nums';
const MID = 'text-[20px] font-bold leading-none tracking-[-0.02em] tabular-nums';
const LINKY = 'text-[11.5px] font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap';
/** The quiet sentence at the foot of a card that says what the numbers mean. */
const FOOTNOTE = 'mt-auto pt-3.5 border-t text-[11.5px] leading-snug text-muted-foreground';
/**
 * Wrapper for a widget that draws its own card. `[&>*]:flex-1` makes whatever
 * the widget renders grow to the row's height — several of them (Overdue
 * Alerts, the calendar) have no h-full of their own, and without this their
 * cards end early and the row bottoms go ragged, which is the exact fault
 * this rebuild exists to remove.
 */
const SLOT = 'flex min-w-0 flex-col [&>*]:flex-1';

/**
 * The pipeline's ink ramp. Neutral by design — only the bottleneck gets the
 * accent, so "which stage is the problem" is answerable at a glance instead
 * of being hidden inside sixteen competing hues.
 */
const PIPE_TONES = [
    { bar: 'bg-foreground', ink: 'text-background' },
    { bar: 'bg-foreground/70', ink: 'text-background' },
    { bar: 'bg-foreground/50', ink: 'text-background' },
    { bar: 'bg-foreground/32', ink: 'text-foreground' },
    { bar: 'bg-foreground/20', ink: 'text-foreground' },
];
const PIPE_PEAK = { bar: 'bg-oms-orange', ink: 'text-black/80' };

/**
 * The DB writes UTC into a column with no zone marker, so the string arrives
 * unmarked. Same normalisation RecentActivityWidget and NotesBoard use — read
 * naively it lands the date up to five and a half hours early here.
 */
function parseUtc(raw: string): Date {
    const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
    return new Date(hasTz ? raw : raw.replace(' ', 'T') + 'Z');
}

function shortDate(raw?: string | null): string {
    if (!raw) return '—';
    const d = parseUtc(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
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
    const TrendBadge = ({ current, previous }: { current: number; previous: number }) => {
        if (previous === 0) return <span className="text-[11.5px] text-muted-foreground">New</span>;
        const pct = Math.round(((current - previous) / previous) * 100);
        if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-[11.5px] text-muted-foreground"><Minus className="h-3 w-3" />same as last mo.</span>;
        const up = pct > 0;
        return (
            <span className={`inline-flex items-center gap-0.5 text-[11.5px] font-medium ${up ? 'text-emerald-600' : 'text-destructive'}`}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? '+' : ''}{pct}% vs last mo.
            </span>
        );
    };

    // Mirrors the unified master pipeline (lib/job-workflow.ts) in order.
    // The per-stage `color` that used to live here is gone — see rule 5.
    const pipelineStages = [
        { key: 'awaiting_admin', label: 'Pending' },
        { key: 'new', label: 'Brief' },
        { key: 'designing', label: 'Design' },
        { key: 'approval', label: 'Approval' },
        { key: 'pre_print_qc', label: 'Pre-print QC' },
        { key: 'print_file_ready', label: 'File ready' },
        { key: 'file_sent_client', label: 'File sent' },
        { key: 'file_received', label: 'File in' },
        { key: 'file_check', label: 'Printability' },
        { key: 'ready_to_print', label: 'To print' },
        { key: 'printing', label: 'Printing' },
        { key: 'material_received', label: 'Material' },
        { key: 'quality_check', label: 'Material QC' },
        { key: 'ready', label: 'Ready' },
        { key: 'dispatched', label: 'Sent' },
        { key: 'delivered', label: 'Done' },
    ];

    const totalPipelineJobs = Object.values(dashboardStats.pipeline).reduce((a, b) => a + b, 0);
    const pendingApprovals = dashboardStats.pipeline['awaiting_admin'] || 0;

    // Only stages that actually hold work are drawn, and the fullest one is
    // the bottleneck that earns the accent.
    const liveStages = pipelineStages
        .map(s => ({ ...s, count: dashboardStats.pipeline[s.key] || 0, late: dashboardStats.pipelineOverdue[s.key] || 0 }))
        .filter(s => s.count > 0);
    const peakCount = liveStages.reduce((m, s) => Math.max(m, s.count), 0);
    const totalLate = liveStages.reduce((n, s) => n + s.late, 0);
    const toneFor = (s: { count: number }, i: number) =>
        s.count === peakCount ? PIPE_PEAK : PIPE_TONES[Math.min(i, PIPE_TONES.length - 1)];

    // Sales
    const sales = dashboardStats.salesPerformance;
    const salesMax = Math.max(...sales.map(m => m.value), 1);
    const salesTotal = sales.reduce((n, m) => n + m.value, 0);
    const salesPeak = sales.reduce<{ month: string; value: number } | null>(
        (best, m) => (!best || m.value > best.value ? m : best), null);

    // Which cards survived the Widgets menu — rule 2
    const todayPair = isVisible('todays-focus') && isVisible('needs-attention');
    const prodPair = isVisible('pipeline') && isVisible('invoice-pending');
    const ordersPair = isVisible('recent-orders') && isVisible('overdue');
    const kpiCols = COLS[2];
    const teamCount = ['team-workload', 'sales-perf', 'calendar'].filter(isVisible).length;
    const teamCols = COLS[teamCount] || COLS[1];

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

            {/* ── Band A — where we are, in one line ── */}
            <GlobalErrorBoundary>
                <HeadlineBar data={dashboardStats.headline} />
            </GlobalErrorBoundary>

            {/* ── The notes board — above the fold, above everything.
                 Not in the Widgets menu, and never to be moved below the
                 records strip: a note nobody sees is the verbal note it was
                 meant to replace. ── */}
            <GlobalErrorBoundary>
                <NotesBoard />
            </GlobalErrorBoundary>

            <SectionHeading zone="records" icon={Wallet} title="Money & records" />

            {/* ── Band B — money on hand, and what is not recorded ── */}
            <GlobalErrorBoundary>
                <MissingRecordsStrip data={dashboardStats.completeness} />
            </GlobalErrorBoundary>

            <SectionHeading zone="today" icon={Sun} title="Today"
                note={new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                show={isVisible('todays-focus') || isVisible('needs-attention')} />

            <div className="grid grid-cols-12 gap-4">
                {isVisible('todays-focus') && (
                    <div className={`col-span-12 ${pair(todayPair, 'narrow')} ${CARD}`}>
                        <div className="mb-4"><span className={TITLE}>Today&apos;s focus</span></div>
                        {dashboardStats.todaysFocus.jobsDue === 0 &&
                            dashboardStats.todaysFocus.jobsDelayed === 0 &&
                            dashboardStats.todaysFocus.jobsCompleted === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                <p className="text-sm font-medium text-emerald-700">All clear today! 🎉</p>
                                <p className="text-xs text-muted-foreground">No jobs due or delayed</p>
                            </div>
                        ) : (
                            // auto-rows-fr so all four cells are the same height —
                            // an uneven 2×2 is the small version of the same fault.
                            <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2.5">
                                {[
                                    { n: dashboardStats.todaysFocus.jobsDue, label: 'Due today', href: '/admin/jobs', Icon: Clock },
                                    { n: dashboardStats.todaysFocus.jobsDelayed, label: 'Delayed', href: '/admin/jobs', Icon: AlertTriangle },
                                    { n: dashboardStats.todaysFocus.jobsCompleted, label: 'Done today', href: '/admin/jobs', Icon: CheckCircle2 },
                                    { n: dashboardStats.todaysFocus.paymentsDue, label: '₹ due today', href: '/admin/finance', Icon: IndianRupee },
                                ].map(({ n, label, href }) => {
                                    // The live figure is the only one that carries
                                    // colour; a zero is greyed so the eye skips it.
                                    const live = n > 0;
                                    return (
                                        <Link
                                            key={label}
                                            href={href}
                                            className={`flex flex-col justify-center gap-2 rounded-lg border p-3.5 transition-colors ${live
                                                ? 'border-oms-orange/35 bg-oms-orange/[0.09] hover:bg-oms-orange/[0.14]'
                                                : 'hover:bg-muted/50'}`}
                                        >
                                            <span className={LABEL}>{label}</span>
                                            <span className={`${BIG} ${live ? 'text-board-ink' : 'text-muted-foreground/45'}`}>{n}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {isVisible('needs-attention') && (
                    <div className={`col-span-12 ${pair(todayPair, 'wide')} ${SLOT}`}>
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
                    </div>
                )}
            </div>

            <SectionHeading zone="production" icon={Factory} title="Production"
                note={`${totalPipelineJobs} in the line`}
                show={isVisible('kpi') || isVisible('pipeline') || isVisible('invoice-pending')
                    || isVisible('recent-orders') || isVisible('overdue')} />

            {/* ── KPI pair ── */}
            {isVisible('kpi') && (
                <div className="grid grid-cols-12 gap-4">
                    <Link href="/admin/jobs" className={`col-span-12 ${kpiCols} ${CARD_ROW} transition-colors hover:bg-muted/40`}>
                        <span className={LABEL}>Active jobs</span>
                        <span className={BIG}>{dashboardStats.activeJobs}</span>
                    </Link>
                    <Link href="/admin/sales/orders" className={`col-span-12 ${kpiCols} ${CARD_ROW} transition-colors hover:bg-muted/40`}>
                        <span className={LABEL}>Orders this month</span>
                        <span className="flex items-baseline gap-3">
                            <TrendBadge current={dashboardStats.ordersThisMonth} previous={dashboardStats.lastMonthOrders} />
                            <span className={BIG}>{dashboardStats.ordersThisMonth}</span>
                        </span>
                    </Link>
                </div>
            )}

            {/* ── Pipeline + Invoice Pending ── */}
            <div className="grid grid-cols-12 gap-4">
                {isVisible('pipeline') && (
                    <div className={`col-span-12 ${pair(prodPair, 'wide')} ${CARD}`}>
                        <div className="mb-4 flex items-baseline justify-between gap-3">
                            <span className={TITLE}>Job pipeline</span>
                            <Link href="/admin/jobs/queue" className={LINKY}>Open queue →</Link>
                        </div>

                        {totalPipelineJobs === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">No active jobs</p>
                        ) : (
                            <>
                                {/* The proportional bar IS the chart; the rows
                                    beneath are its legend. */}
                                <div className="mb-5 flex h-[34px] gap-0.5 overflow-hidden rounded-lg">
                                    {liveStages.map((s, i) => {
                                        const t = toneFor(s, i);
                                        return (
                                            <div
                                                key={s.key}
                                                title={`${s.label}: ${s.count}`}
                                                style={{ flexGrow: s.count, flexBasis: 0 }}
                                                className={`flex min-w-[22px] items-center justify-center text-[12px] font-bold tabular-nums ${t.bar} ${t.ink}`}
                                            >
                                                {s.count}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div>
                                    {liveStages.map((s, i) => {
                                        const t = toneFor(s, i);
                                        const pct = totalPipelineJobs > 0 ? (s.count / totalPipelineJobs) * 100 : 0;
                                        return (
                                            <Link
                                                key={s.key}
                                                href="/admin/jobs/queue"
                                                className="grid grid-cols-[84px_1fr_38px_52px] items-center gap-3 rounded-md py-1.5 transition-colors hover:bg-muted/50"
                                            >
                                                <span className="truncate text-[12px] font-medium text-muted-foreground">{s.label}</span>
                                                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <span className={`block h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                                                </span>
                                                <span className="text-right text-[12.5px] font-semibold tabular-nums">{s.count}</span>
                                                {s.late > 0 ? (
                                                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-center text-[10.5px] font-semibold tabular-nums text-destructive">
                                                        {s.late} late
                                                    </span>
                                                ) : <span />}
                                            </Link>
                                        );
                                    })}
                                </div>

                                {totalLate > 0 && (
                                    <p className={FOOTNOTE}>
                                        <span className="font-bold text-destructive">{totalLate} of {totalPipelineJobs}</span>{' '}
                                        {totalLate === 1 ? 'job is' : 'jobs are'} past the client deadline.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}

                {isVisible('invoice-pending') && (
                    <div className={`col-span-12 ${pair(prodPair, 'narrow')} ${SLOT}`}>
                        <GlobalErrorBoundary><InvoicePendingWidget /></GlobalErrorBoundary>
                    </div>
                )}
            </div>

            {/* ── Recent Orders + Overdue Alerts ── */}
            <div className="grid grid-cols-12 gap-4">
                {isVisible('recent-orders') && (
                    <div className={`col-span-12 ${pair(ordersPair, 'wide')} ${CARD}`}>
                        <div className="mb-4 flex items-baseline justify-between gap-3">
                            <span className={TITLE}>Recent orders</span>
                            <Link href="/admin/jobs" className={LINKY}>View all →</Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        {/* The date column Satish asked for. It was not
                                            merely unrendered — lib/dashboard-data.ts did
                                            not select created_at at all, so there was no
                                            date here to draw. */}
                                        <th className={`${LABEL} w-[62px] pb-2.5 text-left`}>Date</th>
                                        <th className={`${LABEL} w-[104px] pb-2.5 text-left`}>Order</th>
                                        <th className={`${LABEL} pb-2.5 text-left`}>Client</th>
                                        <th className={`${LABEL} hidden pb-2.5 text-left sm:table-cell`}>Project</th>
                                        <th className={`${LABEL} w-[116px] pb-2.5 text-left`}>Stage</th>
                                        <th className={`${LABEL} w-[72px] pb-2.5 text-right`}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentJobs.length === 0 ? (
                                        <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No recent orders</td></tr>
                                    ) : (
                                        recentJobs.map((job: any) => {
                                            const stage = stageOverrides[job.id] || job.current_stage;
                                            const isAwaiting = stage === 'awaiting_admin';
                                            const isProcessing = approvingId === job.id;
                                            const amount = job.total_amount || 0;
                                            return (
                                                <tr key={job.id} className="border-b last:border-0 hover:bg-muted/40">
                                                    <td className="py-2.5 text-[11.5px] tabular-nums text-muted-foreground">
                                                        {shortDate(job.created_at)}
                                                    </td>
                                                    <td className="py-2.5">
                                                        <Link href={`/admin/jobs/${job.id}`} className="text-[12.5px] font-semibold tabular-nums hover:underline">
                                                            {job.job_number}
                                                        </Link>
                                                    </td>
                                                    {/* company first — the contact person is not
                                                        who the business deals with. */}
                                                    <td className="max-w-0 truncate py-2.5 pr-3 text-[12.5px]">
                                                        {job.client?.company || job.client?.name || '—'}
                                                    </td>
                                                    <td className="hidden max-w-0 truncate py-2.5 pr-3 text-[12.5px] text-muted-foreground sm:table-cell">
                                                        <Link href={`/admin/jobs/${job.id}`} className="hover:underline">
                                                            {job.project_name || '—'}
                                                        </Link>
                                                    </td>
                                                    <td className="py-2.5">
                                                        {isAwaiting ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleRecentOrderApprove(job.id, 'approve')}
                                                                        disabled={isProcessing}
                                                                        className="whitespace-nowrap rounded-full bg-oms-orange px-2.5 py-1 text-[10.5px] font-bold text-black/80 transition-opacity hover:opacity-85 disabled:opacity-50"
                                                                    >
                                                                        {isProcessing ? '…' : 'Approve'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRecentOrderApprove(job.id, 'reject')}
                                                                        disabled={isProcessing}
                                                                        aria-label="Reject this order"
                                                                        className="rounded-full border border-destructive/30 px-2 py-1 text-[10.5px] font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                                                                    >
                                                                        ✗
                                                                    </button>
                                                                </div>
                                                                {approveErrors[job.id] && (
                                                                    <span className="text-[10px] text-destructive">{approveErrors[job.id]}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${stage === 'delivered' || stage === 'dispatched'
                                                                ? 'bg-muted text-muted-foreground'
                                                                : 'bg-foreground/[0.06] text-foreground/75'}`}>
                                                                {String(stage || '').replace(/_/g, ' ')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className={`py-2.5 text-right text-[12.5px] tabular-nums ${amount > 0 ? '' : 'text-muted-foreground/50'}`}>
                                                        {formatCurrency(amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* A ₹0 here is not a cheap job — it is a job nobody
                            priced, and it belongs to the "finished jobs with no
                            price" count in the records strip above. */}
                        {recentJobs.length > 0 && recentJobs.every((j: any) => !j.total_amount) && (
                            <p className={FOOTNOTE}>
                                Every amount here reads ₹0 — these jobs were never priced.
                            </p>
                        )}
                    </div>
                )}

                {isVisible('overdue') && (
                    <div className={`col-span-12 ${pair(ordersPair, 'narrow')} ${SLOT}`}>
                        <GlobalErrorBoundary><OverdueAlertsWidget /></GlobalErrorBoundary>
                    </div>
                )}
            </div>

            <SectionHeading zone="retail" icon={Store} title="CMYK counter" note="Today" />

            <CMYKDashboardWidget />

            <SectionHeading zone="team" icon={Users} title="Team, tools & history"
                show={isVisible('team-workload') || isVisible('sales-perf')
                    || isVisible('calendar') || isVisible('recent-activity')} />

            {/* ── Three equal cards. This row is where the hole used to be:
                 it was `lg:grid-cols-3` holding two children. ── */}
            <div className="grid grid-cols-12 gap-4">
                {isVisible('team-workload') && (
                    <div className={`col-span-12 ${teamCols} ${SLOT}`}>
                        <GlobalErrorBoundary><TeamWorkloadWidget /></GlobalErrorBoundary>
                    </div>
                )}

                {isVisible('sales-perf') && (
                    <div className={`col-span-12 ${teamCols} ${CARD}`}>
                        <div className="mb-4 flex items-baseline justify-between gap-3">
                            <span className={TITLE}>Monthly revenue</span>
                            <span className="text-[11px] text-muted-foreground">Last 6 mo.</span>
                        </div>

                        {sales.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
                        ) : (
                            <>
                                <div className="border-b pb-3.5">
                                    <div className={BIG}>{formatCurrency(salesTotal)}</div>
                                    <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                                        Six months to date
                                        {salesPeak && salesPeak.value > 0 ? ` · peak was ${salesPeak.month}` : ''}
                                    </p>
                                </div>

                                {/* A real column chart — the old version was a
                                    stack of thin horizontal bars that left most
                                    of this card empty. */}
                                <div className="flex min-h-[140px] max-h-[260px] flex-1 items-end gap-2 pt-5">
                                    {sales.map(month => {
                                        const pct = (month.value / salesMax) * 100;
                                        const bar = month.active
                                            ? 'bg-oms-orange'
                                            : salesPeak && month.month === salesPeak.month && month.value > 0
                                                ? 'bg-foreground'
                                                : 'bg-foreground/25';
                                        return (
                                            <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                                                <span className={`whitespace-nowrap text-[10.5px] font-semibold tabular-nums ${month.value > 0 ? 'text-muted-foreground' : 'text-muted-foreground/45'}`}>
                                                    {month.value > 0 ? `${(month.value / 100000).toFixed(2)}L` : '₹0'}
                                                </span>
                                                <span
                                                    className={`w-full rounded-t ${bar}`}
                                                    style={{ height: `${Math.max(pct, 1.5)}%`, minHeight: 3 }}
                                                />
                                                <span className={`text-[10.5px] ${month.active ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground'}`}>
                                                    {month.month}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isVisible('calendar') && (
                    <div className={`col-span-12 ${teamCols} ${SLOT}`}>
                        <GlobalErrorBoundary><MiniCalendarWidget /></GlobalErrorBoundary>
                    </div>
                )}
            </div>

            {/* ── History, folded shut. ── */}
            {isVisible('recent-activity') && (
                <GlobalErrorBoundary>
                    <RecentActivityWidget limit={10} />
                </GlobalErrorBoundary>
            )}
        </div>
    );
}
