// /api/cron/migrate-drive — background move of files from Google Drive to the Pi.
// Runs every 5 minutes, but does nothing unless DRIVE_MIGRATION=on is set in Vercel.
// Never deletes anything from Google Drive. See lib/migrate-drive-to-pi.ts.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/api-auth';
import { migrateJobsBatch, migrateProductsBatch, migrationStatus } from '@/lib/migrate-drive-to-pi';
import { logCronRun } from '@/lib/cron-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;
    if (process.env.DRIVE_MIGRATION !== 'on') return NextResponse.json({ skipped: 'DRIVE_MIGRATION is not on' });

    const started = Date.now();
    const jobs = await migrateJobsBatch(200_000);
    let products = { moved: 0, failed: 0 };
    if (jobs.done) products = await migrateProductsBatch(40_000);
    const status = await migrationStatus();

    const message = `moved ${jobs.moved}, failed ${jobs.failed}${jobs.partial ? ', in progress ' + jobs.partial : ''}, left ${status.pending} (${status.pendingGB} GB)` + (jobs.note ? ` — ${jobs.note}` : '');
    await logCronRun('migrate-drive', { ok: !jobs.note, durationMs: Date.now() - started, message });
    return NextResponse.json({ jobs, products, status });
}
