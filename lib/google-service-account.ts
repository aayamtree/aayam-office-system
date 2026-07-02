/**
 * Google Service Account auth for Drive (zero interactive login).
 *
 * Mints a short-lived Google access token by signing a JWT with the service
 * account's private key (RS256) and exchanging it at Google's token endpoint.
 * No external dependency — uses Node's built-in crypto. Server-side only.
 *
 * Configure with env GOOGLE_SERVICE_ACCOUNT_KEY = the full service-account
 * JSON (or its base64). The account must be a member of the target Shared Drive.
 */
import crypto from 'crypto';

interface SaConfig { client_email: string; private_key: string; }

let cached: { token: string; exp: number } | null = null;

export function getServiceAccountConfig(): SaConfig | null {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!raw) return null;
    let json: any = null;
    try {
        json = JSON.parse(raw);
    } catch {
        try { json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch { return null; }
    }
    if (!json || !json.client_email || !json.private_key) return null;
    return { client_email: json.client_email, private_key: json.private_key };
}

export function isServiceAccountConfigured(): boolean {
    return !!getServiceAccountConfig();
}

export async function getServiceAccountToken(
    scope = 'https://www.googleapis.com/auth/drive'
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    const cfg = getServiceAccountConfig();
    if (!cfg) return { success: false, error: 'Service account not configured' };

    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.exp - 60 > now) {
        return { success: true, accessToken: cached.token };
    }

    try {
        const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
        const header = { alg: 'RS256', typ: 'JWT' };
        const claim = {
            iss: cfg.client_email,
            scope,
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        };
        const unsigned = `${b64(header)}.${b64(claim)}`;
        const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(cfg.private_key, 'base64url');
        const assertion = `${unsigned}.${signature}`;

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.access_token) {
            return { success: false, error: data.error_description || data.error || 'Token exchange failed' };
        }
        cached = { token: data.access_token, exp: now + (data.expires_in || 3600) };
        return { success: true, accessToken: data.access_token };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to mint service-account token' };
    }
}
