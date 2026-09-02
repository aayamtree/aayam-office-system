'use client';

import { useState } from 'react';
import type { Payables, VendorDebt } from '@/lib/payables';
import {
    DoorHeader, DoorLink, DoorSection, DoorError, Figure, CashCaveat, rupees, compact,
} from '@/components/finance/Door';

interface Props {
    payables: Payables | null;
    ageing: { label: string; owed: number; vendors: number }[];
    error: string | null;
    vendorCount: number | null;
}

function AgeDot({ v }: { v: VendorDebt }) {
    const tone = !v.isOverdue ? 'bg-emerald-500'
        : v.daysOverdue > 60 ? 'bg-red-500'
        : v.daysOverdue > 30 ? 'bg-orange-500'
        : 'bg-amber-400';
    return <span className={`inline-block w-1.5 h-1.5 rounded-full ${tone}`} aria-hidden />;
}

const SHOWN = 15;

export default function MoneyOutClient({ payables, ageing, error, vendorCount }: Props) {
    const [showAll, setShowAll] = useState(false);

    const vendors = payables?.byVendor ?? [];
    const visible = showAll ? vendors : vendors.slice(0, SHOWN);

    // Concentration, not ageing. A supplier holding most of your payables is not
    // really a supplier any more, and that is worth seeing even when — especially
    // when — the ageing itself is a deliberate business decision.
    const top = vendors[0];
    const topShare = top && payables && payables.totalOwed > 0
        ? Math.round((top.owed / payables.totalOwed) * 100)
        : null;

    const maxBucket = Math.max(...ageing.map((b) => b.owed), 1);

    return (
        <div className="space-y-4">
            <DoorHeader
                title="Money Out"
                question="Who we owe, what we paid, and to which vendor."
                source="Bills from Zoho Books · grouped by vendor, because eight bills from one supplier is one phone call."
            />

            {error && <DoorError what="what we owe vendors" detail={error} />}

            {payables && (
                <>
                    {payables.syncAgeDays !== null && payables.syncAgeDays >= 2 && (
                        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
                            Zoho last synced <b>{payables.syncAgeDays} days ago</b>. A bill paid since then
                            will still show here as owed.
                        </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <Figure
                            label="We owe"
                            value={compact(payables.totalOwed)}
                            note={`${payables.billCount} bills · ${payables.vendorCount} vendors`}
                        />
                        <Figure
                            label="Past its due date"
                            value={compact(payables.overdueOwed)}
                            note="already late"
                            tone={payables.overdueOwed > 0 ? 'warn' : 'good'}
                        />
                        <Figure
                            label="Not yet due"
                            value={compact(payables.notYetDueOwed)}
                            note="inside terms"
                        />
                        <Figure
                            label="Largest vendor"
                            value={top ? compact(top.owed) : '—'}
                            note={top ? `${top.vendor} · ${topShare}% of everything we owe` : 'nothing outstanding'}
                            tone={topShare !== null && topShare > 50 ? 'warn' : 'plain'}
                        />
                    </div>

                    <DoorSection
                        title="How old it is"
                        note="Counted from the oldest unpaid due date for each vendor."
                    >
                        <div className="p-3.5 space-y-2">
                            {ageing.map((b) => (
                                <div key={b.label} className="flex items-center gap-3">
                                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{b.label}</span>
                                    <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                        <span
                                            className={`block h-full rounded-full ${
                                                b.label === 'Not yet due' ? 'bg-emerald-500' : 'bg-orange-500'
                                            }`}
                                            style={{ width: `${Math.max(2, (b.owed / maxBucket) * 100)}%` }}
                                        />
                                    </span>
                                    <span className="w-24 shrink-0 text-right text-xs tabular-nums font-medium">
                                        {rupees(b.owed)}
                                    </span>
                                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                                        {b.vendors} vendor{b.vendors === 1 ? '' : 's'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </DoorSection>

                    <DoorSection
                        title="Who we owe"
                        note="Biggest first."
                        right={
                            vendors.length > SHOWN ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAll((v) => !v)}
                                    className="text-xs font-medium text-primary hover:underline"
                                >
                                    {showAll ? 'Show top 15' : `Show all ${vendors.length}`}
                                </button>
                            ) : undefined
                        }
                    >
                        {vendors.length === 0 ? (
                            <p className="px-3.5 py-6 text-sm text-muted-foreground text-center">
                                No bill in Zoho currently carries a balance.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[520px]">
                                    <thead>
                                        <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                            <th className="text-left font-medium px-3.5 py-2">Vendor</th>
                                            <th className="text-right font-medium px-3.5 py-2">Bills</th>
                                            <th className="text-right font-medium px-3.5 py-2">Owed</th>
                                            <th className="text-right font-medium px-3.5 py-2">Oldest</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visible.map((v) => (
                                            <tr key={v.vendor} className="border-t border-border">
                                                <td className="px-3.5 py-2">
                                                    <span className="flex items-center gap-2">
                                                        <AgeDot v={v} />
                                                        <span className="truncate">{v.vendor}</span>
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2 text-right tabular-nums text-muted-foreground">
                                                    {v.bills}
                                                </td>
                                                <td className="px-3.5 py-2 text-right tabular-nums font-medium">
                                                    {rupees(v.owed)}
                                                </td>
                                                <td className="px-3.5 py-2 text-right tabular-nums text-xs text-muted-foreground">
                                                    {v.isOverdue ? `${v.daysOverdue}d overdue` : 'not due'}
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

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <DoorLink
                    href="/admin/finance/vendors"
                    label="Vendors"
                    hint="Names, contacts and payment terms"
                    count={vendorCount}
                />
                <DoorLink
                    href="/admin/finance/zoho"
                    label="Every bill in Zoho"
                    hint="The full list, straight from the book of record"
                />
                <DoorLink
                    href="/admin/finance/payment-captures"
                    label="Payment proofs"
                    hint="Screenshots of what we have already paid out"
                />
                <DoorLink
                    href="/admin/finance/reports/vendor-reports"
                    label="Vendor report"
                    hint="What each vendor did, by job"
                />
            </div>

            <CashCaveat />
        </div>
    );
}
