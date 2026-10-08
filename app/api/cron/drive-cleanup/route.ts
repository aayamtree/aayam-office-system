// /api/cron/drive-cleanup — moves the old Google Drive copies of files already on the Pi to the Drive TRASH.
// Does nothing unless DRIVE_CLEANUP=on. Never permanently deletes (Drive keeps trash for 30 days).
import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/api-auth';
import { cleanupDriveBatch } from '@/lib/migrate-drive-to-pi';
import { logCronRun } from '@/lib/cron-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;
    if (process.env.DRIVE_CLEANUP !== 'on') return NextResponse.json({ skipped: 'DRIVE_CLEANUP is not on' });
    const started = Date.now();
    const r = await cleanupDriveBatch(200_000);
    await logCronRun('drive-cleanup', { ok: !r.note, durationMs: Date.now() - started, message: `trashed ${r.trashed}, already gone ${r.gone}, skipped ${r.skipped}, left ${r.left}` + (r.note ? ` — ${r.note}` : '') });
    return NextResponse.json(r);
}
