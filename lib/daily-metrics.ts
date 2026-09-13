// ═══════════════════════════════════════════════════════════════════════════
// ONE ROW A DAY — so the numbers can grow a trend
// ═══════════════════════════════════════════════════════════════════════════
//
// Satish, 2026-09-13: "we can show a graph or arrow beside that number, because
// those icons are easier to read — up or down, good or bad."
//
// He is right, and it could not be built: nothing recorded yesterday's number.
// `table_row_snapshots` has run nightly since 1 August, but it counts ROWS PER
// TABLE — it can say how many jobs exist, never how many were past deadline or
// how much was owed. So an arrow would have had to be guessed, which is the
// confident-wrong-number shape this project keeps paying for.
//
// This file writes the history instead. The arrows come later, when there is
// something true to point at. Every day it is not running is a day that cannot
// be recovered, which is why the logging shipped before the drawing.
//
// TWO RULES
//  1. IT DEFINES NOTHING. Every figure comes from the definition that already
//     owns it — lib/completeness.ts and lib/receivables.ts. A second definition
//     here would drift from the dashboard within a month, and a chart that
//     disagrees with the number above it is worse than no chart.
//  2. NULL MEANS UNKNOWN, NEVER ZERO. A blind capture records was_blind and
//     leaves the figures null, so a future chart draws a gap rather than a
//     cliff to zero that never happened.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCompleteness } from './completeness';
import { getReceivables } from './receivables';
import { TERMINAL_STAGES } from './job-workflow';

export interface DailyCapture {
    captured_on: string;
    was_blind: boolean;
    live_jobs: number | null;
    past_deadline: number | null;
    owed_amount: number | null;
    owed_invoices: number | null;
    books_behind_days: number | null;
    books_never_started: boolean;
    gaps_open: number | null;
    uncategorised_spend: number | null;
    bills_behind_days: number | null;
    feed_behind_days: number | null;
    ownbook_behind_days: number | null;
    unpriced_jobs: number | null;
    receipts_pending: number | null;
    note: string | null;
}

/** Today in IST, as a plain date. The office day, not UTC's. */
function todayIST(): string {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 - now.getTimezoneOffset()) * 60_000);
    return ist.toISOString().slice(0, 10);
}

/**
 * The count behind a gap, as a number.
 *
 * ⚠ A CLEAN GAP READS AS A WORD, NOT A DIGIT. "all categorised", "all priced",
 * "all matched" — parsing those for digits yields nothing, and storing null
 * would file the best possible day as UNKNOWN. The chart would then show a hole
 * exactly where the good news is. So an `ok` gap is zero, explicitly, before
 * any parsing is attempted.
 */
function countFrom(g: { value: string; severity: string } | undefined): number | null {
    if (!g) return null;
    if (g.severity === 'ok') return 0;
    const digits = g.value.replace(/[^0-9.]/g, '');
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
}

/**
 * Take today's reading and store it.
 *
 * Idempotent by design: the primary key is the date and the write is an upsert,
 * so running twice in one day overwrites rather than doubling. The cron is
 * scheduled after the Zoho syncs so the figures it stores are the fresh ones.
 */
export async function captureDailyMetrics(
    db: SupabaseClient,
): Promise<{ captured: DailyCapture; error: string | null }> {
    const capturedOn = todayIST();

    const completeness = await fetchCompleteness(db, TERMINAL_STAGES);
    const receivables = await getReceivables(db)
        .then(r => ({ owed: r.totalOwed as number | null, invoices: r.invoiceCount as number | null }))
        .catch(() => ({ owed: null, invoices: null }));

    const gap = (key: string) => completeness.gaps.find(g => g.key === key);
    const readable = (key: string) => {
        const g = gap(key);
        return g && !g.failed ? g : undefined;
    };

    // Live jobs and past-deadline are counted here rather than imported from
    // lib/dashboard-data.ts, because that module assembles a whole page. The
    // FILTER is the shared part and it comes from TERMINAL_STAGES either way.
    const jobsRes = await db
        .from('jobs')
        .select('current_stage, client_deadline')
        .not('current_stage', 'in', `(${TERMINAL_STAGES.map(s => `"${s}"`).join(',')})`)
        .limit(5000);

    const today = capturedOn;
    const jobsReadable = !jobsRes.error && !completeness.blind;
    const rows = jobsRes.data || [];

    const capture: DailyCapture = {
        captured_on: capturedOn,
        was_blind: completeness.blind,
        live_jobs: jobsReadable ? rows.length : null,
        past_deadline: jobsReadable
            ? rows.filter(j => j.client_deadline && (j.client_deadline as string) < today).length
            : null,
        owed_amount: completeness.blind ? null : receivables.owed,
        owed_invoices: completeness.blind ? null : receivables.invoices,
        books_behind_days: typeof completeness.worstDaysBehind === 'number'
            ? completeness.worstDaysBehind
            : null,
        books_never_started: completeness.worstDaysBehind === 'never',
        gaps_open: completeness.blind ? null : completeness.openCount,

        uncategorised_spend: countFrom(readable('uncategorised')),
        bills_behind_days: readable('bills')?.days ?? null,
        feed_behind_days: readable('feed')?.days ?? null,
        ownbook_behind_days: readable('ownbook')?.days ?? null,
        unpriced_jobs: countFrom(readable('unpriced')),
        receipts_pending: countFrom(readable('captures')),

        note: completeness.blind
            ? 'blind capture — the database could not be read'
            : jobsRes.error
                ? `jobs unreadable: ${jobsRes.error.message}`
                : null,
    };

    const { error } = await db
        .from('dashboard_daily_metrics')
        .upsert(capture, { onConflict: 'captured_on' });

    return { captured: capture, error: error ? error.message : null };
}
