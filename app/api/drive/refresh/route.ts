// API Route: /api/drive/refresh
// Forces a refresh of the active Google Drive access token using the stored
// refresh token. Refresh happens in-process against Google.

import { NextResponse } from 'next/server';
import { getServiceClient, getActiveCredential, refreshDriveToken } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const supabase = getServiceClient();

        const credential = await getActiveCredential(supabase);
        if (!credential) {
            return NextResponse.json({ error: 'No active credentials found' }, { status: 404 });
        }

        const result = await refreshDriveToken(supabase, credential);

        if (!result.success) {
            const status = result.needsReconnect ? 400 : 500;
            return NextResponse.json(
                { error: result.error, needsReconnect: !!result.needsReconnect },
                { status }
            );
        }

        return NextResponse.json({
            success: true,
            access_token: result.accessToken,
            expires_at: result.expiresAt,
        });
    } catch (error: any) {
        console.error('Token refresh error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
