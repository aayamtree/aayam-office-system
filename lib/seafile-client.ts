/**
 * Seafile (Raspberry Pi file server) — BROWSER-SIDE helpers.
 *
 * The browser asks our own API (/api/storage/upload-link) for a one-time upload
 * link, then sends the file straight to the Pi. Big files are cut into 50 MB
 * pieces because Cloudflare allows at most 100 MB per request.
 * No secret key is ever used here.
 */

const CHUNK_SIZE = 50 * 1024 * 1024;   // 50 MB per piece
const SINGLE_MAX = 80 * 1024 * 1024;   // files up to 80 MB go in one request

export const SEAFILE_PUBLIC_URL = (process.env.NEXT_PUBLIC_SEAFILE_URL || 'https://files.aayamfiles.com').replace(/\/$/, '');
// Library id is NOT a secret (the secret is the API token, kept on the server).
export const SEAFILE_REPO_ID = process.env.NEXT_PUBLIC_SEAFILE_REPO_ID || '37a4fb30-8015-419a-873c-ce2d46bfe1c0';
export const SEAFILE_REPO_NAME = 'aayam-app';

export interface SeafileUploadResult {
    success: boolean;
    path?: string;   // e.g. /Aayam Projects/AAY-0012 - Name/design.pdf
    url?: string;    // our own stable, login-protected link to the file
    error?: string;
}

/** Make a file/folder name safe for the file server. */
export function sanitizeSegment(s: string): string {
    const cleaned = (s || '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+/, '');
    return cleaned || 'untitled';
}

/** Stable app link for a stored file path (works for <a href>, <img src>, etc.). */
export function seafileFileUrl(path: string): string {
    return `/api/storage/file?p=${encodeURIComponent(path)}`;
}

/** Link that opens a folder in the Seafile website (staff need a Seafile login). */
export function seafileFolderLink(dir: string): string {
    const clean = dir.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return `${SEAFILE_PUBLIC_URL}/library/${SEAFILE_REPO_ID}/${SEAFILE_REPO_NAME}/${clean}`;
}

export async function uploadFileToSeafile(
    file: File,
    dir: string,
    fileName?: string,
    onProgress?: (percent: number) => void
): Promise<SeafileUploadResult> {
    try {
        const name = sanitizeSegment(fileName || file.name);
        const rel = dir.split('/').filter(Boolean).map(sanitizeSegment).join('/');

        const linkRes = await fetch('/api/storage/upload-link');
        const linkJson = await linkRes.json().catch(() => ({}));
        if (!linkRes.ok || !linkJson.uploadLink) {
            return { success: false, error: linkJson.error || 'Could not get an upload link from the file server.' };
        }
        const base: string = String(linkJson.uploadLink).replace(/^http:\/\/files\.aayamfiles\.com/, 'https://files.aayamfiles.com');
        const uploadUrl = base + (base.includes('?') ? '&' : '?') + 'ret-json=1';

        // XMLHttpRequest (not fetch) so we can report real upload progress.
        const send = (blob: Blob, extraHeaders: Record<string, string>, doneBefore: number) =>
            new Promise<{ ok: boolean; status: number; body: any }>((resolve) => {
                const form = new FormData();
                // Text fields must come BEFORE the file part.
                form.append('parent_dir', '/');
                if (rel) form.append('relative_path', rel);
                form.append('replace', '0');
                form.append('file', blob, name);
                const xhr = new XMLHttpRequest();
                xhr.open('POST', uploadUrl);
                Object.entries(extraHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
                xhr.upload.onprogress = (ev) => {
                    if (!onProgress || !ev.lengthComputable) return;
                    const sent = doneBefore + Math.min(ev.loaded, blob.size);
                    onProgress(Math.min(99, Math.round((sent / file.size) * 100)));
                };
                xhr.onload = () => {
                    let body: any = null;
                    try { body = JSON.parse(xhr.responseText); } catch { /* not json */ }
                    resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
                };
                xhr.onerror = () => resolve({ ok: false, status: 0, body: null });
                xhr.ontimeout = () => resolve({ ok: false, status: 0, body: null });
                xhr.send(form);
            });

        let finalName = name;
        const readName = (res: { body: any }) => {
            const body = res.body;
            if (Array.isArray(body) && body[0]?.name) finalName = String(body[0].name);
        };

        if (file.size <= SINGLE_MAX) {
            const res = await send(file, {}, 0);
            if (!res.ok) return { success: false, error: res.status ? `Upload failed (${res.status})` : 'Network problem during upload' };
            readName(res);
        } else {
            const total = file.size;
            for (let start = 0; start < total; start += CHUNK_SIZE) {
                const end = Math.min(start + CHUNK_SIZE, total) - 1;
                const res = await send(file.slice(start, end + 1), {
                    'Content-Range': `bytes ${start}-${end}/${total}`,
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
                }, start);
                if (!res.ok) return { success: false, error: `Upload failed at ${Math.round((start / total) * 100)}% (${res.status || 'network problem'})` };
                if (end + 1 >= total) readName(res);
            }
        }

        onProgress?.(100);
        const path = '/' + [rel, finalName].filter(Boolean).join('/');
        return { success: true, path, url: seafileFileUrl(path) };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Upload failed' };
    }
}
