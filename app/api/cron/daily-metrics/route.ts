// GET /api/cron/daily-metrics — store today's dashboard headline figures.
//
// WHY THIS RUNS AT 05:30 UTC (11:00 IST)
// After zoho-invoice-sync (03:00), zoho-bank-sync (04:30) and
// reconcile-payment-captures (05:00), so the figures it stores are the fresh
// ones rather than yesterday's. A consistent time of day matters more than the
// exact hour: a trend is only readable if every point was taken at the same
// moment in the working day.
//
// WHAT IT IS FOR
// Arrows beside the numbers. Nothing recorded yesterday's figure, so no arrow
// could be honest. See lib/daily-metrics.ts for why this shipped before the
// drawing did.
//
// SAFETY
//  - Writes exactly one row, to one table nothing else reads yet.
//  - Idempotent: the primary key is the date and the write is an upsert, so a
//    re-run overwrites today rather than doubling it.
//  - Defines nothing. Every figure comes from lib/completeness.ts and
//    lib/receivables.ts, the definitions the dashboard itself uses.
//  - Never touches jobs, Zoho, the ledger or the capture inbox.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron } from '@/lib/api-auth';
import { withCronLog } from '@/lib/cron-log';
import { captureDailyMetrics } from '@/lib/daily-metrics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    return withCronLog('daily-metrics', async () => {
        const { captured, error } = await captureDailyMetrics(db);

        if (error) {
            // A failed write is a lost day of history, so it is reported as a
            // failure rather than swallowed — withCronLog records it and the
            // watchman can see it.
            throw new Error(`daily metrics not stored: ${error}`);
        }

        return NextResponse.json({
            ok: true,
            captured_on: captured.captured_on,
            was_blind: captured.was_blind,
            live_jobs: captured.live_jobs,
            past_deadline: captured.past_deadline,
            owed_amount: captured.owed_amount,
            books_behind_days: captured.books_behind_days,
            gaps_open: captured.gaps_open,
        });
    });
}
