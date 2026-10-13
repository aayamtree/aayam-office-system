'use client';

import { useState, useEffect } from 'react';
import type { Receivables, CustomerDebt } from '@/lib/receivables';
import {
    DoorHeader, DoorNav, DoorSection, DoorError, Figure, CashCaveat, rupees, compact,
} from '@/components/finance/Door';

interface Props {
    receivables: Receivables | null;
    error: string | null;
    awaitingCount: number | null;
    /** From the dashboard's Overdue Items: scroll to and highlight this customer. */
    focusCustomer?: string | null;
}

/** Age, shown as colour so a long list is not one undifferentiated wall of red. */
function AgeDot({ c }: { c: CustomerDebt }) {
    const tone = !c.isOverdue ? 'bg-emerald-500'
        : c.daysOverdue > 60 ? 'bg-red-500'
        : c.daysOverdue > 30 ? 'bg-orange-500'
        : 'bg-amber-400';
    return <span className={`inline-block w-1.5 h-1.5 rounded-full ${tone}`} aria-hidden />;
}

const SHOWN = 15;

export default function MoneyInClient({ receivables, error, awaitingCount, focusCustomer = null }: Props) {
    const [showAll, setShowAll] = useState(false);

    const customers = receivables?.byCustomer ?? [];
    const focusIndex = focusCustomer ? customers.findIndex((c) => c.customer === focusCustomer) : -1;
    // A customer beyond the top 15 must still be on screen when someone links to them.
    const expanded = showAll || focusIndex >= SHOWN;
    const visible = expanded ? customers : customers.slice(0, SHOWN);
    const rowId = (name: string) => `customer-${encodeURIComponent(name)}`;

    useEffect(() => {
        if (focusIndex < 0 || !focusCustomer) return;
        document.getElementById(rowId(focusCustomer))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [focusIndex, focusCustomer]);

    return (
        <div className="space-y-4">
            <DoorHeader
                title="Money In"
                question="Who owes us, who paid, and against which invoice."
                source="Invoices from Zoho Books · grouped by customer, because you do not ring an invoice number."
            />

            <DoorNav
                links={[
                    { href: '/admin/finance/awaiting-payment', label: 'Awaiting payment', count: awaitingCount },
                    { href: '/admin/finance/invoice-matching', label: 'Match invoices to jobs' },
                    { href: '/admin/finance/payment-captures', label: 'Payment proofs' },
                    { href: '/admin/finance/zoho', label: 'Every invoice in Zoho' },
                ]}
            />

            {error && <DoorError what="what customers owe us" detail={error} />}

            {receivables && focusCustomer && focusIndex < 0 && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <b>{focusCustomer}</b> no longer has an outstanding balance in Zoho.
                </div>
            )}

            {receivables && (
                <>
                    {/* A figure with no freshness stamp is a figure you cannot act on. */}
                    {receivables.syncAgeDays !== null && receivables.syncAgeDays >= 2 && (
                        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
                            Zoho last synced <b>{receivables.syncAgeDays} days ago</b>. Everything below is
                            that old — a payment received since then will still show as owed.
                        </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <Figure
                            label="Owed to us"
                            value={compact(receivables.totalOwed)}
                            note={`${receivables.invoiceCount} invoices · ${receivables.customerCount} customers`}
                            tone={receivables.overdueOwed > 0 ? 'bad' : 'plain'}
                        />
                        <Figure
                            label="Past its due date"
                            value={compact(receivables.overdueOwed)}
                            note="chase these first"
                            tone={receivables.overdueOwed > 0 ? 'bad' : 'good'}
                        />
                        <Figure
                            label="Not yet due"
                            value={compact(receivables.notYetDueOwed)}
                            note="issued, still inside terms"
                        />
                        <Figure
                            label="Biggest single customer"
                            value={customers[0] ? compact(customers[0].owed) : '—'}
                            note={customers[0]?.customer ?? 'nothing outstanding'}
                            tone={
                                customers[0] && receivables.totalOwed > 0 &&
                                customers[0].owed / receivables.totalOwed > 0.4 ? 'warn' : 'plain'
                            }
                        />
                    </div>

                    <DoorSection
                        title="Who owes us"
                        note="Biggest first, with age alongside — so an old small debt stays visible rather than sorted out of sight."
                        right={
                            customers.length > SHOWN ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAll(!expanded)}
                                    className="text-xs font-medium text-primary hover:underline"
                                >
                                    {expanded ? 'Show top 15' : `Show all ${customers.length}`}
                                </button>
                            ) : undefined
                        }
                    >
                        {customers.length === 0 ? (
                            <p className="px-3.5 py-6 text-sm text-muted-foreground text-center">
                                No invoice in Zoho currently carries a balance.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[520px]">
                                    <thead>
                                        <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                            <th className="text-left font-medium px-3.5 py-2">Customer</th>
                                            <th className="text-right font-medium px-3.5 py-2">Invoices</th>
                                            <th className="text-right font-medium px-3.5 py-2">Owed</th>
                                            <th className="text-right font-medium px-3.5 py-2">Oldest</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visible.map((c) => (
                                            <tr
                                                key={c.customer}
                                                id={rowId(c.customer)}
                                                className={`border-t border-border ${c.customer === focusCustomer ? 'bg-amber-100/70 dark:bg-amber-900/30' : ''}`}
                                            >
                                                <td className="px-3.5 py-2">
                                                    <span className="flex items-center gap-2">
                                                        <AgeDot c={c} />
                                                        <span className="truncate">{c.customer}</span>
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2 text-right tabular-nums text-muted-foreground">
                                                    {c.invoices}
                                                </td>
                                                <td className="px-3.5 py-2 text-right tabular-nums font-medium">
                                                    {rupees(c.owed)}
                                                </td>
                                                <td className="px-3.5 py-2 text-right tabular-nums text-xs text-muted-foreground">
                                                    {c.isOverdue ? `${c.daysOverdue}d overdue` : 'not due'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </DoorSection>
                </>
            )}

            <CashCaveat />
        </div>
    );
}
