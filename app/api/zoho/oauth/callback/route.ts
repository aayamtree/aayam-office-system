// GET /api/zoho/oauth/callback — finish connecting to Zoho Books.
//
// Zoho sends back a one-time code; we swap it for a refresh token server-side
// and store that in zoho_sync_config (service-role only). The refresh token is
// the long-lived credential, so it never goes near the browser or a log line.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import {
    ZOHO_ACCOUNTS,
    zohoCredentials,
    zohoServiceClient,
    setConfig,
    getAccessToken,
    getOrganizationId,
} from '@/lib/zoho-api';

export const dynamic = 'force-dynamic';

/** Land the user back on the Zoho page with a readable outcome. */
function back(message: string, ok: boolean) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aayam-office-system.vercel.app';
    const params = new URLSearchParams({ [ok ? 'connected' : 'error']: message });
    return NextResponse.redirect(`${base}/admin/finance/zoho?${params}`);
}

export async function GET(request: NextRequest) {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const code = request.nextUrl.searchParams.get('code');
    const denied = request.nextUrl.searchParams.get('error');
    if (denied) return back(`Zoho refused the connection: ${denied}`, false);
    if (!code) return back('Zoho did not send an authorisation code.', false);

    const creds = zohoCredentials();
    const supabase = zohoServiceClient();
    if (!creds || !supabase) return back('Server is not configured for Zoho yet.', false);

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://aayam-office-system.vercel.app'}/api/zoho/oauth/callback`;

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        code,
    });

    const res = await fetch(`${ZOHO_ACCOUNTS}/oauth/v2/token?${params}`, { method: 'POST' });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.refresh_token) {
        // Deliberately does not echo the response body — it can carry token material.
        console.error('[zoho/oauth] code exchange failed:', json?.error || res.status);
        return back(
            json?.error === 'invalid_client'
                ? 'Zoho rejected the client ID/secret. Check the Vercel environment variables.'
                : 'Could not complete the connection. Try again.',
            false
        );
    }

    await setConfig(supabase, 'refresh_token', json.refresh_token);
    await setConfig(supabase, 'connected_at', new Date().toISOString());

    // Resolve and cache the organization id straight away, so the first cron run
    // does not fail on a missing id at 2am with nobody watching.
    const accessToken = await getAccessToken(supabase);
    if (accessToken) await getOrganizationId(supabase, accessToken);

    return back('Zoho Books connected.', true);
}
