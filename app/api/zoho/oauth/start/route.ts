// GET /api/zoho/oauth/start — begin connecting the app to Zoho Books.
//
// Admin-only. Sends the browser to Zoho's consent screen; Satish approves there
// and Zoho redirects back to /api/zoho/oauth/callback with a one-time code.
// Nothing secret passes through the browser: the client secret is only ever
// used server-side in the callback exchange.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { ZOHO_ACCOUNTS, ZOHO_SCOPES, zohoCredentials } from '@/lib/zoho-api';

export const dynamic = 'force-dynamic';

export async function GET() {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const creds = zohoCredentials();
    if (!creds) {
        return NextResponse.json(
            {
                error:
                    'ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET are not set in the environment. ' +
                    'Add them in Vercel → Project Settings → Environment Variables, then redeploy.',
            },
            { status: 500 }
        );
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://aayam-office-system.vercel.app'}/api/zoho/oauth/callback`;

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: creds.clientId,
        scope: ZOHO_SCOPES,
        redirect_uri: redirectUri,
        // offline + consent is what makes Zoho hand back a REFRESH token rather
        // than only a one-hour access token. Without these the cron dies in an hour.
        access_type: 'offline',
        prompt: 'consent',
    });

    return NextResponse.redirect(`${ZOHO_ACCOUNTS}/oauth/v2/auth?${params}`);
}
