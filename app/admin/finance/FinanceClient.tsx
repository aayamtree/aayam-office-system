'use client';

import Link from 'next/link';
import {
    IndianRupee, FileText, CreditCard, ShoppingBag,
    TrendingDown, BarChart3, Calendar, ArrowUpRight,
    ArrowDownRight, AlertTriangle, TrendingUp, TrendingDown as TrendDownIcon,
    Minus, Clock, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import type { FinanceOverviewData } from '@/lib/finance-overview-data';

interface Props {
    data: FinanceOverviewData;
    /** Cash waiting to be entered in Zoho. Null when the count could not be read —
        which must not render as a confident zero. */
    cashToEnter: number | null;
    /** True at the query's cap — the card must say "100+", never a flat "100",
        or it disagrees with the Telegram message and with Payment Proofs. */
    cashTruncated: boolean;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatCompact = (amount: number) => {
    if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}L`;
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(0)}K`;
    return `₹${amount}`;
};

function TrendBadge({ current, previous }: { current: number; previous: number }) {
    if (previous === 0) return <span className="text-[10px] text-muted-foreground">New</span>;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Minus className="h-2.5 w-2.5" /> same
        </span>
    );
    const up = pct > 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${up ? 'text-emerald-600' : 'text-destructive'}`}>
            {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendDownIcon className="h-2.5 w-2.5" />}
            {up ? '+' : ''}{pct}% vs last mo.
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { cls: string; label: string }> = {
        paid: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Paid' },
        pending: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Pending' },
        partial: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Partial' },
        overdue: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Overdue' },
        draft: { cls: 'bg-muted text-muted-foreground border-border', label: 'Draft' },
    };
    const c = cfg[status] || cfg.draft;
    return (
        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${c.cls}`}>
            {c.label}
        </span>
    );
}

export default function FinanceClient({ data, cashToEnter, cashTruncated }: Props) {
    const {
        billedThisMonth, receivedThisMonth, paidOutThisMonth, outstandingTotal,
        billedLastMonth, receivedLastMonth,
        invoiceCounts, invoiceTotals,
        navStats, monthlyRevenue, recentInvoices, overdueToday,
        cashflow, bankFeedThrough, bankFeedDaysBehind, failed,
    } = data;

    // Every figure below now comes from Zoho. `cashflow` is money in and out of
    // the bank account — deliberately NOT called a P&L, because cash kept
    // outside the bank never appears in it.
    const pnl = cashflow;

    const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((m: { revenue: number }) => m.revenue), 1);

    // ── Fiscal-year cash movement, derived ──
    const maxIE = Math.max(...pnl.monthly.flatMap((m: { income: number; expense: number }) => [m.income, m.expense]), 1);
    const netProfit = pnl.totalIncome - pnl.totalExpense;
    const EXPENSE_COLORS = ['#10b981', '#f97316', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];
    // Collapse smaller categories into "Others" (keep top 5)
    const sortedExpenses = [...pnl.topExpenses].sort((a, b) => b.amount - a.amount);
    const topFive = sortedExpenses.slice(0, 5);
    const othersAmount = sortedExpenses.slice(5).reduce((s, e) => s + e.amount, 0);
    const donutData = [
        ...topFive.map((e, i) => ({ name: e.name, amount: e.amount, color: EXPENSE_COLORS[i] })),
        ...(othersAmount > 0 ? [{ name: 'Others', amount: othersAmount, color: EXPENSE_COLORS[7] }] : []),
    ];
    const donutTotal = donutData.reduce((s, e) => s + e.amount, 0) || 1;
    // Build stroke-dasharray segments for the donut (circumference based)
    const R = 42, C = 2 * Math.PI * R;
    let acc = 0;
    const donutSegments = donutData.map((d) => {
        const frac = d.amount / donutTotal;
        const seg = { color: d.color, dash: frac * C, offset: -acc * C };
        acc += frac;
        return seg;
    });

    // ── THE FIVE DOORS ───────────────────────────────────────────────────
    // These used to be seven cards pointing at Invoices, Payments, Vendors,
    // Quick Expense, Reports, Accounting Reports and Daily Summary — five of
    // which read the ledger closed for writing on 5 August. Each card below is
    // one door, and each door answers one question.
    const navCards = [
        {
            href: '/admin/finance/money-in',
            icon: FileText,
            title: 'Money In',
            iconColor: 'text-emerald-700',
            iconBg: 'bg-emerald-50',
            borderColor: 'border-l-emerald-500',
            stat1: `${navStats.invoices.unpaid} unpaid`,
            stat2: navStats.invoices.overdueCount > 0 ? `${navStats.invoices.overdueCount} overdue` : 'None overdue',
            stat2Red: navStats.invoices.overdueCount > 0,
            action: 'Who owes us',
            actionHref: '/admin/finance/money-in',
        },
        {
            href: '/admin/finance/money-out',
            icon: ShoppingBag,
            title: 'Money Out',
            iconColor: 'text-violet-700',
            iconBg: 'bg-violet-50',
            borderColor: 'border-l-violet-500',
            stat1: `${navStats.purchases.pendingBills} bills pending`,
            stat2: navStats.purchases.billsAmount > 0 ? formatCompact(navStats.purchases.billsAmount) + ' due' : 'All clear',
            stat2Red: navStats.purchases.pendingBills > 0,
            action: 'Who we owe',
            actionHref: '/admin/finance/money-out',
        },
        {
            href: '/admin/finance/bank-cash',
            icon: CreditCard,
            title: 'Bank & Cash',
            iconColor: 'text-blue-700',
            iconBg: 'bg-blue-50',
            borderColor: 'border-l-blue-500',
            stat1: formatCompact(navStats.payments.receivedThisMonth),
            stat2: bankFeedThrough ? `feed dated ${bankFeedThrough}` : 'no bank feed',
            stat2Red: bankFeedDaysBehind !== null && bankFeedDaysBehind > 7,
            action: 'What the bank shows',
            actionHref: '/admin/finance/bank-cash',
        },
        {
            href: '/admin/finance/to-do',
            icon: Clock,
            title: 'To Do',
            iconColor: 'text-amber-700',
            iconBg: 'bg-amber-50',
            borderColor: 'border-l-amber-500',
            // Only the cash queue is counted here, from the one shared
            // definition. A made-up total that disagrees with the Telegram
            // message would be worse than no total at all.
            stat1: cashToEnter === null ? 'Open the list' : `${cashToEnter}${cashTruncated ? '+' : ''} cash to enter`,
            stat2: 'plus payments to chase',
            stat2Red: (cashToEnter ?? 0) > 0,
            action: 'What is unfinished',
            actionHref: '/admin/finance/to-do',
        },
        {
            href: '/admin/finance/reports',
            icon: BarChart3,
            title: 'Reports',
            iconColor: 'text-slate-700',
            iconBg: 'bg-slate-100',
            borderColor: 'border-l-slate-400',
            stat1: `${formatCompact(pnl.totalIncome)} in · ${formatCompact(pnl.totalExpense)} out`,
            stat2: pnl.fyLabel,
            stat2Red: false,
            action: 'What it added up to',
            actionHref: '/admin/finance/reports',
        },
    ];

    // Invoice status summary strip
    const statusStrip = [
        { label: 'Paid', count: invoiceCounts.paid, amount: invoiceTotals.paid, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
        { label: 'Pending', count: invoiceCounts.pending, amount: invoiceTotals.pending, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
        { label: 'Partial', count: invoiceCounts.partial, amount: invoiceTotals.partial, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
        { label: 'Overdue', count: invoiceCounts.overdue, amount: invoiceTotals.overdue, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
    ];

    return (
        <div className="space-y-5">

            {/* A failed query must announce itself. Rendering ₹0 for a query that
                never returned is how a broken page passes for a quiet month. */}
            {failed && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex gap-2.5">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
                    <div>
                        <p className="font-semibold mb-0.5">Could not load the figures from Zoho.</p>
                        <p>Everything below is showing zero because the data did not arrive — not because there was no activity. Try refreshing; if it persists, check the Zoho connection.</p>
                    </div>
                </div>
            )}

            {/* Zoho's automatic bank fetch is broken, so statements are uploaded
                by hand every few days. Anything here about money MOVED is only
                true up to that date, and the page says so. */}
            {!failed && bankFeedDaysBehind !== null && bankFeedDaysBehind > 1 && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2.5">
                    <Clock size={15} className="shrink-0 mt-0.5" />
                    <div>
                        Bank figures are complete to <b className="text-foreground">{bankFeedThrough}</b>
                        {' '}({bankFeedDaysBehind} days ago). Anything paid or received since then is not counted yet —
                        upload the latest statement to Zoho to bring it up to date. Invoices and bills are current.
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">Finance</h1>
                    <p className="text-xs text-muted-foreground">Every figure on this page comes from Zoho Books</p>
                </div>
                <div className="flex gap-2">
                    {/* Was "Record Payment", deep-linking into a form that now
                        refuses to save. Payments are recorded in Zoho; what the
                        app uniquely offers is the proof inbox. */}
                    <Link
                        href="/admin/finance/to-do"
                        className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-2 rounded-md hover:bg-muted/80 transition-colors font-medium text-sm"
                    >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Payment proofs</span>
                        <span className="sm:hidden">Proofs</span>
                    </Link>
                    {/* Was "New Invoice" into the app's 2-row invoices table. */}
                    <Link
                        href="/admin/finance/zoho"
                        className="flex items-center gap-1.5 bg-foreground text-background px-3 py-2 rounded-md hover:bg-foreground/90 transition-colors font-medium text-sm"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Open Zoho Books</span>
                        <span className="sm:hidden">Zoho</span>
                    </Link>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Revenue */}
                <div className="bg-foreground text-background rounded-lg p-3 md:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-background/60 font-medium">Billed this month</span>
                        <IndianRupee className="h-3.5 w-3.5 text-background/40" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{formatCompact(billedThisMonth)}</div>
                    <TrendBadge current={billedThisMonth} previous={billedLastMonth} />
                </div>

                {/* Amount Received */}
                <div className="bg-emerald-600 text-white rounded-lg p-3 md:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60 font-medium">Into the bank</span>
                        <ArrowDownRight className="h-3.5 w-3.5 text-white/40" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{formatCompact(receivedThisMonth)}</div>
                    <TrendBadge current={receivedThisMonth} previous={receivedLastMonth} />
                </div>

                {/* Expenses */}
                {/* Links to the Zoho mirror, not to Quick Expense — that screen
                    writes into the ledger nobody has used since July. */}
                <Link
                    href="/admin/finance/zoho"
                    className="bg-card border border-border rounded-lg p-3 md:p-4 space-y-1 hover:shadow-sm hover:border-orange-200 transition-all group"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Out of the bank</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-orange-500" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{formatCompact(pnl.totalExpense)}</div>
                    <span className="text-[10px] text-muted-foreground">
                        {pnl.fyLabel || 'This FY'} · {formatCompact(paidOutThisMonth)} this month
                    </span>
                </Link>

                {/* Outstanding */}
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 md:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-red-600 font-medium">Outstanding</span>
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    </div>
                    <div className="text-2xl font-bold text-red-700 tabular-nums">{formatCompact(outstandingTotal)}</div>
                    <span className="text-[10px] text-red-500">
                        {invoiceCounts.overdue > 0 ? `${invoiceCounts.overdue} overdue` : 'Total unpaid balance'}
                    </span>
                </div>
            </div>

            {/* ── Income vs Expense (Fiscal Year) + Top Expenses — Zoho-style ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Income vs Expense */}
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-semibold">Income &amp; Expense</h3>
                            <p className="text-xs text-muted-foreground">
                                Money in and out of the bank{pnl.fyLabel ? ` · ${pnl.fyLabel}` : ''} — cash handled outside the bank is not included
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link href="/admin/finance/reports" className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5">
                                Reports <ArrowUpRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="flex items-center gap-5 mb-4">
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                                <span className="text-[11px] text-muted-foreground">Total Income</span>
                            </div>
                            <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCompact(pnl.totalIncome)}</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                                <span className="text-[11px] text-muted-foreground">Total Expense</span>
                            </div>
                            <p className="text-lg font-bold tabular-nums text-red-600">{formatCompact(pnl.totalExpense)}</p>
                        </div>
                        <div className="ml-auto text-right">
                            <span className="text-[11px] text-muted-foreground">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</span>
                            <p className={`text-lg font-bold tabular-nums ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCompact(Math.abs(netProfit))}
                            </p>
                        </div>
                    </div>

                    {/* Grouped monthly bars */}
                    {pnl.monthly.length > 0 ? (
                        <div className="flex items-end justify-between gap-2 h-40 border-b border-border pb-1">
                            {pnl.monthly.map((m: { label: string; income: number; expense: number }) => (
                                <div key={m.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                    <div className="flex items-end justify-center gap-1 w-full h-full">
                                        <div
                                            className="w-1/2 max-w-[18px] bg-emerald-500 rounded-t-sm transition-all"
                                            style={{ height: `${Math.max((m.income / maxIE) * 100, m.income > 0 ? 3 : 0)}%` }}
                                            title={`Income: ${formatCurrency(m.income)}`}
                                        />
                                        <div
                                            className="w-1/2 max-w-[18px] bg-red-500 rounded-t-sm transition-all"
                                            style={{ height: `${Math.max((m.expense / maxIE) * 100, m.expense > 0 ? 3 : 0)}%` }}
                                            title={`Expense: ${formatCurrency(m.expense)}`}
                                        />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">No posted entries yet</div>
                    )}
                </div>

                {/* Top Expenses donut */}
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-semibold">Top Expenses</h3>
                            <p className="text-xs text-muted-foreground">By category · This Fiscal Year</p>
                        </div>
                        <Link href="/admin/finance/reports" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            All spending <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>

                    {donutData.length > 0 ? (
                        <div className="flex items-center gap-4">
                            {/* Donut */}
                            <div className="relative shrink-0">
                                <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                                    {donutSegments.map((s, i) => (
                                        <circle
                                            key={i}
                                            cx="50" cy="50" r={R}
                                            fill="none"
                                            stroke={s.color}
                                            strokeWidth="14"
                                            strokeDasharray={`${s.dash} ${C - s.dash}`}
                                            strokeDashoffset={s.offset}
                                        />
                                    ))}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-[9px] text-muted-foreground">Total</span>
                                    <span className="text-xs font-bold tabular-nums">{formatCompact(pnl.totalExpense)}</span>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex-1 space-y-1.5 min-w-0">
                                {donutData.map((d) => (
                                    <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                                            <span className="truncate text-foreground">{d.name}</span>
                                        </div>
                                        <span className="font-semibold tabular-nums text-muted-foreground shrink-0">
                                            {formatCompact(d.amount)}
                                            <span className="text-[10px] text-muted-foreground/70 ml-1">
                                                {Math.round((d.amount / donutTotal) * 100)}%
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-28 flex items-center justify-center text-xs text-muted-foreground">No expenses recorded yet</div>
                    )}
                </div>
            </div>

            {/* ── Invoice Status Strip + 6-Month Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Invoice Status Strip */}
                <div className="lg:col-span-1 bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold">Invoice Status</h3>
                        <Link href="/admin/finance/money-in" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            View all <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>
                    {statusStrip.map(({ label, count, amount, icon: Icon, color, bg }) => (
                        <Link key={label} href="/admin/finance/money-in">
                            <div className={`flex items-center justify-between p-2.5 rounded-md border ${bg} hover:opacity-80 transition-opacity`}>
                                <div className="flex items-center gap-2">
                                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                                    <span className={`text-sm font-medium ${color}`}>{label}</span>
                                    <span className={`text-xs font-bold ${color} bg-white/60 px-1.5 py-0.5 rounded`}>{count}</span>
                                </div>
                                <span className="text-xs font-semibold text-foreground tabular-nums">
                                    {formatCompact(amount)}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* 6-Month Revenue Chart */}
                <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold">Revenue vs Received</h3>
                            <p className="text-xs text-muted-foreground">Last 6 months</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-foreground inline-block" /> Invoiced</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Received</span>
                        </div>
                    </div>
                    <div className="space-y-2.5">
                        {monthlyRevenue.map((m) => {
                            const revPct = (m.revenue / maxMonthlyRevenue) * 100;
                            const recPct = m.revenue > 0 ? (m.received / m.revenue) * 100 : 0;
                            return (
                                <div key={m.month} className="flex items-center gap-2">
                                    <span className={`text-xs w-7 text-right tabular-nums ${m.active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                                        {m.month}
                                    </span>
                                    <div className="flex-1 space-y-0.5">
                                        {/* Revenue bar */}
                                        <div className="h-3 bg-muted rounded-sm overflow-hidden">
                                            <div
                                                className={`h-full rounded-sm transition-all ${m.active ? 'bg-foreground' : 'bg-muted-foreground/40'}`}
                                                style={{ width: `${Math.max(revPct, 2)}%` }}
                                            />
                                        </div>
                                        {/* Received bar */}
                                        <div className="h-3 bg-muted rounded-sm overflow-hidden">
                                            <div
                                                className="h-full rounded-sm bg-emerald-500 transition-all"
                                                style={{ width: `${Math.max((m.received / maxMonthlyRevenue) * 100, m.received > 0 ? 2 : 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right w-16">
                                        <div className={`text-[10px] tabular-nums ${m.active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                                            {formatCompact(m.revenue)}
                                        </div>
                                        <div className="text-[10px] text-emerald-600 tabular-nums">
                                            {formatCompact(m.received)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Navigation Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {navCards.map((card) => (
                    <div key={card.href} className={`bg-card border border-border border-l-4 ${card.borderColor} rounded-lg overflow-hidden hover:shadow-sm transition-all group`}>
                        <Link href={card.href} className="block p-3 space-y-2.5">
                            {/* Card Header row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-md ${card.iconBg}`}>
                                        <card.icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
                                    </div>
                                    <span className="font-semibold text-sm text-foreground">{card.title}</span>
                                </div>
                            </div>
                            {/* Stats */}
                            <div>
                                <p className="text-sm font-bold text-foreground tabular-nums">{card.stat1}</p>
                                <p className={`text-xs mt-0.5 ${card.stat2Red ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                    {card.stat2}
                                </p>
                            </div>
                        </Link>
                        {/* Action link at bottom */}
                        <div className="px-3 pb-2.5">
                            <Link
                                href={card.actionHref}
                                className={`text-[11px] font-medium ${card.iconColor} hover:underline transition-colors`}
                                onClick={e => e.stopPropagation()}
                            >
                                {card.action} →
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Recent Invoices ── */}
            {recentInvoices.length > 0 && (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <h3 className="text-sm font-semibold">Recent Invoices</h3>
                        <Link href="/admin/finance/money-in" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            View all <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Invoice</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Due Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recentInvoices.map((inv) => (
                                    <Link key={inv.id} href="/admin/finance/money-in" legacyBehavior>
                                        <tr className="hover:bg-muted/30 cursor-pointer transition-colors">
                                            <td className="px-4 py-2.5">
                                                <span className="font-mono text-xs font-semibold">{inv.invoice_number}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <p className="font-medium text-xs truncate max-w-[140px]">{inv.client_company || inv.client_name}</p>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-xs">
                                                {formatCurrency(inv.total_amount)}
                                                {inv.amount_paid > 0 && inv.amount_paid < inv.total_amount && (
                                                    <p className="text-[10px] text-emerald-600 font-normal">{formatCurrency(inv.amount_paid)} paid</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <StatusBadge status={inv.payment_status} />
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                                {inv.due_date
                                                    ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    </Link>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-border">
                        {recentInvoices.slice(0, 5).map((inv) => (
                            <Link key={inv.id} href="/admin/finance/money-in" className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-foreground">{inv.invoice_number}</span>
                                        <StatusBadge status={inv.payment_status} />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{inv.client_company || inv.client_name}</p>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <p className="text-sm font-bold tabular-nums">{formatCompact(inv.total_amount)}</p>
                                    {inv.due_date && (
                                        <p className="text-[10px] text-muted-foreground">
                                            Due {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
