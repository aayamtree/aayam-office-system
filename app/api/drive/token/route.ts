// API Route: /api/drive/token
// Returns a currently-valid organization Drive access token for uploads.
// Refreshing happens in-process against Google (no self-HTTP-fetch).

import { NextResponse } from 'next/server';
import { getServiceClient, getValidDriveAccessToken } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
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
