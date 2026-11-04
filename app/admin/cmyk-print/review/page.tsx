'use client';

// CMYK Financial Review — Monthly / Quarterly / Yearly trend
// Sales (billed) · Collected (cash in, incl. client payments) · Costs (paper + expenses) · Profit
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { usePOSSales, useCMYKJobLogs, useCMYKExpenses, useCMYKClientPayments } from '@/lib/hooks';
import { Loader2 } from 'lucide-react';

type Granularity = 'monthly' | 'quarterly' | 'yearly';

interface PeriodRow {
    key: string;
    label: string;
    sortKey: string;
    billed: number;        // total_amount incl. GST
    billedExGst: number;   // taxable value (subtotal - discount)
    collected: number;     // cash actually in (sales + client payments)
    paperCost: number;
    expenses: number;
    expenseByCategory: Record<string, number>;
    salesCount: number;
}

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatCompact = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${Math.round(n)}`;
};

// Indian fiscal year (Apr–Mar)
const fyOf = (d: Date) => (d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1);
const fyLabel = (fy: number) => `FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`;
const fyQuarter = (d: Date) => Math.floor(((d.getMonth() + 1 + 8) % 12) / 3) + 1;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodKeyOf(d: Date, g: Granularity): { key: string; label: string; sortKey: string } {
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (g === 'monthly') return { key: sortKey, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, sortKey };
    if (g === 'quarterly') {
        const fy = fyOf(d), q = fyQuarter(d);
        return { key: `${fy}-Q${q}`, label: `Q${q} ${fyLabel(fy)}`, sortKey };
    }
    const fy = fyOf(d);
    return { key: `FY${fy}`, label: fyLabel(fy), sortKey };
}

const EXPENSE_LABELS: Record<string, string> = {
    transportation: 'Transportation', electricity: 'Electricity', maintenance: 'Maintenance',
    consumables: 'Consumables', labor: 'Labor / Operator', other: 'Other',
};

function DeltaBadge({ current, previous }: { current: number; previous: number | null }) {
    if (previous === null || previous === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(pct) < 0.05) return <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />0%</span>;
    const up = pct > 0;
    return (
        <span className={`text-[10px] flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-red-600'}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(pct).toFixed(0)}%
        </span>
    );
}

export default function CMYKReviewPage() {
    const [granularity, setGranularity] = useState<Granularity>('monthly');
    const [expanded, setExpanded] = useState<string | null>(null);

    const { sales, loading: salesLoading } = usePOSSales();
    const { logs } = useCMYKJobLogs();
    const { expenses } = useCMYKExpenses();
    const { payments } = useCMYKClientPayments();

    const periods = useMemo(() => {
        const map = new Map<string, PeriodRow>();
        const bucket = (d: Date): PeriodRow => {
            const { key, label, sortKey } = periodKeyOf(d, granularity);
            if (!map.has(key)) map.set(key, {
                key, label, sortKey, billed: 0, billedExGst: 0, collected: 0,
                paperCost: 0, expenses: 0, expenseByCategory: {}, salesCount: 0,
            });
            const row = map.get(key)!;
            if (sortKey < row.sortKey) row.sortKey = sortKey;
            return row;
        };

        for (const s of sales || []) {
            if (!s.created_at) continue;
            const row = bucket(new Date(s.created_at));
            row.billed += s.total_amount || 0;
            row.billedExGst += (s.subtotal || 0) - (s.discount_amount || 0);
            row.salesCount += 1;
            // Cash in at sale time: paid = full bill, partial = advance received, credit = 0
            if (s.payment_status === 'partial') row.collected += s.amount_received || 0;
            else if (s.payment_status !== 'pending') row.collected += s.total_amount || 0;
        }
        // Later collections from monthly-credit clients
        for (const p of payments || []) {
            if (!p.paid_on) continue;
            bucket(new Date(p.paid_on)).collected += p.amount || 0;
        }
        for (const l of logs || []) {
            const when = l.completed_at || l.created_at;
            if (!when) continue;
            bucket(new Date(when)).paperCost += l.paper_cost || 0;
        }
        for (const e of expenses || []) {
            if (!e.expense_date) continue;
            const row = bucket(new Date(e.expense_date));
            row.expenses += e.amount || 0;
            row.expenseByCategory[e.category] = (row.expenseByCategory[e.category] || 0) + (e.amount || 0);
        }

        // Fill the gaps: a month (or quarter) with no activity must still show as an
        // empty row, otherwise the list jumps (e.g. Feb → Jul) and looks like data is missing.
        if (map.size > 0) {
            const keys = Array.from(map.values()).map(r => r.sortKey).sort();
            const [sy, sm] = keys[0].split('-').map(Number);
            const [ey, em] = keys[keys.length - 1].split('-').map(Number);
            for (let y = sy, m = sm - 1; y < ey || (y === ey && m <= em - 1); m++) {
                if (m > 11) { m = 0; y++; }
                bucket(new Date(y, m, 1));
            }
        }

        return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [sales, logs, expenses, payments, granularity]);

    const chartPeriods = useMemo(
        () => periods.slice(granularity === 'monthly' ? -12 : granularity === 'quarterly' ? -8 : -5),
        [periods, granularity]
    );
    const maxVal = Math.max(...chartPeriods.flatMap(p => [p.billed, p.collected, p.paperCost + p.expenses]), 1);

    const totals = useMemo(() => ({
        billed: periods.reduce((s, p) => s + p.billed, 0),
        billedExGst: periods.reduce((s, p) => s + p.billedExGst, 0),
        collected: periods.reduce((s, p) => s + p.collected, 0),
        costs: periods.reduce((s, p) => s + p.paperCost + p.expenses, 0),
    }), [periods]);
    const totalProfit = totals.billedExGst - totals.costs;

    const tableRows = useMemo(() => [...periods].reverse(), [periods]);

    if (salesLoading) {
        return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <Link href="/admin/cmyk-print" className="p-2 hover:bg-muted rounded-md border border-border">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">CMYK Financial Review</h1>
                        <p className="text-sm text-muted-foreground">Sales, collections &amp; costs over time · profit is on billed value ex-GST</p>
                    </div>
                </div>
                <div className="flex bg-muted p-1 rounded-md self-start">
                    {(['monthly', 'quarterly', 'yearly'] as Granularity[]).map(g => (
                        <button
                            key={g}
                            onClick={() => { setGranularity(g); setExpanded(null); }}
                            className={`px-3 py-1 text-sm font-medium rounded-md capitalize transition-colors ${granularity === g ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            {/* Totals strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Sales (billed)
                    </span>
                    <p className="text-xl font-bold tabular-nums text-emerald-600">{formatCompact(totals.billed)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" />Collected
                    </span>
                    <p className="text-xl font-bold tabular-nums text-sky-600">{formatCompact(totals.collected)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Costs (paper + expenses)
                    </span>
                    <p className="text-xl font-bold tabular-nums text-red-600">{formatCompact(totals.costs)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground">Net {totalProfit >= 0 ? 'Profit' : 'Loss'}</span>
                    <p className={`text-xl font-bold tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCompact(Math.abs(totalProfit))}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-4">Trend <span className="text-xs font-normal text-muted-foreground capitalize">· {granularity}</span></h3>
                {chartPeriods.length > 0 ? (
                    <div className="flex items-end justify-between gap-2 h-44 border-b border-border pb-1">
                        {chartPeriods.map(p => {
                            const costs = p.paperCost + p.expenses;
                            return (
                                <div key={p.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0">
                                    <div className="flex items-end justify-center gap-0.5 w-full h-full">
                                        <div className="w-1/3 max-w-[14px] bg-emerald-500 rounded-t-sm" title={`Billed: ${formatCurrency(p.billed)}`}
                                            style={{ height: `${Math.max((p.billed / maxVal) * 100, p.billed > 0 ? 3 : 0)}%` }} />
                                        <div className="w-1/3 max-w-[14px] bg-sky-500 rounded-t-sm" title={`Collected: ${formatCurrency(p.collected)}`}
                                            style={{ height: `${Math.max((p.collected / maxVal) * 100, p.collected > 0 ? 3 : 0)}%` }} />
                                        <div className="w-1/3 max-w-[14px] bg-red-500 rounded-t-sm" title={`Costs: ${formatCurrency(costs)}`}
                                            style={{ height: `${Math.max((costs / maxVal) * 100, costs > 0 ? 3 : 0)}%` }} />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{p.label}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">No sales yet</div>
                )}
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                                <th className="px-4 py-2.5 font-medium">Period</th>
                                <th className="px-4 py-2.5 font-medium text-right">Sales (billed)</th>
                                <th className="px-4 py-2.5 font-medium text-right">Collected</th>
                                <th className="px-4 py-2.5 font-medium text-right">Costs</th>
                                <th className="px-4 py-2.5 font-medium text-right">Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((p, i) => {
                                const prev = tableRows[i + 1] || null;
                                const costs = p.paperCost + p.expenses;
                                const profit = p.billedExGst - costs;
                                const isOpen = expanded === p.key;
                                return (
                                    <PeriodTableRow key={p.key} p={p} prev={prev} costs={costs} profit={profit}
                                        isOpen={isOpen} onToggle={() => setExpanded(isOpen ? null : p.key)} />
                                );
                            })}
                            {tableRows.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No data yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function PeriodTableRow({ p, prev, costs, profit, isOpen, onToggle }: {
    p: PeriodRow; prev: PeriodRow | null; costs: number; profit: number; isOpen: boolean; onToggle: () => void;
}) {
    const prevCosts = prev ? prev.paperCost + prev.expenses : null;
    return (
        <>
            <tr className="border-b border-border hover:bg-muted/40 cursor-pointer" onClick={onToggle}>
                <td className="px-4 py-2.5 font-medium flex items-center gap-1.5">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {p.label}
                    <span className="text-[10px] text-muted-foreground font-normal">({p.salesCount} bills)</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                        <DeltaBadge current={p.billed} previous={prev ? prev.billed : null} />
                        <span className="text-emerald-700">{formatCurrency(p.billed)}</span>
                    </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-sky-700">{formatCurrency(p.collected)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                        <DeltaBadge current={costs} previous={prevCosts} />
                        <span className="text-red-700">{formatCurrency(costs)}</span>
                    </div>
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {profit < 0 ? '-' : ''}{formatCurrency(Math.abs(profit))}
                </td>
            </tr>
            {isOpen && (
                <tr className="border-b border-border bg-muted/20">
                    <td colSpan={5} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold mb-1.5">Income</p>
                                <div className="flex justify-between text-xs py-0.5">
                                    <span className="text-muted-foreground">Billed (ex-GST taxable value)</span>
                                    <span className="tabular-nums">{formatCurrency(p.billedExGst)}</span>
                                </div>
                                <div className="flex justify-between text-xs py-0.5">
                                    <span className="text-muted-foreground">GST portion</span>
                                    <span className="tabular-nums">{formatCurrency(p.billed - p.billedExGst)}</span>
                                </div>
                                <div className="flex justify-between text-xs py-0.5">
                                    <span className="text-muted-foreground">Cash collected</span>
                                    <span className="tabular-nums">{formatCurrency(p.collected)}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-red-700 mb-1.5">Cost breakdown</p>
                                <div className="flex justify-between text-xs py-0.5">
                                    <span className="text-muted-foreground">Paper (from job log)</span>
                                    <span className="tabular-nums">{formatCurrency(p.paperCost)}</span>
                                </div>
                                {Object.entries(p.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                                    <div key={cat} className="flex justify-between text-xs py-0.5">
                                        <span className="text-muted-foreground">{EXPENSE_LABELS[cat] || cat}</span>
                                        <span className="tabular-nums">{formatCurrency(amt)}</span>
                                    </div>
                                ))}
                                {costs === 0 && <p className="text-xs text-muted-foreground">No costs recorded</p>}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
