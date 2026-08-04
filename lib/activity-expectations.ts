// ─────────────────────────────────────────────────────────────
// "Did the work actually happen?"
//
// THE BUG CLASS THIS EXISTS FOR
// Create Dispatch was broken from the day it was written. 232 jobs went
// through the system and not one dispatch record was ever created. The
// schema was valid, the build was green, the pages rendered, every audit
// passed — because every audit asked "is the code correct?" and none
// asked "is anyone getting any work done?"
//
// The database had the answer in plain sight the entire time: a table
// with zero rows that should have had hundreds. Nobody was looking,
// because an empty table looks exactly like a quiet week.
//
// So this check does the one thing the others cannot: it knows what
// SHOULD be happening, and complains when it isn't.
//
// ── THE HARD PART: NOT CRYING WOLF ──
// Satish's business is real and uneven. Some weeks nothing is dispatched
// because nothing is ready. If this fires on a slow Tuesday, it gets
// muted, and then it is worth nothing on the day it matters.
//
// Two rules keep it honest:
//   1. Every expectation is CONDITIONAL. We never say "there should be
//      dispatches". We say "N jobs have been sitting at Ready for
//      Dispatch — so if nothing has dispatched in a week, something is
//      wrong." No jobs ready, no alert. Ever.
//   2. Windows are generous. Set them to the longest plausible quiet
//      period, not the average one. A late alert is useful; a false one
//      is worse than none.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Finding } from './health-checks';

export interface ActivityExpectation {
    /** Short name shown in the alert. */
    id: string;
    /** The table where evidence of the work appears. */
    table: string;
    /** Timestamp column that marks when the work happened. */
    since: string;
    /** How long we tolerate silence before it means something. */
    windowDays: number;
    /**
     * The precondition. Returns the number of things WAITING for this work
     * to happen. Zero means there was nothing to do, so silence is correct
     * and no finding is raised.
     */
    precondition: (db: SupabaseClient) => Promise<{ count: number; describe: string }>;
    /** What it means when the precondition holds but nothing happened. */
    meaning: string;
}

/** Count rows matching a filter, cheaply. */
async function countWhere(
    db: SupabaseClient,
    table: string,
    apply: (q: any) => any,
): Promise<number> {
    const { count, error } = await apply(db.from(table).select('id', { count: 'exact', head: true }));
    if (error) throw new Error(`${table}: ${error.message}`);
    return count || 0;
}

export const ACTIVITY_EXPECTATIONS: ActivityExpectation[] = [
    {
        id: 'dispatches-created',
        table: 'dispatches',
        since: 'created_at',
        windowDays: 7,
        precondition: async (db) => {
            const count = await countWhere(db, 'jobs', (q) => q.eq('current_stage', 'ready'));
            return { count, describe: `${count} job(s) sitting at Ready for Dispatch` };
        },
        meaning: 'Goods are ready to go out and none have. Either dispatch is not being used, or Create Dispatch is failing silently — which is exactly how it broke before.',
    },
    {
        id: 'jobs-progressed',
        table: 'job_stage_history',
        since: 'created_at',
        windowDays: 3,
        precondition: async (db) => {
            const count = await countWhere(db, 'jobs', (q) =>
                q.not('current_stage', 'in', '(delivered,completed,cancelled,file_sent_client)'));
            return { count, describe: `${count} job(s) still in the pipeline` };
        },
        meaning: 'Not one job has changed stage. The pipeline is frozen — either nobody is updating the board, or stage writes are failing.',
    },
    {
        id: 'jobs-created',
        table: 'jobs',
        since: 'created_at',
        windowDays: 14,
        precondition: async (db) => {
            const count = await countWhere(db, 'clients', (q) => q);
            return { count, describe: `${count} client(s) on the books` };
        },
        meaning: 'No new job has been created in a fortnight. Either work has genuinely stopped, or the New Order form is failing to save.',
    },
    {
        id: 'money-recorded',
        table: 'journal_entries',
        since: 'created_at',
        windowDays: 14,
        precondition: async (db) => {
            const count = await countWhere(db, 'jobs', (q) =>
                q.gt('total_amount', 0).in('current_stage', ['dispatched', 'delivered', 'completed']));
            return { count, describe: `${count} delivered job(s) carrying a value` };
        },
        meaning: 'Work has been delivered but nothing has hit the ledger. Payments or expenses are not being recorded.',
    },
    {
        id: 'pos-sales',
        table: 'pos_sales',
        since: 'created_at',
        windowDays: 10,
        precondition: async (db) => {
            const count = await countWhere(db, 'cmyk_clients', (q) => q);
            return { count, describe: `${count} CMYK client(s) on file` };
        },
        meaning: 'The CMYK counter has not rung up a single sale. Either the shop is shut, or the POS is not saving.',
    },
];

/**
 * Run every expectation. Silence where work was expected becomes a finding.
 *
 * Failures are reported, not swallowed — a check that cannot run is not a
 * check that passed, and that distinction is the whole reason this file exists.
 */
export async function checkExpectedActivity(db: SupabaseClient): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const exp of ACTIVITY_EXPECTATIONS) {
        try {
            const { count: waiting, describe } = await exp.precondition(db);
            if (waiting === 0) continue;          // nothing to do — silence is correct

            const cutoff = new Date(Date.now() - exp.windowDays * 86_400_000).toISOString();
            const happened = await countWhere(db, exp.table, (q) => q.gte(exp.since, cutoff));
            if (happened > 0) continue;           // work is flowing

            findings.push({
                severity: 'critical',
                check: 'expected-activity',
                summary: `Nothing recorded in ${exp.table} for ${exp.windowDays} days, but ${describe}`,
                detail: [exp.meaning, `Check: ${exp.id}`],
            });
        } catch (err: any) {
            findings.push({
                severity: 'warning',
                check: 'expected-activity',
                summary: `Could not check "${exp.id}" — so this one was NOT verified`,
                detail: [String(err?.message || err)],
            });
        }
    }

    return findings;
}
