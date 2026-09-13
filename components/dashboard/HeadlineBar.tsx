// ═══════════════════════════════════════════════════════════════════════════
// BAND A — WHERE WE ARE, IN ONE LINE
// ═══════════════════════════════════════════════════════════════════════════
//
// Satish, seeing the page rendered for the first time (13 Sept): "it looks
// flat... Today's Summary is contrast black but it is shown if you scroll
// down, so it makes no sense."
//
// He was right, and the diagnosis is worth writing down. The only strong ink
// on the whole dashboard was a black card two-thirds of the way down, carrying
// New Orders / Dispatched / Design Pending / Overdue — four figures that all
// appeared elsewhere on the same page. The loudest element was spent on the
// least important content, below the fold, which is worse than no contrast at
// all: it teaches the eye to land in the wrong place. So the contrast moved
// here, and Today's Summary was retired.
//
// RULES THIS BAR KEEPS
//   · Five figures, hard limit. A sixth would make it a dashboard of its own.
//   · Every figure links to the list behind it — a real list, not this page.
//   · A figure that could not be read prints an em dash. NEVER a zero: zero is
//     an achievement, unknown is not, and they must never look alike.
//   · Severity is carried UP from the gap it came from, never re-decided here.
//     The bank feed turns red at 7 days and the bills at 14; a threshold of
//     this bar's own would put it in visible disagreement with the strip
//     forty pixels below.
// ═══════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export type HeadlineSeverity = 'ok' | 'warn' | 'bad' | 'unknown';

export interface Headline {
    liveJobs: number | null;
    pastDeadline: number | null;
    owed: number | null;
    owedInvoices: number;
    booksBehindDays: number | 'never' | null;
    booksSeverity: HeadlineSeverity;
    gapsOpen: number | null;
    owedSyncAgeDays: number | null;
}

/** Lakh / crore, because that is how the number gets said out loud here. */
function inrShort(n: number): string {
    const neg = n < 0 ? '-' : '';
    const v = Math.abs(n);
    if (v >= 10_000_000) return `${neg}₹${(v / 10_000_000).toFixed(2)}cr`;
    // 99.95L would round to "100.0L", which is a crore written the long way.
    if (v >= 99_950_0) return `${neg}₹${(v / 10_000_000).toFixed(2)}cr`;
    if (v >= 100_000) return `${neg}₹${(v / 100_000).toFixed(1)}L`;
    return `${neg}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v)}`;
}

function Figure({
    value, label, href, tone = 'ok', title, unknown = false,
}: {
    value: string; label: string; href: string;
    tone?: HeadlineSeverity; title?: string; unknown?: boolean;
}) {
    const valueTone = unknown
        ? 'text-white/45'
        : tone === 'bad' ? 'text-[#FF8A73]'
            : tone === 'warn' ? 'text-[#F5C05A]'
                : 'text-white';
    return (
        <Link
            href={href}
            title={title}
            // shrink-0 so a figure is never clipped by the row; the row wraps
            // instead. No separator glyphs — a floating "·" at the start of a
            // wrapped line reads as a mistake, and spacing separates just as
            // well. (audit 9)
            className="group flex shrink-0 items-baseline gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
            <span className={`font-mono text-xl font-semibold leading-none tabular-nums tracking-tight sm:text-2xl ${valueTone}`}>
                {value}
            </span>
            <span className="text-[11px] leading-tight text-white/60 group-hover:text-white/85 sm:text-xs">
                {label}
            </span>
        </Link>
    );
}

export default function HeadlineBar({ data }: { data: Headline }) {
    const {
        liveJobs, pastDeadline, owed, owedInvoices,
        booksBehindDays, booksSeverity, gapsOpen, owedSyncAgeDays,
    } = data;

    const lateTone: HeadlineSeverity =
        pastDeadline === null ? 'unknown' : pastDeadline === 0 ? 'ok' : pastDeadline > 5 ? 'bad' : 'warn';
    const gapsTone: HeadlineSeverity =
        gapsOpen === null ? 'unknown' : gapsOpen === 0 ? 'ok' : gapsOpen > 3 ? 'bad' : 'warn';

    const booksValue =
        booksBehindDays === null ? '—'
            : booksBehindDays === 'never' ? 'never'
                : `${booksBehindDays}d`;

    // Zoho is the book of record and it syncs on a webhook. A figure taken
    // from a sync that stalled is the one lie this bar could still tell, so
    // the age travels with the number. lib/receivables.ts sets the same bar
    // at two days for the Telegram brief.
    const owedStale = owedSyncAgeDays !== null && owedSyncAgeDays >= 2;
    const blind = liveJobs === null && owed === null && gapsOpen === null;

    return (
        <div className="overflow-hidden rounded-lg bg-[#17181A] shadow-sm ring-1 ring-black/20 dark:bg-[#0A0B0C] dark:ring-white/10">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-3 sm:px-3">
                <Figure
                    value={liveJobs === null ? '—' : String(liveJobs)}
                    label="jobs live"
                    href="/admin/jobs/queue"
                    unknown={liveJobs === null}
                    title="Jobs still in production"
                />
                <Figure
                    value={pastDeadline === null ? '—' : String(pastDeadline)}
                    label="past deadline"
                    href="/admin/jobs/overdue"
                    tone={lateTone}
                    unknown={pastDeadline === null}
                    title="Live jobs whose client deadline has passed"
                />
                <Figure
                    value={owed === null ? '—' : inrShort(owed)}
                    label={owed === null ? 'owed' : `owed · ${owedInvoices} invoice${owedInvoices === 1 ? '' : 's'}`}
                    href="/admin/finance/money-in"
                    unknown={owed === null}
                    title={owed === null
                        ? 'Zoho could not be read just now. This is not zero.'
                        : 'Open invoices in Zoho'}
                />
                <Figure
                    value={booksValue}
                    label="books behind"
                    href="/admin/finance/to-do"
                    tone={booksSeverity}
                    unknown={booksBehindDays === null}
                    title="The oldest gap in the records — books are only as current as the thing that stopped first"
                />
                <Figure
                    value={gapsOpen === null ? '—' : String(gapsOpen)}
                    label="records to fix"
                    href="#records"
                    tone={gapsTone}
                    unknown={gapsOpen === null}
                    title="Open items in the records strip below"
                />
            </div>

            {/* One quiet line of consequence, only when there is one to state. */}
            {(blind || owedStale || booksSeverity === 'bad' || gapsTone === 'bad') && (
                <div className="flex items-start gap-1.5 border-t border-white/10 bg-white/[0.03] px-3 py-1.5">
                    <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-[#F5C05A]" />
                    <p className="text-[11px] leading-snug text-white/60">
                        {blind
                            ? 'The app could not read the records just now — these are unknown, not clear.'
                            : owedStale
                                ? `Zoho last synced ${owedSyncAgeDays} days ago, so the amount owed may have moved.`
                                : 'Money figures below are only as true as the records above them.'}
                    </p>
                </div>
            )}
        </div>
    );
}
