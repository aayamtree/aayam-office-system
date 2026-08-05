// lib/zoho-api.ts — talking to Zoho Books as ourselves.
//
// WHY THIS EXISTS
// Webhooks push invoices and quotes at us the moment they change, which is
// perfect for documents. Bank transactions are different: they arrive in Zoho
// from the HDFC feed without anyone touching a record, so there is no user
// event to hang a workflow rule on. Those we have to go and FETCH.
//
// SECRETS
// ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET live in Vercel env vars — Satish enters
// them himself, they are never handled anywhere else. The refresh token is
// obtained by the OAuth round-trip in /api/zoho/oauth/* and stored in
// zoho_sync_config, which is service-role only (no RLS policy at all).
//
// SCOPES ARE READ-ONLY BY DESIGN. Zoho is the source of truth for the books;
// the app must never be able to alter them, even if this token leaked.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const ZOHO_ACCOUNTS = 'https://accounts.zoho.com';
export const ZOHO_API = 'https://www.zohoapis.com/books/v3';

export const ZOHO_SCOPES = [
    'ZohoBooks.banking.READ',
    'ZohoBooks.invoices.READ',
    'ZohoBooks.estimates.READ',
    'ZohoBooks.settings.READ',
].join(',');

export function zohoServiceClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

export function zohoCredentials(): { clientId: string; clientSecret: string } | null {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

/** Read one value out of zoho_sync_config. */
export async function getConfig(supabase: SupabaseClient, key: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('zoho_sync_config')
        .select('value')
        .eq('key', key)
        .maybeSingle();
    if (error || !data) return null;
    return data.value as string;
}

export async function setConfig(supabase: SupabaseClient, key: string, value: string): Promise<void> {
    await supabase.from('zoho_sync_config').upsert({ key, value }, { onConflict: 'key' });
}

/**
 * Exchange the stored refresh token for a short-lived access token.
 * Zoho access tokens last an hour; we simply fetch a fresh one per run rather
 * than caching across invocations, because serverless functions do not share
 * memory and a stale cached token is worse than one extra request.
 */
export async function getAccessToken(supabase: SupabaseClient): Promise<string | null> {
    const creds = zohoCredentials();
    if (!creds) {
        console.error('[zoho-api] ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET not set');
        return null;
    }
    const refreshToken = await getConfig(supabase, 'refresh_token');
    if (!refreshToken) {
        console.error('[zoho-api] no refresh token — visit /api/zoho/oauth/start to connect');
        return null;
    }

    const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'refresh_token',
    });

    const res = await fetch(`${ZOHO_ACCOUNTS}/oauth/v2/token?${params}`, { method: 'POST' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.access_token) {
        console.error('[zoho-api] token refresh failed:', json?.error || res.status);
        return null;
    }
    return json.access_token as string;
}

/** The organization_id every Books API call needs. Cached in config after first lookup. */
export async function getOrganizationId(
    supabase: SupabaseClient,
    accessToken: string
): Promise<string | null> {
    const cached = await getConfig(supabase, 'organization_id');
    if (cached) return cached;

    const res = await fetch(`${ZOHO_API}/organizations`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const json = await res.json().catch(() => null);
    const org = json?.organizations?.[0];
    if (!org?.organization_id) {
        console.error('[zoho-api] could not read organization_id:', json?.message || res.status);
        return null;
    }
    await setConfig(supabase, 'organization_id', String(org.organization_id));
    return String(org.organization_id);
}

/** GET a Books endpoint with auth + organization_id already applied. */
export async function zohoGet(
    accessToken: string,
    orgId: string,
    path: string,
    params: Record<string, string> = {}
): Promise<any | null> {
    const qs = new URLSearchParams({ organization_id: orgId, ...params });
    const res = await fetch(`${ZOHO_API}${path}?${qs}`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        console.error(`[zoho-api] GET ${path} failed:`, json?.message || res.status);
        return null;
    }
    return json;
}

/** Record every sync attempt, successful or not — a dead cron must be visible. */
export async function logSyncRun(
    supabase: SupabaseClient,
    kind: string,
    ok: boolean,
    fetched: number,
    message?: string
): Promise<void> {
    await supabase.from('zoho_sync_runs').insert({ kind, ok, fetched, message: message || null });
}
