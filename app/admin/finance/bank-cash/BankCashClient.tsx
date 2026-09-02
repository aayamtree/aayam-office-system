'use client';

import {
    DoorHeader, DoorLink, DoorSection, DoorError, Figure, rupees, compact,
} from '@/components/finance/Door';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface Line {
    id: string;
    amount: number | null;
    txn_date: string | null;
    debit_or_credit: string | null;
    payee: string | null;
    description: string | null;
    offset_account_name: string | null;
}

interface Props {
    feedThrough: string | null;
    feedReadFailed: boolean;
    lines: Line[];
    linesError: string | null;
    monthStart: string;
    cashToEnter: number;
    /** True at the query's cap: there are almost certainly more than this. */
    cashTruncated: boolean;
    cashError: string | null;
    accountCount: number | null;
    today: string;
}

// In Zoho's feed `debit_or_credit` is written from the LEDGER's point of view:
// debit = money IN, credit = money OUT. Reading it the intuitive way shows
// spending as income, so it is decided in exactly one place on this screen.
const isIn = (l: Line) => String(l.debit_or_credit || '').toLowerCase() === 'debit';
const isOut = (l: Line) => String(l.debit_or_credit || '').toLowerCase() === 'credit';

const day = (d: string | null) =>
    !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export default function BankCashClient({
    feedThrough, feedReadFailed, lines, linesError, monthStart,
    cashToEnter, cashTruncated, cashError, accountCount, today,
}: Props) {
    const num = (v: unknown) => Number(v) || 0;
    const thisMonth = lines.filter((l) => (l.txn_date || '') >= monthStart);
    const inMonth = thisMonth.filter(isIn).reduce((s, l) => s + num(l.amount), 0);
    const outMonth = thisMonth.filter(isOut).reduce((s, l) => s + num(l.amount), 0);

    const daysBehind = feedThrough
        ? Math.max(0, Math.round(
            (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${feedThrough}T00:00:00Z`)) / 86_400_000))
        : null;

    const recent = lines.slice(0, 25);

    // An unread query and a quiet month must never look alike. When the lines
    // could not be fetched, every figure derived from them shows a dash.
    const bankUnknown = Boolean(linesError);
    const cashUnknown = Boolean(cashError);

    return (
        <div className="space-y-4">
            <DoorHeader
                title="Bank & Cash"
                question="What the bank shows, and what is still to enter."
                source="The HDFC feed in Zoho Books · plus the cash inbox, which no statement will ever confirm."
            />

            {feedReadFailed && <DoorError what="the bank feed" />}
            {linesError && <DoorError what="the bank statement lines" detail={linesError} />}
            {cashError && <DoorError what="the cash queue" detail={cashError} />}

            {/* All the feed proves is that a line dated X exists in it. It does
                NOT prove the statement is complete up to that date — Satish reads
                a prompt sync as a current statement, and they are not the same. */}
            {!feedReadFailed && (
                <div
                    className={`rounded-md border px-3 py-2 text-xs ${
                        daysBehind === null || daysBehind > 7
                            ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300'
                            : 'border-border bg-muted/40 text-muted-foreground'
                    }`}
                >
                    {feedThrough ? (
                        <>
                            The newest line in the bank feed is dated <b>{feedThrough}</b>
                            {daysBehind !== null && daysBehind > 0 ? ` — ${daysBehind} days ago` : ''}. Anything
                            paid since then has not reached this screen yet, and its absence here proves nothing.
                        </>
                    ) : (
                        <>The bank feed is empty. Nothing on this screen can be confirmed against a statement.</>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <Figure
                    label="Into the bank this month"
                    value={bankUnknown ? '—' : compact(inMonth)}
                    note={bankUnknown ? 'could not be read' : `${thisMonth.filter(isIn).length} lines`}
                    tone={bankUnknown ? 'plain' : 'good'}
                />
                <Figure
                    label="Out of the bank this month"
                    value={bankUnknown ? '—' : compact(outMonth)}
                    note={bankUnknown ? 'could not be read' : `${thisMonth.filter(isOut).length} lines`}
                />
                <Figure
                    label="Net movement"
                    value={bankUnknown ? '—' : compact(inMonth - outMonth)}
                    note={bankUnknown
                        ? 'could not be read'
                        : (inMonth - outMonth >= 0 ? 'more in than out' : 'more out than in')}
                    tone={bankUnknown ? 'plain' : (inMonth - outMonth >= 0 ? 'good' : 'warn')}
                />
                <Figure
                    label="Cash still to enter in Zoho"
                    value={cashUnknown ? '—' : `${cashToEnter}${cashTruncated ? '+' : ''}`}
                    note={cashUnknown
                        ? 'could not be read'
                        : (cashToEnter > 0 ? 'no statement will ever confirm these' : 'nothing waiting')}
                    tone={cashUnknown ? 'plain' : (cashToEnter > 0 ? 'warn' : 'good')}
                />
            </div>

            <DoorSection
                title="Recent bank lines"
                note="Straight from the feed, newest first. Money in is a debit in Zoho's wording — it is decided once, here."
            >
                {recent.length === 0 ? (
                    <p className="px-3.5 py-6 text-sm text-muted-foreground text-center">
                        {bankUnknown
                            ? 'The statement lines could not be read, so none are shown — which is not the same as there being none.'
                            : 'No bank line in the last 45 days.'}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[560px]">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    <th className="text-left font-medium px-3.5 py-2 w-16">Date</th>
                                    <th className="text-left font-medium px-3.5 py-2">Who</th>
                                    <th className="text-left font-medium px-3.5 py-2">Category in Zoho</th>
                                    <th className="text-right font-medium px-3.5 py-2">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.map((l) => (
                                    <tr key={l.id} className="border-t border-border">
                                        <td className="px-3.5 py-2 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                                            {day(l.txn_date)}
                                        </td>
                                        <td className="px-3.5 py-2">
                                            <span className="flex items-center gap-1.5 min-w-0">
                                                {isIn(l)
                                                    ? <ArrowDownLeft className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                                    : <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                                                <span className="truncate">
                                                    {l.payee || l.description || 'no payee recorded'}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-2 text-xs">
                                            {l.offset_account_name?.trim() ? (
                                                <span className="text-muted-foreground">{l.offset_account_name}</span>
                                            ) : (
                                                <span className="text-amber-700 dark:text-amber-400">
                                                    Not categorised in Zoho
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-3.5 py-2 text-right tabular-nums font-medium ${
                                            isIn(l) ? 'text-emerald-700 dark:text-emerald-400' : ''
                                        }`}>
                                            {isIn(l) ? '+' : '−'}{rupees(Number(l.amount) || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </DoorSection>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <DoorLink
                    href="/admin/finance/payment-captures"
                    label="Payment proofs"
                    hint={cashTruncated
                        ? 'The inbox of screenshots and cash entries — more than shown here'
                        : 'The inbox of screenshots and cash entries'}
                    count={cashUnknown ? null : cashToEnter}
                />
                <DoorLink
                    href="/admin/finance/to-do"
                    label="What is unfinished"
                    hint="Payments the bank has not confirmed, cash to enter"
                />
                <DoorLink
                    href="/admin/finance/banks"
                    label="Bank accounts"
                    hint="The accounts on file"
                    count={accountCount}
                />
                <DoorLink
                    href="/admin/finance/zoho"
                    label="The full feed in Zoho"
                    hint="Every statement line, unfiltered"
                />
            </div>
        </div>
    );
}
