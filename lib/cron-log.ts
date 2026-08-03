// lib/cron-log.ts — leave a trace that a scheduled job ran.
//
// Vercel knows whether a cron fired, but that knowledge lives in a dashboard
// nobody opens and /api/health cannot reach it. So a cron that quietly stopped
// firing was undetectable from inside the app: the 7:30pm EOD report or the
// morning digest would simply not arrive, and an absence is far harder to
// notice than a wrong number. This writes one row per run so the daily audit
// can assert "the digest has run in the last 50 hours" as a fact.
//
// Two rules this file follows, both learned the hard way:
//
//   1. Logging must never fail the job. If the insert throws, the cron still
//      returns its result. A broken logger causing a broken EOD report would be
//      a worse outage than the one it was added to prevent.
//   2. Failures are logged too, with ok:false. A cron that runs and throws every
//      night is not the same as one that never runs, and the difference is the
//      first thing you want to know at 8am.

import { createClient } from '@supabase/supabase-js';

function serviceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

/** Record a single run. Never throws. */
export async function logCronRun(
    job: string,
    opts: { ok?: boolean; durationMs?: number; message?: string } = {},
): Promise<void> {
    try {
        const db = serviceClient();
        if (!db) return;
        await db.from('cron_runs').insert({
            job,
            ok: opts.ok !== false,
            duration_ms: opts.durationMs ?? null,
            // Truncated: this column is for a human skimming an alert, not for
            // storing a stack trace.
            message: opts.message ? String(opts.message).slice(0, 500) : null,
        });
    } catch {
        // Deliberately silent — see rule 1 above.
    }
}

/**
 * Wrap a cron handler so every outcome is recorded, including a throw.
 *
 * Usage inside a route:
 *   return withCronLog('eod-report', async () => { ...; return NextResponse.json(x); });
 *
 * The error is re-thrown after logging so the route's own behaviour, and
 * Vercel's retry semantics, are unchanged.
 */
export async function withCronLog<T>(job: string, run: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
        const result = await run();
        await logCronRun(job, { ok: true, durationMs: Date.now() - started });
        return result;
    } catch (e: any) {
        await logCronRun(job, {
            ok: false,
            durationMs: Date.now() - started,
            message: e?.message || String(e),
        });
        throw e;
    }
}
