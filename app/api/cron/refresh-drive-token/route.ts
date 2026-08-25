// API Route: /api/cron/refresh-drive-token
// Background job to refresh the Google Drive token before it expires.
// Runs every 50 minutes via Vercel Cron. Refreshes in-process (no self-fetch).

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, getActiveCredential, refreshDriveToken } from '@/lib/google-drive-server';
import { withCronLog } from '@/lib/cron-log';

export const dynamic = 'force-dynamic';

async function runJob(request: NextRequest) {
    // Protect with CRON_SECRET so only Vercel cron (or authorized callers) can trigger.
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = getServiceClient();

        const credential = await getActiveCredential(supabase);
        if (!credential) {
            // Nothing connected — not an error worth failing the cron over.
            return NextResponse.json({ success: true, skipped: 'no active connection' });
        }

        const result = await refreshDriveToken(supabase, credential);

        if (!result.success) {
            console.error('❌ Cron: Token refresh failed:', result.error);
            return NextResponse.json(
                { success: false, error: result.error, needsReconnect: !!result.needsReconnect },
                { status: 500 }
            );
        }

        console.log('✅ Cron: Token refreshed successfully');
        return NextResponse.json({
            success: true,
            refreshed_at: new Date().toISOString(),
            expires_at: result.expiresAt,
        });
    } catch (error: unknown) {
        console.error('❌ Cron: Error:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

// Every run of this cron is recorded in public.cron_runs (see lib/cron-log.ts).
// Vercel knows whether the schedule fired, but that lives in a dashboard nobody
// opens; the daily audit needs the fact inside the database so it can alert when
// this job silently stops running.
export async function GET(request: NextRequest) {
    return withCronLog('refresh-drive-token', () => runJob(request));
}
