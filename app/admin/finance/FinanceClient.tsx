'use client';

import Link from 'next/link';
import {
    IndianRupee, FileText, CreditCard, ShoppingBag,
    TrendingDown, BarChart3, Calendar, ArrowUpRight,
    ArrowDownRight, AlertTriangle, TrendingUp, TrendingDown as TrendDownIcon,
    Minus, Clock, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import type { FinanceOverviewData } from '@/lib/finance-overview-data';

interface Props { data: FinanceOverviewData; }

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

export default function FinanceClient({ data }: Props) {
    const {
        revenueThisMonth, receivedThisMonth, expensesThisMonth, outstandingTotal,
        revenueLastMonth, receivedLastMonth,
        invoiceCounts, invoiceTotals,
        navStats, monthlyRevenue, recentInvoices, overdueToday,
    } = data;

    const maxMonthlyRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

    const navCards = [
        {
            href: '/admin/finance/invoices',
            icon: FileText,
            title: 'Invoices',
            iconColor: 'text-slate-700',
            iconBg: 'bg-slate-100',
            borderColor: 'border-l-slate-400',
            stat1: `${navStats.invoices.unpaid} unpaid`,
            stat2: navStats.invoices.overdueCount > 0 ? `${navStats.invoices.overdueCount} overdue` : 'None overdue',
            stat2Red: navStats.invoices.overdueCount > 0,
            action: 'New Invoice',
            actionHref: '/admin/finance/invoices?new=true',
        },
        {
            href: '/admin/finance/payments',
            icon: CreditCard,
            title: 'Payments',
            iconColor: 'text-emerald-700',
            iconBg: 'bg-emerald-50',
            borderColor: 'border-l-emerald-500',
            stat1: formatCompact(navStats.payments.receivedThisMonth),
            stat2: 'received this month',
            stat2Red: false,
            action: 'Record Payment',
            actionHref: '/admin/finance/payments?new=true',
        },
        {
            href: '/admin/finance/vendors',
            icon: ShoppingBag,
            title: 'Purchases',
            iconColor: 'text-violet-700',
            iconBg: 'bg-violet-50',
            borderColor: 'border-l-violet-500',
            stat1: `${navStats.purchases.pendingBills} bills pending`,
            stat2: navStats.purchases.billsAmount > 0 ? formatCompact(navStats.purchases.billsAmount) + ' due' : 'All clear',
            stat2Red: navStats.purchases.pendingBills > 0,
            action: 'Add Bill',
            actionHref: '/admin/finance/vendors',
        },
        {
            href: '/admin/finance/expenses/quick',
            icon: TrendingDown,
            title: 'Expenses',
            iconColor: 'text-orange-700',
            iconBg: 'bg-orange-50',
            borderColor: 'border-l-orange-500',
            stat1: formatCompact(navStats.expenses.thisMonth),
            stat2: `${navStats.expenses.count} entries this month`,
            stat2Red: false,
            action: 'Log Expense',
            actionHref: '/admin/finance/expenses/quick',
        },
        {
            href: '/admin/finance/reports',
            icon: BarChart3,
            title: 'Reports',
            iconColor: 'text-blue-700',
            iconBg: 'bg-blue-50',
            borderColor: 'border-l-blue-500',
            stat1: 'P&L · Cash · GST',
            stat2: 'Financial reports',
            stat2Red: false,
            action: 'View Reports',
            actionHref: '/admin/finance/reports',
        },
        {
            href: '/admin/finance/daily',
            icon: Calendar,
            title: 'Daily Summary',
            iconColor: 'text-gray-700',
            iconBg: 'bg-gray-100',
            borderColor: 'border-l-gray-400',
            stat1: "Today's snapshot",
            stat2: overdueToday > 0 ? `${overdueToday} overdue items` : 'All on track',
            stat2Red: overdueToday > 0,
            action: 'View Today',
            actionHref: '/admin/finance/daily',
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

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">Finance</h1>
                    <p className="text-xs text-muted-foreground">Financial overview &amp; management</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/admin/finance/payments?new=true"
                        className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-2 rounded-md hover:bg-muted/80 transition-colors font-medium text-sm"
                    >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Record Payment</span>
                        <span className="sm:hidden">Payment</span>
                    </Link>
                    <Link
                        href="/admin/finance/invoices?new=true"
                        className="flex items-center gap-1.5 bg-foreground text-background px-3 py-2 rounded-md hover:bg-foreground/90 transition-colors font-medium text-sm"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">New Invoice</span>
                        <span className="sm:hidden">Invoice</span>
                    </Link>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Revenue */}
                <div className="bg-foreground text-background rounded-lg p-3 md:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-background/60 font-medium">Revenue (This Month)</span>
                        <IndianRupee className="h-3.5 w-3.5 text-background/40" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{formatCompact(revenueThisMonth)}</div>
                    <TrendBadge current={revenueThisMonth} previous={revenueLastMonth} />
                </div>

                {/* Amount Received */}
                <div className="bg-emerald-600 text-white rounded-lg p-3 md:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60 font-medium">Received</span>
                        <ArrowDownRight className="h-3.5 w-3.5 text-white/40" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{formatCompact(receivedThisMonth)}</div>
                    <TrendBadge current={receivedThisMonth} previous={receivedLastMonth} />
                </div>

                {/* Expenses */}
                <div className="bg-card border border-border rounded-lg p-3 md:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Expenses</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{formatCompact(expensesThisMonth)}</div>
                    <span className="text-[10px] text-muted-foreground">This month</span>
                </div>

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

            {/* ── Invoice Status Strip + 6-Month Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Invoice Status Strip */}
                <div className="lg:col-span-1 bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold">Invoice Status</h3>
                        <Link href="/admin/finance/invoices" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            View all <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>
                    {statusStrip.map(({ label, count, amount, icon: Icon, color, bg }) => (
                        <Link key={label} href={`/admin/finance/invoices?status=${label.toLowerCase()}`}>
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
                        <Link href="/admin/finance/invoices" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
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
                                    <Link key={inv.id} href={`/admin/finance/invoices`} legacyBehavior>
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
                            <Link key={inv.id} href="/admin/finance/invoices" className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
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
