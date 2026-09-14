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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, HelpCircle, Plus } from 'lucide-react';
import RecordMoneyModal from '@/components/finance/RecordMoneyModal';
import { useAuth } from '@/lib/auth-context';
import type { Completeness, Gap, Holding, Severity } from '@/lib/completeness';

/**
 * The tint LAYER for a cell — painted over an opaque card, never instead of it.
 * Returns '' for ok, so a clean cell is simply the card.
 */
function toneWash(s: Severity): string {
    switch (s) {
        case 'bad': return 'bg-destructive/[0.07] group-hover:bg-destructive/[0.11]';
        case 'warn': return 'bg-amber-500/[0.09] group-hover:bg-amber-500/[0.14]';
        case 'ok': return 'group-hover:bg-emerald-500/[0.07]';
        default: return 'bg-muted-foreground/[0.07] group-hover:bg-muted-foreground/[0.12]';
    }
}

/** The severity bar down the left edge of a cell. */
function toneBar(s: Severity): string {
    switch (s) {
        case 'bad': return 'bg-destructive';
        case 'warn': return 'bg-amber-500';
        case 'ok': return 'bg-emerald-500/40';
        default: return 'bg-muted-foreground/30';
    }
}

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
    // A balance nobody has touched in six weeks is not the same fact as one
    // written up this morning, and it should not look like one.
    const stale = h.severity === 'bad' || h.severity === 'warn';
    // 2026-09-14: the staleness is now DRAWN as well as written. A sentence
    // saying "63d old" is read; a bar filling up is seen. Ninety days is the
    // full bar — past that the point is made and the length stops mattering.
    const agePct = h.daysStale === null ? null : Math.min(100, (h.daysStale / 90) * 100);
    return (
        <div
            className={`relative min-w-[8.5rem] flex-1 overflow-hidden rounded-lg border px-3.5 py-2.5 ${stale ? 'border-dashed bg-muted/40' : 'bg-background'
                }`}
        >
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.085em] text-muted-foreground" title={h.label}>
                {h.label}
            </p>
            <p className={`mt-1.5 text-[20px] font-bold leading-none tabular-nums tracking-[-0.02em] ${stale ? 'text-muted-foreground' : ''}`}>
                {h.value}
            </p>
            <div className="mt-2 flex items-center gap-2">
                {agePct !== null && (
                    <span className="h-[3px] w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                        <span
                            className={`block h-full rounded-full ${h.severity === 'bad' ? 'bg-destructive/55' : h.severity === 'warn' ? 'bg-amber-500/55' : 'bg-muted-foreground/35'}`}
                            style={{ width: `${Math.max(agePct, 4)}%` }}
                        />
                    </span>
                )}
                <StaleNote h={h} />
            </div>
        </div>
    );
}

function GapCell({ g }: { g: Gap }) {
    // A critical figure is bigger as well as redder. Size is the one signal
    // that survives being glanced at from across a desk.
    // 2026-09-14: the same rule, louder. A critical figure now steps up to
    // 29px against 20px, because at the old text-xl/text-lg the two were four
    // pixels apart and the distinction simply did not survive being glanced
    // at. Severity — never rank — decides this: the fourth-worst gap is not
    // quieter than the third just for being fourth, and dimming it to break
    // up "a wall of red" would be the page telling a comfortable lie.
    const size = g.severity === 'bad'
        ? 'text-[29px] leading-none tracking-[-0.03em]'
        : 'text-[20px] leading-none tracking-[-0.02em]';
    return (
        <Link
            href={g.href}
            className="group relative block bg-card py-3.5 pl-4 pr-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
            <span
                className={`pointer-events-none absolute inset-0 transition-colors ${toneWash(g.severity)}`}
                aria-hidden="true"
            />
            <span
                className={`absolute inset-y-0 left-0 w-[3px] ${toneBar(g.severity)}`}
                aria-hidden="true"
            />
            <div className="relative flex h-full flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.085em] text-muted-foreground">
                    {g.label}
                </p>
                <p className={`mt-auto font-bold tabular-nums ${size} ${toneText(g.severity)}`}>
                    {g.value}
                </p>
                <p className="text-[10.5px] leading-snug text-muted-foreground">{g.detail}</p>
            </div>
        </Link>
    );
}

export default function MissingRecordsStrip({ data }: { data: Completeness }) {
    const { holdings, gaps, openCount, failedCount } = data;
    const router = useRouter();
    const [recording, setRecording] = useState(false);
    // Only an admin can record money today (there is no finance role yet), and
    // the route refuses anyone else. Offering the button to the other fifteen
    // staff would open a modal that can never be used and says nothing.
    const { profile } = useAuth();
    const canRecord = profile?.role === 'admin';

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
        <div id="records" className="scroll-mt-20 overflow-hidden rounded-xl border bg-card">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b bg-zone-records/[0.07]">
                <span className="text-sm font-medium">On hand, and what is not written up</span>
                <div className="flex items-center gap-2">
                    {canRecord && (
                        <button
                            onClick={() => setRecording(true)}
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted"
                        >
                            <Plus className="h-3 w-3" /> Record cash / UPI
                        </button>
                    )}
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

            <RecordMoneyModal
                open={recording && canRecord}
                onClose={() => setRecording(false)}
                // The strip is server-rendered, so a fresh reading has to be
                // asked for — otherwise the balance the person just moved would
                // sit there unchanged and read as a failed save.
                onSaved={() => router.refresh()}
            />
        </div>
    );
}
