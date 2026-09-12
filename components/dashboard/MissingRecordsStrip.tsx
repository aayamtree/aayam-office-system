// ═══════════════════════════════════════════════════════════════════════════
// BAND B — MONEY ON HAND, AND WHAT IS NOT RECORDED
// ═══════════════════════════════════════════════════════════════════════════
//
// The band that exists because of one sentence from Satish (2026-09-12):
// "he maintains the accounts well but is unable to maintain them in our
// system." A system that never shows what is missing cannot be maintained.
//
// So this strip does not report performance. It reports the state of the
// RECORDS — and it is deliberately the second thing on the page, above the
// work and above the money, because every number below it is only as true as
// this strip is green.
//
// THREE RULES IT MUST KEEP
//   1. A balance and the date it was last true are ONE fact, never separated.
//      The Bank Accounts screen shows a total with no date, which reads as
//      today when the newest entry behind it is weeks old.
//   2. "Could not be checked" never looks like "nothing to do". Unknown cells
//      get a dashed border and say so in words — green is earned, not default.
//   3. Every cell opens the list behind it. A number you cannot act on is a
//      number that does not belong on a dashboard.
//
// All the counting lives in lib/completeness.ts. This file only draws.
// ═══════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, HelpCircle, Wallet } from 'lucide-react';
import type { Completeness, Gap, Holding, Severity } from '@/lib/completeness';

/** Text colour per severity. Unknown is muted — never green, never red. */
function toneText(s: Severity): string {
    switch (s) {
        case 'bad': return 'text-destructive';
        case 'warn': return 'text-amber-600 dark:text-amber-500';
        case 'ok': return 'text-emerald-600 dark:text-emerald-500';
        default: return 'text-muted-foreground';
    }
}

/** Meter block colour. Same scale as the text, so the two never disagree. */
function toneBlock(s: Severity): string {
    switch (s) {
        case 'bad': return 'bg-destructive';
        case 'warn': return 'bg-amber-500';
        case 'ok': return 'bg-emerald-500';
        default: return 'bg-muted-foreground/40';
    }
}

function StaleNote({ h }: { h: Holding }) {
    if (h.failed) return <span className="text-[10px] text-muted-foreground">date unknown</span>;
    if (h.asOf === null) return <span className="text-[10px] text-muted-foreground">never moved</span>;
    const dt = new Date(h.asOf);
    // Keep the year whenever it is not this one — "as on 3 Aug" on a balance
    // last moved in 2024 reads as three weeks old.
    const d = dt.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short',
        ...(dt.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    });
    const days = h.daysStale;
    return (
        <span className={`text-[10px] ${toneText(h.severity)}`}>
            as on {d}{days !== null && days > 0 ? ` · ${days}d old` : ''}
        </span>
    );
}

function HoldingTile({ h }: { h: Holding }) {
    return (
        <div className="min-w-[8.5rem] flex-1 rounded-md border bg-background px-3 py-2">
            <p className="text-[11px] text-muted-foreground truncate" title={h.label}>{h.label}</p>
            <p className="text-base font-semibold tabular-nums leading-tight mt-0.5">{h.value}</p>
            <StaleNote h={h} />
        </div>
    );
}

function GapCell({ g }: { g: Gap }) {
    return (
        <Link
            href={g.href}
            className={`block bg-card px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${g.failed ? 'bg-muted/40' : ''
                }`}
        >
            <p className="text-[11px] text-muted-foreground leading-tight">{g.label}</p>
            <p className={`text-lg font-semibold tabular-nums leading-tight mt-0.5 ${toneText(g.severity)}`}>
                {g.value}
            </p>
            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{g.detail}</p>
        </Link>
    );
}

export default function MissingRecordsStrip({ data }: { data: Completeness }) {
    const { holdings, gaps, openCount, failedCount } = data;

    // Nothing to draw at all means the whole fetch failed. Say that plainly
    // rather than rendering an empty card that looks like a clean bill.
    if (!gaps.length && !holdings.length) {
        return (
            <div className="rounded-md border border-dashed bg-card px-4 py-3">
                <p className="text-sm font-medium flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    Records check did not run
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    This is not the same as everything being up to date — reload, and tell
                    Satish if it keeps happening.
                </p>
            </div>
        );
    }

    // failedCount already includes holdings (see lib/completeness.ts), so a
    // balance tile reading "—" can never sit under a green all-clear line.
    const holdingsUnsure = holdings.some(h => h.failed || h.severity === 'unknown');
    const allClear = openCount === 0 && failedCount === 0 && !holdingsUnsure && gaps.length > 0;

    return (
        <div className="rounded-md border bg-card overflow-hidden">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b bg-muted/40">
                <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    <span className="text-sm font-medium">Money on hand &amp; what is not recorded</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-[2px]" aria-hidden="true">
                        {gaps.map(g => (
                            <span key={g.key} className={`block h-1.5 w-4 rounded-sm ${toneBlock(g.severity)}`} />
                        ))}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {allClear
                            ? 'all up to date'
                            : `${openCount} of ${gaps.length} need attention`}
                    </span>
                </div>
            </div>

            {/* ── what we hold, each stamped with the date it was last true ── */}
            {holdings.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 py-3 border-b">
                    {holdings.map(h => <HoldingTile key={h.key} h={h} />)}
                </div>
            )}

            {/* ── the gaps ── */}
            {gaps.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
                    {gaps.map(g => <GapCell key={g.key} g={g} />)}
                </div>
            )}

            {/* ── honesty footer: only ever shown when it has something to say ── */}
            {(failedCount > 0 || allClear) && (
                <div className="px-4 py-2 border-t">
                    {failedCount > 0 ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0" />
                            {failedCount} of these could not be checked just now — treat them as
                            unknown, not as clear.
                        </p>
                    ) : (
                        <p className="text-xs text-emerald-700 dark:text-emerald-500 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            Every record is written up. The figures below can be trusted.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
