/**
 * Seafile (Raspberry Pi file server) — SERVER-SIDE helpers.
 *
 * Talks to the Seafile "library API token" endpoints. The token is a secret and
 * must only ever be read here, on the server (env SEAFILE_API_TOKEN). Browsers
 * never see it — they get short-lived, one-time links from our own API routes.
 */

const BASE = (process.env.SEAFILE_URL || 'https://files.aayamfiles.com').replace(/\/$/, '');
const TOKEN = process.env.SEAFILE_API_TOKEN || '';

export function seafileConfigured(): boolean {
    return !!TOKEN;
}

/** Normalise + validate a library path. Returns null if it looks unsafe. */
export function cleanSeafilePath(p: string | null | undefined): string | null {
    if (!p) return null;
    let s = String(p).replace(/\\/g, '/');
    if (!s.startsWith('/')) s = '/' + s;
    if (s.split('/').some((seg) => seg === '..')) return null;
    if (s.includes('\0')) return null;
    return s;
}

/** Our stored file URLs look like /api/storage/file?p=%2FAayam%20Projects%2F... — get the path back. */
export function seafilePathFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const m = String(url).match(/\/api\/storage\/file\?(?:[^#]*&)?p=([^&#]+)/);
    if (!m) return null;
    try {
        return cleanSeafilePath(decodeURIComponent(m[1]));
    } catch {
        return null;
    }
}

async function sf(path: string, init: RequestInit = {}): Promise<Response> {
    if (!TOKEN) throw new Error('Seafile is not configured (SEAFILE_API_TOKEN missing).');
    return fetch(`${BASE}/api/v2.1/via-repo-token${path}`, {
        ...init,
        headers: { Authorization: `Token ${TOKEN}`, ...(init.headers || {}) },
        cache: 'no-store',
    });
}

/** One-time upload link (used by the browser to send a file straight to the Pi). */
export async function getUploadLink(): Promise<string> {
    const res = await sf('/upload-link/?path=/&from=api');
    if (!res.ok) throw new Error(`Seafile upload-link failed (${res.status})`);
    const link = await res.json();
    if (typeof link !== 'string' || !link) throw new Error('Seafile returned no upload link');
    return link;
}

/** Short-lived download link for one file. */
export async function getDownloadLink(path: string): Promise<string> {
    const p = cleanSeafilePath(path);
    if (!p) throw new Error('Bad file path');
    const res = await sf(`/download-link/?path=${encodeURIComponent(p)}`);
    if (!res.ok) throw new Error(`Seafile download-link failed (${res.status})`);
    const link = await res.json();
    if (typeof link !== 'string' || !link) throw new Error('Seafile returned no download link');
    return link;
}

/** Delete one file. Best effort — returns ok:false instead of throwing. */
export async function deleteSeafileFile(path: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const p = cleanSeafilePath(path);
        if (!p) return { ok: false, error: 'Bad file path' };
        const res = await sf(`/file/?path=${encodeURIComponent(p)}`, { method: 'DELETE' });
        return res.ok ? { ok: true } : { ok: false, error: `Seafile delete failed (${res.status})` };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Seafile delete failed' };
    }
}

/** Download a file to memory for AI scanning, refusing anything over maxBytes. */
export async function downloadSeafileForScan(
    path: string,
    maxBytes: number
): Promise<
    | { ok: true; buffer: ArrayBuffer; mime: string }
    | { ok: false; status: number; error: string }
> {
    try {
        const link = await getDownloadLink(path);
        const res = await fetch(link, { cache: 'no-store' });
        if (!res.ok) return { ok: false, status: 502, error: `File download failed (${res.status})` };
        const len = parseInt(res.headers.get('content-length') || '0', 10);
        if (len && len > maxBytes) {
            return { ok: false, status: 413, error: 'This file is too large to scan (over 22 MB). Export a compressed PDF or JPG.' };
        }
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > maxBytes) {
            return { ok: false, status: 413, error: 'This file is too large to scan (over 22 MB). Export a compressed PDF or JPG.' };
        }
        const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
        return { ok: true, buffer, mime };
    } catch (e: any) {
        return { ok: false, status: 502, error: e?.message || 'File download failed' };
    }
}

/** Make sure a Seafile-issued link uses https (Seafile itself believes it is on http behind the tunnel). */
export function forceHttps(link: string): string {
    return String(link).replace(/^http:\/\/files\.aayamfiles\.com/, 'https://files.aayamfiles.com');
}

export type SeafileHealth = { ok: boolean; ms: number; detail: string };

/**
 * Is the Pi file server reachable AND will it accept our token?
 * Step 1: public ping (is the Pi + tunnel alive).  Step 2: ask for an upload link
 * (proves the library token works and Seafile can do real work).
 */
export async function checkSeafileHealth(timeoutMs = 8000): Promise<SeafileHealth> {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const ping = await fetch(`${BASE}/api2/ping/`, { cache: 'no-store', signal: ctrl.signal });
        if (!ping.ok) return { ok: false, ms: Date.now() - started, detail: `File server answered with error ${ping.status}` };
        if (!TOKEN) return { ok: false, ms: Date.now() - started, detail: 'Access key (SEAFILE_API_TOKEN) is not set' };
        const res = await fetch(`${BASE}/api/v2.1/via-repo-token/upload-link/?path=/&from=api`, {
            headers: { Authorization: `Token ${TOKEN}` },
            cache: 'no-store',
            signal: ctrl.signal,
        });
        if (!res.ok) return { ok: false, ms: Date.now() - started, detail: `Access key refused (${res.status})` };
        return { ok: true, ms: Date.now() - started, detail: 'OK' };
    } catch (e: any) {
        const timedOut = e?.name === 'AbortError';
        return {
            ok: false,
            ms: Date.now() - started,
            detail: timedOut ? 'File server did not answer in time (Pi, internet or tunnel may be down)' : `Cannot reach file server (${e?.message || 'network error'})`,
        };
    } finally {
        clearTimeout(timer);
    }
}

/** Upload a file from the server itself (used by the nightly backup). dir has no leading slash. */
export async function uploadBufferToSeafile(
    dir: string,
    fileName: string,
    data: ArrayBuffer | Uint8Array | string,
    mime = 'application/octet-stream'
): Promise<{ ok: boolean; path?: string; error?: string }> {
    try {
        const link = forceHttps(await getUploadLink());
        const form = new FormData();
        form.append('parent_dir', '/');
        const rel = dir.split('/').filter(Boolean).join('/');
        if (rel) form.append('relative_path', rel);
        form.append('replace', '1');
        form.append('file', new Blob([data as any], { type: mime }), fileName);
        const res = await fetch(`${link}${link.includes('?') ? '&' : '?'}ret-json=1`, { method: 'POST', body: form });
        if (!res.ok) return { ok: false, error: `Pi upload failed (${res.status})` };
        return { ok: true, path: '/' + [rel, fileName].filter(Boolean).join('/') };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Pi upload failed' };
    }
}

/** Server-side upload of a file of any size (pieces of 40 MB so Cloudflare's 100 MB limit is never hit). */
export async function uploadLargeToSeafile(
    dir: string,
    fileName: string,
    data: ArrayBuffer
): Promise<{ ok: boolean; path?: string; size?: number; error?: string }> {
    try {
        const rel = dir.split('/').filter(Boolean).join('/');
        const total = data.byteLength;
        const PIECE = 40 * 1024 * 1024;
        const link = forceHttps(await getUploadLink());
        const url = `${link}${link.includes('?') ? '&' : '?'}ret-json=1`;
        let finalName = fileName;
        let finalSize = total;
        const chunked = total > 80 * 1024 * 1024;
        for (let start = 0; start < total || (total === 0 && start === 0); start += PIECE) {
            const end = Math.min(start + PIECE, total) - 1;
            const form = new FormData();
            form.append('parent_dir', '/');
            if (rel) form.append('relative_path', rel);
            form.append('replace', '1');
            form.append('file', new Blob([chunked ? data.slice(start, end + 1) : data]), fileName);
            const headers: Record<string, string> = {};
            if (chunked) {
                headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
                headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`;
            }
            const res = await fetch(url, { method: 'POST', body: form, headers });
            if (!res.ok) return { ok: false, error: `Pi upload failed (${res.status}) at ${Math.round((start / Math.max(total, 1)) * 100)}%` };
            if (!chunked || end + 1 >= total) {
                const body = await res.json().catch(() => null);
                if (Array.isArray(body) && body[0]) {
                    finalName = String(body[0].name || fileName);
                    if (typeof body[0].size === 'number') finalSize = body[0].size;
                }
            }
            if (!chunked) break;
        }
        return { ok: true, path: '/' + [rel, finalName].filter(Boolean).join('/'), size: finalSize };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Pi upload failed' };
    }
}
