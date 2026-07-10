'use client';

// Financial Review — Monthly / Quarterly / Yearly income vs expense trend
// Income shown two ways: Billed (income accounts) and Collected (cash/bank in).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface BreakdownRow { name: string; amount: number }
export interface MonthRow {
    month_start: string;
    label: string;
    income: number;
    collected: number;
    expense: number;
    income_breakdown: BreakdownRow[];
    expense_breakdown: BreakdownRow[];
}

type Granularity = 'monthly' | 'quarterly' | 'yearly';

interface PeriodRow extends Omit<MonthRow, 'month_start' | 'label'> {
    key: string;
    label: string;
    sortKey: string;
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

// Indian fiscal year helpers (Apr–Mar)
const fyOf = (d: Date) => (d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1);
const fyLabel = (fy: number) => `FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`;
const fyQuarter = (d: Date) => Math.floor(((d.getMonth() + 1 + 8) % 12) / 3) + 1; // Apr→Q1 … Jan-Mar→Q4

function mergeBreakdowns(lists: BreakdownRow[][]): BreakdownRow[] {
    const map = new Map<string, number>();
    for (const list of lists) for (const b of list) map.set(b.name, (map.get(b.name) || 0) + b.amount);
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

function groupRows(rows: MonthRow[], granularity: Granularity): PeriodRow[] {
    const buckets = new Map<string, { label: string; sortKey: string; months: MonthRow[] }>();
    for (const r of rows) {
        const d = new Date(r.month_start);
        let key: string, label: string;
        if (granularity === 'monthly') {
            key = r.month_start;
            label = r.label;
        } else if (granularity === 'quarterly') {
            const fy = fyOf(d), q = fyQuarter(d);
            key = `${fy}-Q${q}`;
            label = `Q${q} ${fyLabel(fy)}`;
        } else {
            const fy = fyOf(d);
            key = `FY${fy}`;
            label = fyLabel(fy);
        }
        if (!buckets.has(key)) buckets.set(key, { label, sortKey: r.month_start, months: [] });
        buckets.get(key)!.months.push(r);
    }
    return Array.from(buckets.entries())
        .map(([key, b]) => ({
            key,
            label: b.label,
            sortKey: b.sortKey,
            income: b.months.reduce((s, m) => s + m.income, 0),
            collected: b.months.reduce((s, m) => s + m.collected, 0),
            expense: b.months.reduce((s, m) => s + m.expense, 0),
            income_breakdown: mergeBreakdowns(b.months.map(m => m.income_breakdown)),
            expense_breakdown: mergeBreakdowns(b.months.map(m => m.expense_breakdown)),
        }))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

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

export default function ReviewClient({ rows }: { rows: MonthRow[] }) {
    const [granularity, setGranularity] = useState<Granularity>('monthly');
    const [expanded, setExpanded] = useState<string | null>(null);

    const periods = useMemo(() => groupRows(rows, granularity), [rows, granularity]);
    // Chart shows the most recent periods that fit comfortably
    const chartPeriods = useMemo(
        () => periods.slice(granularity === 'monthly' ? -12 : granularity === 'quarterly' ? -8 : -5),
        [periods, granularity]
    );
    const maxVal = Math.max(...chartPeriods.flatMap(p => [p.income, p.collected, p.expense]), 1);

    const totals = useMemo(() => ({
        income: periods.reduce((s, p) => s + p.income, 0),
        collected: periods.reduce((s, p) => s + p.collected, 0),
        expense: periods.reduce((s, p) => s + p.expense, 0),
    }), [periods]);
    const totalNet = totals.income - totals.expense;

    // Table newest first
    const tableRows = useMemo(() => [...periods].reverse(), [periods]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <Link href="/admin/finance" className="p-2 hover:bg-muted rounded-md border border-border">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Financial Review</h1>
                        <p className="text-sm text-muted-foreground">Income vs expense from the ledger · all figures reconcile with P&amp;L</p>
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
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Income (billed)
                    </span>
                    <p className="text-xl font-bold tabular-nums text-emerald-600">{formatCompact(totals.income)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" />Cash collected
                    </span>
                    <p className="text-xl font-bold tabular-nums text-sky-600">{formatCompact(totals.collected)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Expenses
                    </span>
                    <p className="text-xl font-bold tabular-nums text-red-600">{formatCompact(totals.expense)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground">Net {totalNet >= 0 ? 'Profit' : 'Loss'}</span>
                    <p className={`text-xl font-bold tabular-nums ${totalNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCompact(Math.abs(totalNet))}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-4">Trend <span className="text-xs font-normal text-muted-foreground capitalize">· {granularity}</span></h3>
                {chartPeriods.length > 0 ? (
                    <div className="flex items-end justify-between gap-2 h-44 border-b border-border pb-1">
                        {chartPeriods.map(p => (
                            <div key={p.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0">
                                <div className="flex items-end justify-center gap-0.5 w-full h-full">
                                    <div className="w-1/3 max-w-[14px] bg-emerald-500 rounded-t-sm" title={`Billed: ${formatCurrency(p.income)}`}
                                        style={{ height: `${Math.max((p.income / maxVal) * 100, p.income > 0 ? 3 : 0)}%` }} />
                                    <div className="w-1/3 max-w-[14px] bg-sky-500 rounded-t-sm" title={`Collected: ${formatCurrency(p.collected)}`}
                                        style={{ height: `${Math.max((p.collected / maxVal) * 100, p.collected > 0 ? 3 : 0)}%` }} />
                                    <div className="w-1/3 max-w-[14px] bg-red-500 rounded-t-sm" title={`Expense: ${formatCurrency(p.expense)}`}
                                        style={{ height: `${Math.max((p.expense / maxVal) * 100, p.expense > 0 ? 3 : 0)}%` }} />
                                </div>
                                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{p.label}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">No posted entries yet</div>
                )}
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                                <th className="px-4 py-2.5 font-medium">Period</th>
                                <th className="px-4 py-2.5 font-medium text-right">Income (billed)</th>
                                <th className="px-4 py-2.5 font-medium text-right">Collected</th>
                                <th className="px-4 py-2.5 font-medium text-right">Expenses</th>
                                <th className="px-4 py-2.5 font-medium text-right">Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((p, i) => {
                                const prev = tableRows[i + 1] || null; // newest first → previous period is next row
                                const net = p.income - p.expense;
                                const isOpen = expanded === p.key;
                                return (
                                    <FragmentRow key={p.key} p={p} prev={prev} net={net} isOpen={isOpen}
                                        onToggle={() => setExpanded(isOpen ? null : p.key)} />
                                );
                            })}
                            {tableRows.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No data yet — post some entries first</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function FragmentRow({ p, prev, net, isOpen, onToggle }: {
    p: PeriodRow; prev: PeriodRow | null; net: number; isOpen: boolean; onToggle: () => void;
}) {
    return (
        <>
            <tr className="border-b border-border hover:bg-muted/40 cursor-pointer" onClick={onToggle}>
                <td className="px-4 py-2.5 font-medium flex items-center gap-1.5">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {p.label}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                        <DeltaBadge current={p.income} previous={prev ? prev.income : null} />
                        <span className="text-emerald-700">{formatCurrency(p.income)}</span>
                    </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-sky-700">{formatCurrency(p.collected)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                        <DeltaBadge current={p.expense} previous={prev ? prev.expense : null} />
                        <span className="text-red-700">{formatCurrency(p.expense)}</span>
                    </div>
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net))}
                </td>
            </tr>
            {isOpen && (
                <tr className="border-b border-border bg-muted/20">
                    <td colSpan={5} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold text-emerald-700 mb-1.5">Income breakdown</p>
                                {p.income_breakdown.length > 0 ? p.income_breakdown.map(b => (
                                    <div key={b.name} className="flex justify-between text-xs py-0.5">
                                        <span className="text-muted-foreground">{b.name}</span>
                                        <span className="tabular-nums">{formatCurrency(b.amount)}</span>
                                    </div>
                                )) : <p className="text-xs text-muted-foreground">No income entries</p>}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-red-700 mb-1.5">Expense breakdown</p>
                                {p.expense_breakdown.length > 0 ? p.expense_breakdown.map(b => (
                                    <div key={b.name} className="flex justify-between text-xs py-0.5">
                                        <span className="text-muted-foreground">{b.name}</span>
                                        <span className="tabular-nums">{formatCurrency(b.amount)}</span>
                                    </div>
                                )) : <p className="text-xs text-muted-foreground">No expense entries</p>}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
