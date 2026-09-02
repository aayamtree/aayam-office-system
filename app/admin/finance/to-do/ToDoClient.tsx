'use client';

import Link from 'next/link';
import {
    DoorHeader, DoorLink, DoorSection, Figure, rupees,
} from '@/components/finance/Door';
import { counterparty, type FinanceTodo, LOOKBACK_DAYS, STALE_DAYS } from '@/lib/finance-todo';
import { AlertTriangle, Info } from 'lucide-react';

const day = (d: string | null) =>
    !d ? 'no date' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

/**
 * An empty list means one of two opposite things, and they must never look
 * alike: nothing is outstanding (good news, green), or the query failed and we
 * have no idea (not news at all, grey). The audit found all four tiles turning
 * green off unread queries — the strongest reassurance on the page, driven by
 * nothing.
 */
function tileTone(failed: boolean, count: number): 'plain' | 'good' | 'warn' {
    if (failed) return 'plain';
    return count > 0 ? 'warn' : 'good';
}
const tileValue = (failed: boolean, count: number, plus: boolean) =>
    failed ? '—' : `${count}${plus ? '+' : ''}`;

function Empty({ failed, children }: { failed: boolean; children: React.ReactNode }) {
    if (failed) {
        return (
            <p className="px-3.5 py-5 text-sm text-muted-foreground text-center">
                This list could not be read, so it is showing nothing — which is
                <b className="text-foreground"> not</b> the same as there being nothing.
            </p>
        );
    }
    return <p className="px-3.5 py-5 text-sm text-muted-foreground text-center">{children}</p>;
}

function Row({
    left, right, sub,
}: { left: React.ReactNode; right: React.ReactNode; sub?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 px-3.5 py-2.5 border-t border-border">
            <div className="min-w-0">
                <div className="text-sm truncate">{left}</div>
                {sub ? <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div> : null}
            </div>
            <div className="text-sm font-medium tabular-nums whitespace-nowrap">{right}</div>
        </div>
    );
}

/** Said in the section itself, not only as a "+" on a tile above it. */
function MoreThanShown({ children }: { children: React.ReactNode }) {
    return (
        <p className="px-3.5 py-2 text-[11px] text-amber-700 dark:text-amber-400 border-t border-border">
            {children}
        </p>
    );
}

export default function ToDoClient({ todo }: { todo: FinanceTodo }) {
    const {
        awaitingBankConfirmation, dateless, unannouncedOutflows, cashToEnter,
        feedThrough, feedReadFailed, feedBlind, truncated, failed, errors,
    } = todo;

    const anyFailed = failed.stale || failed.dateless || failed.outflows || failed.cash;
    const total =
        awaitingBankConfirmation.length + dateless.length +
        unannouncedOutflows.length + cashToEnter.length;

    const OUTFLOWS_SHOWN = 40;

    return (
        <div className="space-y-4">
            <DoorHeader
                title="To Do"
                question="Payments to chase, receipts to check, cash to enter."
                source="The same four lists the nightly message sends to Telegram — read from one place, so the two can never disagree."
            />

            {/* A list that could not be read is not an empty list. */}
            {errors.length > 0 && (
                <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-300 flex gap-2.5">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
                    <div>
                        <p className="font-semibold mb-0.5">
                            {errors.length === 1 ? 'One list' : `${errors.length} lists`} could not be read.
                        </p>
                        <p>Anything showing a dash below did not load. It is not empty — it is unknown.</p>
                        <ul className="mt-1 font-mono text-[10px] opacity-70 space-y-0.5">
                            {errors.map((e) => <li key={e}>{e}</li>)}
                        </ul>
                    </div>
                </div>
            )}

            {feedReadFailed && (
                <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-300">
                    <b>The bank check could not run.</b> No payment was checked against the statement.
                    This is not a clean bill of health — it is a check that did not happen.
                </div>
            )}

            {feedBlind && (
                <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
                    {feedThrough ? (
                        <>
                            <b>The bank statement is {LOOKBACK_DAYS}+ days behind.</b> The newest line in the
                            feed is {feedThrough}. Until a newer statement is uploaded to Zoho, nothing can be
                            confirmed and this check cannot tell a failed payment from an unrecorded one — so it
                            reports nothing rather than a reassuring zero.
                        </>
                    ) : (
                        <>
                            <b>No bank statement data at all.</b> The feed is empty, so this check is blind.
                            Upload a statement to Zoho, or check the Zoho connection.
                        </>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <Figure
                    label="Bank has not confirmed"
                    value={tileValue(failed.stale, awaitingBankConfirmation.length, truncated.stale)}
                    note={failed.stale ? 'could not be checked' : 'a receipt with no matching bank line'}
                    tone={tileTone(failed.stale, awaitingBankConfirmation.length)}
                />
                <Figure
                    label="No readable date"
                    value={tileValue(failed.dateless, dateless.length, truncated.dateless)}
                    note={failed.dateless ? 'could not be read' : 'cannot be checked at all'}
                    tone={tileTone(failed.dateless, dateless.length)}
                />
                <Figure
                    label="Left the bank, no proof"
                    value={tileValue(failed.outflows, unannouncedOutflows.length, truncated.outflows)}
                    note={failed.outflows ? 'incomplete — see below' : 'nobody posted a screenshot'}
                    tone={tileTone(failed.outflows, unannouncedOutflows.length)}
                />
                <Figure
                    label="Cash to enter in Zoho"
                    value={tileValue(failed.cash, cashToEnter.length, truncated.cash)}
                    note={failed.cash ? 'could not be read' : 'type it in, then tick it off'}
                    tone={tileTone(failed.cash, cashToEnter.length)}
                />
            </div>

            {/* All clear only when every list actually reported. */}
            {total === 0 && !anyFailed && errors.length === 0 && !feedReadFailed && !feedBlind && (
                <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-xs text-emerald-900 dark:text-emerald-300 flex gap-2">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <span>
                        Nothing outstanding. Every screenshot has a matching bank line, every bank outflow has
                        a screenshot, and no cash is waiting to be entered.
                    </span>
                </div>
            )}

            {/* ── 1 ── */}
            <DoorSection
                title="The bank has not confirmed these"
                note={
                    feedThrough
                        ? `A screenshot was shared, and the feed now carries a line dated ${feedThrough} with no sign of it. An accepted request can still fail.`
                        : `A screenshot was shared and no matching bank line has appeared.`
                }
            >
                {awaitingBankConfirmation.length === 0 ? (
                    <Empty failed={failed.stale}>Nothing waiting on the bank.</Empty>
                ) : (
                    <>
                        {awaitingBankConfirmation.map((c) => (
                            <Row
                                key={c.id}
                                left={<>{c.direction === 'in' ? 'from' : 'to'} <b>{counterparty(c)}</b></>}
                                sub={
                                    <>
                                        {day(c.txn_date)}
                                        {c.gateway_status ? ` · the receipt said "${c.gateway_status}"` : ''}
                                    </>
                                }
                                right={rupees(Number(c.amount) || 0)}
                            />
                        ))}
                        {truncated.stale && (
                            <MoreThanShown>
                                This list is full at {awaitingBankConfirmation.length}. There are almost
                                certainly more that are not shown.
                            </MoreThanShown>
                        )}
                    </>
                )}
            </DoorSection>

            {/* ── 2 ── */}
            <DoorSection
                title="The date could not be read"
                note={`Nothing can check these against the statement — not even to say they are fine. Open the screenshot and set the date, or mark it as cash. Listed once ${STALE_DAYS} days have passed since it was posted.`}
            >
                {dateless.length === 0 ? (
                    <Empty failed={failed.dateless}>Every receipt has a readable date.</Empty>
                ) : (
                    <>
                        {dateless.map((c) => (
                            <Row
                                key={c.id}
                                left={<>{c.direction === 'in' ? 'from' : 'to'} <b>{counterparty(c)}</b></>}
                                sub={<>posted {String(c.created_at).slice(0, 10)}</>}
                                right={rupees(Number(c.amount) || 0)}
                            />
                        ))}
                        {truncated.dateless && (
                            <MoreThanShown>
                                This list is full at {dateless.length}. There are almost certainly more.
                            </MoreThanShown>
                        )}
                    </>
                )}
            </DoorSection>

            {/* ── 3 ── */}
            <DoorSection
                title="Money left the bank with no screenshot"
                note={`Out of the account in the last ${LOOKBACK_DAYS} days, with no proof posted in the payments group.`}
            >
                {unannouncedOutflows.length === 0 ? (
                    <Empty failed={failed.outflows}>Every outgoing payment has a proof against it.</Empty>
                ) : (
                    <>
                        {unannouncedOutflows.slice(0, OUTFLOWS_SHOWN).map((t) => (
                            <Row
                                key={t.id}
                                left={<b>{t.payee || t.description || 'no payee recorded'}</b>}
                                sub={day(t.txn_date)}
                                right={rupees(Number(t.amount) || 0)}
                            />
                        ))}
                        {/* Each of these is a different kind of incompleteness and
                            they can occur together, so each says its own sentence
                            and the block only appears when there is one to say. */}
                        {(unannouncedOutflows.length > OUTFLOWS_SHOWN || truncated.outflows || truncated.claimed) && (
                            <MoreThanShown>
                                {unannouncedOutflows.length > OUTFLOWS_SHOWN && (
                                    <>Showing {OUTFLOWS_SHOWN} of {unannouncedOutflows.length}. </>
                                )}
                                {truncated.outflows && (
                                    <>Only the most recent {LOOKBACK_DAYS} days&rsquo; worth of bank lines were
                                    examined, up to the limit — older unannounced payments may exist. </>
                                )}
                                {truncated.claimed && (
                                    <>The list of already-matched payments could not be read in full, so some
                                    of these may in fact have proof.</>
                                )}
                            </MoreThanShown>
                        )}
                    </>
                )}
            </DoorSection>

            {/* ── 4 ── */}
            <DoorSection
                title="Cash still to enter in Zoho"
                note="Paid in cash or outside the bank account, so no statement line will ever confirm them. Enter each one in Zoho, then tick it off in Payment Proofs."
                right={
                    <Link
                        href="/admin/finance/payment-captures"
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        Tick them off →
                    </Link>
                }
            >
                {cashToEnter.length === 0 ? (
                    <Empty failed={failed.cash}>No cash waiting to be entered.</Empty>
                ) : (
                    <>
                        {cashToEnter.map((c) => (
                            <Row
                                key={c.id}
                                left={<>{c.direction === 'in' ? 'from' : 'to'} <b>{counterparty(c)}</b></>}
                                sub={
                                    <>
                                        {day(c.txn_date)}
                                        {c.payment_method ? ` · ${c.payment_method}` : ''}
                                    </>
                                }
                                right={rupees(Number(c.amount) || 0)}
                            />
                        ))}
                        {truncated.cash && (
                            <MoreThanShown>
                                This list is full at {cashToEnter.length}. Payment Proofs counts them all —
                                open it for the true number.
                            </MoreThanShown>
                        )}
                    </>
                )}
            </DoorSection>

            <div className="grid sm:grid-cols-3 gap-2.5">
                <DoorLink
                    href="/admin/finance/payment-captures"
                    label="Payment proofs"
                    hint="Where each of these is actually resolved"
                />
                <DoorLink
                    href="/admin/finance/bank-cash"
                    label="Bank & Cash"
                    hint="The statement these are checked against"
                />
                <DoorLink
                    href="/admin/finance/money-in"
                    label="Money In"
                    hint="Customers to chase for payment"
                />
            </div>
        </div>
    );
}
