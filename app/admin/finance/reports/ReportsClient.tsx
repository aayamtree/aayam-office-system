'use client';

import Link from 'next/link';
import type { FinanceOverviewData } from '@/lib/finance-overview-data';
import {
    DoorHeader, DoorNav, DoorSection, DoorError, Figure, CashCaveat, rupees, compact,
} from '@/components/finance/Door';

export default function ReportsClient({ data }: { data: FinanceOverviewData }) {
    const { cashflow, monthlyRevenue, bankFeedThrough, bankFeedDaysBehind, failed } = data;

    const maxIE = Math.max(...cashflow.monthly.flatMap((m) => [m.income, m.expense]), 1);
    const maxBilled = Math.max(...monthlyRevenue.flatMap((m) => [m.revenue, m.received]), 1);
    const net = cashflow.totalIncome - cashflow.totalExpense;
    const categoryTotal = cashflow.topExpenses.reduce((s, e) => s + e.amount, 0) || 1;

    return (
        <div className="space-y-4">
            <DoorHeader
                title="Reports"
                question="What it added up to."
                source="Money in and out of the bank account, from Zoho's HDFC feed. Deliberately not called a P&L — it is cash movement, not revenue and cost."
            />

            <DoorNav
                links={[
                    { href: '/admin/finance/reports/vendor-reports', label: 'Vendor report' },
                    { href: '/admin/reports/sales', label: 'Sales & dispatch' },
                    { href: '/admin/finance/zoho', label: 'Zoho Books' },
                ]}
            />

            {failed && <DoorError what="the figures from Zoho" />}

            {!failed && bankFeedDaysBehind !== null && bankFeedDaysBehind > 1 && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    The newest line in the bank feed is dated <b className="text-foreground">{bankFeedThrough}</b>.
                    Everything below about money moved stops there.
                </div>
            )}

            {/* fetchFinanceOverview returns an all-zero EMPTY snapshot when a query
                fails. Rendering it under the error banner produced "₹0 into the bank"
                in green next to "could not load" — a calm zero is exactly what this
                door was built to stop showing. Nothing numeric renders on failure. */}
            {!failed && (
                <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <Figure label={`Into the bank · ${cashflow.fyLabel}`} value={compact(cashflow.totalIncome)} tone="good" />
                    <Figure label={`Out of the bank · ${cashflow.fyLabel}`} value={compact(cashflow.totalExpense)} note={`${cashflow.expenseCountFY} payments`} />
                    <Figure
                        label="Difference"
                        value={compact(Math.abs(net))}
                        note={net >= 0 ? 'more in than out' : 'more out than in'}
                        tone={net >= 0 ? 'good' : 'warn'}
                    />
                    <Figure label="Still owed to us" value={compact(data.outstandingTotal)} note={`${data.overdueToday} invoices overdue`} tone={data.overdueToday > 0 ? 'bad' : 'plain'} />
                </div>

                <DoorSection title={`Month by month · ${cashflow.fyLabel}`} note="In and out of the bank account.">
                    <div className="p-3.5 overflow-x-auto">
                        <div className="flex items-end gap-3 min-w-[480px] h-40">
                            {cashflow.monthly.map((m) => (
                                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-[36px]">
                                    <div className="flex-1 w-full flex items-end justify-center gap-1">
                                        <div
                                            className="w-1/2 rounded-t bg-emerald-500/80"
                                            style={{ height: `${Math.max(2, (m.income / maxIE) * 100)}%` }}
                                            title={`In ${rupees(m.income)}`}
                                        />
                                        <div
                                            className="w-1/2 rounded-t bg-orange-400/80"
                                            style={{ height: `${Math.max(2, (m.expense / maxIE) * 100)}%` }}
                                            title={`Out ${rupees(m.expense)}`}
                                        />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" /> into the bank
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-orange-400/80" /> out of the bank
                            </span>
                        </div>
                    </div>
                </DoorSection>

                <DoorSection
                    title="What the money went on"
                    note="The category assigned in Zoho. Money with no category is shown as its own line, never folded into Others — it is the largest single bucket and hiding it would hide the problem."
                >
                    {cashflow.topExpenses.length === 0 ? (
                        <p className="px-3.5 py-6 text-sm text-muted-foreground text-center">
                            No outgoing payment in the feed this fiscal year.
                        </p>
                    ) : (
                        <div className="p-3.5 space-y-2">
                            {cashflow.topExpenses.map((e) => {
                                const uncategorised = e.name === 'Not categorised in Zoho';
                                return (
                                    <div key={e.name} className="flex items-center gap-3">
                                        <span className={`w-44 shrink-0 text-xs truncate ${uncategorised ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                                            {e.name}
                                        </span>
                                        <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                            <span
                                                className={`block h-full rounded-full ${uncategorised ? 'bg-amber-500' : 'bg-primary/70'}`}
                                                style={{ width: `${Math.max(2, (e.amount / categoryTotal) * 100)}%` }}
                                            />
                                        </span>
                                        <span className="w-24 shrink-0 text-right text-xs tabular-nums font-medium">
                                            {rupees(e.amount)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DoorSection>

                <DoorSection
                    title="Billed against collected"
                    note="What we invoiced each month, and what actually reached the bank in that month. They are not the same money — an invoice raised in June is often collected in August."
                >
                    <div className="p-3.5 overflow-x-auto">
                        <div className="flex items-end gap-3 min-w-[380px] h-32">
                            {monthlyRevenue.map((m) => (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-[36px]">
                                    <div className="flex-1 w-full flex items-end justify-center gap-1">
                                        <div
                                            className="w-1/2 rounded-t bg-primary/70"
                                            style={{ height: `${Math.max(2, (m.revenue / maxBilled) * 100)}%` }}
                                            title={`Billed ${rupees(m.revenue)}`}
                                        />
                                        <div
                                            className="w-1/2 rounded-t bg-emerald-500/80"
                                            style={{ height: `${Math.max(2, (m.received / maxBilled) * 100)}%` }}
                                            title={`Into the bank ${rupees(m.received)}`}
                                        />
                                    </div>
                                    <span className={`text-[10px] ${m.active ? 'font-semibold' : 'text-muted-foreground'}`}>
                                        {m.month}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-primary/70" /> billed
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" /> into the bank
                            </span>
                        </div>
                    </div>
                </DoorSection>
                </>
            )}

            <CashCaveat />

            {/* Nothing was deleted in phase 4. These read the ledger that stopped
                moving on 5 August, so they are off the menu — but a screen that is
                unreachable is a screen you cannot check, and July still matters. */}
            <details className="text-[11px] text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                    Older screens, kept until they are archived properly
                </summary>
                <p className="mt-1.5">
                    These read the app&rsquo;s own ledger, which stopped moving on 5 August 2026. The figures on
                    them are not current and never will be again.
                </p>
                <ul className="mt-1.5 space-y-1">
                    {[
                        ['/admin/finance/reports/payments-old', 'Payment report (was Reports)'],
                        ['/admin/finance/reports/accounting', 'Accounting reports'],
                        ['/admin/finance/daily', 'Daily summary'],
                        
                        ['/admin/reports/finance', 'Finance report (income and expenses, to 5 Aug)'],
                    ].map(([href, label]) => (
                        <li key={href}>
                            <Link href={href} className="hover:text-foreground underline underline-offset-2">
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );
}
