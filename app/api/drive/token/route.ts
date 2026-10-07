// API Route: /api/drive/token
// Returns a currently-valid organization Drive access token for uploads.
// Refreshing happens in-process against Google (no self-HTTP-fetch).

import { NextResponse } from 'next/server';
import { getServiceClient, getValidDriveAccessToken } from '@/lib/google-drive-server';
import { isServiceAccountConfigured, getServiceAccountToken } from '@/lib/google-service-account';
import { requireUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

async function getDriveToken() {
    // This hands out a live org-wide Google Drive token — staff only.
    const gate = await requireUser();
    if (!gate.ok) return gate.response;

    try {
        // Preferred: service account (no interactive login, files land in the Shared Drive).
        if (isServiceAccountConfigured()) {
            const sa = await getServiceAccountToken();
            if (sa.success) {
                return NextResponse.json({ accessToken: sa.accessToken, mode: 'service_account' });
            }
            return NextResponse.json({ error: sa.error || 'Service account token failed' }, { status: 503 });
        }

        // Fallback: the older OAuth "connect Google Drive" flow.
        const supabase = getServiceClient();
        const result = await getValidDriveAccessToken(supabase);

        if (!result.success) {
            // 401 only when the admin genuinely must reconnect; otherwise 503 (transient).
            const status = result.needsReconnect ? 401 : 503;
            return NextResponse.json({ error: result.error, needsReconnect: !!result.needsReconnect }, { status });
        }

        return NextResponse.json({ accessToken: result.accessToken });
    } catch (error: any) {
        console.error('Token fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * In Pi-storage mode (NEXT_PUBLIC_STORAGE_BACKEND=seafile) uploads no longer need a
 * Google token. The real Google token is still returned when available (the
 * Calendar feature uses it); if Google is unavailable we answer with a placeholder
 * so file uploads to the Pi are never blocked by a Google problem.
 */
export async function GET() {
    const res = await getDriveToken();
    if (process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'seafile' && !res.ok) {
        const gate = await requireUser(); // only for logged-in staff
        if (gate.ok) return NextResponse.json({ accessToken: 'pi-storage', mode: 'pi' });
    }
    return res;
}
