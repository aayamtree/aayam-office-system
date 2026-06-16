/**
 * Server-side Google Drive credential helpers (org-wide, single admin connection).
 *
 * Why this file exists:
 *  - Previously the token route + cron refreshed the access token by doing an
 *    HTTP fetch to the app's own /api/drive/refresh endpoint. That extra hop
 *    depends on NEXT_PUBLIC_APP_URL matching the live deployment exactly and
 *    silently fails otherwise -> token stays expired -> admin is asked to
 *    "reconnect". We refresh against Google directly instead.
 *  - Status/token reads used .single(), which THROWS when there are 0 or >1
 *    active rows (a transient state during reconnect). That made the UI flash
 *    "Not Connected" and push the admin into a re-login loop. We read the
 *    newest active row defensively instead.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Refresh slightly before actual expiry to avoid edge-of-expiry failures.
const EXPIRY_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export interface DriveCredential {
    id: string;
    access_token: string;
    refresh_token: string | null;
    token_expiry: string;
    scopes: string | null;
    is_active: boolean;
    connected_at?: string | null;
}

/** Service-role client (bypasses RLS — app auth is NextAuth, not Supabase auth). */
export function getServiceClient(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

/**
 * Return the newest active credential, or null. Never throws on row count
 * (unlike .single()), so a transient 0/2-row state can't break the UI.
 */
export async function getActiveCredential(
    supabase: SupabaseClient
): Promise<DriveCredential | null> {
    const { data, error } = await supabase
        .from('google_drive_credentials')
        .select('id, access_token, refresh_token, token_expiry, scopes, is_active, connected_at')
        .eq('is_active', true)
        .order('connected_at', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0] as DriveCredential;
}

function isExpiringSoon(tokenExpiry: string): boolean {
    return new Date(tokenExpiry).getTime() - EXPIRY_SKEW_MS < Date.now();
}

export interface RefreshResult {
    success: boolean;
    accessToken?: string;
    expiresAt?: string;
    /** true when Google reports the refresh token is dead and admin must reconnect */
    needsReconnect?: boolean;
    error?: string;
}

/**
 * Refresh the access token directly against Google and persist it.
 * On invalid_grant (refresh token revoked/expired) the credential is marked
 * inactive and needsReconnect is set so callers can surface a clear message.
 */
export async function refreshDriveToken(
    supabase: SupabaseClient,
    credential: DriveCredential
): Promise<RefreshResult> {
    if (!credential.refresh_token) {
        return {
            success: false,
            needsReconnect: true,
            error: 'No refresh token stored. Admin must reconnect Google Drive once.',
        };
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: credential.refresh_token,
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    });

    const tokenData = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok) {
        // invalid_grant => the refresh token itself is dead. This is the only
        // case where the admin genuinely needs to log in again.
        const needsReconnect = tokenData?.error === 'invalid_grant';
        if (needsReconnect) {
            await supabase
                .from('google_drive_credentials')
                .update({ is_active: false })
                .eq('id', credential.id);
        }
        return {
            success: false,
            needsReconnect,
            error: tokenData?.error_description || tokenData?.error || 'Token refresh failed',
        };
    }

    const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase
        .from('google_drive_credentials')
        .update({
            access_token: tokenData.access_token,
            token_expiry: newExpiry,
            // Google only returns a new refresh_token occasionally; keep the old one otherwise.
            ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
            updated_at: new Date().toISOString(),
        })
        .eq('id', credential.id);

    if (updateError) {
        return { success: false, error: 'Failed to persist refreshed token: ' + updateError.message };
    }

    return { success: true, accessToken: tokenData.access_token, expiresAt: newExpiry };
}

/**
 * Get a currently-valid org access token, refreshing transparently if needed.
 * This is what uploads and the cron should use.
 */
export async function getValidDriveAccessToken(
    supabase: SupabaseClient
): Promise<RefreshResult> {
    const credential = await getActiveCredential(supabase);
    if (!credential) {
        return { success: false, needsReconnect: true, error: 'No active Drive connection.' };
    }

    if (!isExpiringSoon(credential.token_expiry)) {
        // Still valid — mark usage and hand it back.
        await supabase
            .from('google_drive_credentials')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', credential.id);
        return { success: true, accessToken: credential.access_token, expiresAt: credential.token_expiry };
    }

    const refreshed = await refreshDriveToken(supabase, credential);
    if (refreshed.success) {
        await supabase
            .from('google_drive_credentials')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', credential.id);
    }
    return refreshed;
}
