/**
 * One-time background move: Google Drive -> Raspberry Pi (Seafile).
 *
 * Safe by design:
 *  - Nothing is ever deleted from Google Drive here.
 *  - A link is only switched to the Pi AFTER the file arrived there with exactly the same size.
 *  - The old Drive link/id is kept on every moved item (old_drive_url / old_drive_id) so it can be
 *    undone, and so the later "free up Drive" step knows exactly what is safe to delete.
 *  - Re-runnable: items already moved are skipped; failed items are retried up to 3 times.
 */
import { createClient } from '@supabase/supabase-js';
import { getServiceAccountToken } from '@/lib/google-service-account';
import { uploadLargeToSeafile, seafileConfigured, getDownloadLink, getUploadLink, forceHttps } from '@/lib/seafile-server';
import { sanitizeSegment, seafileFileUrl, seafileFolderLink } from '@/lib/seafile-client';

const MAX_ATTEMPTS = 3;
const MAX_FILE_BYTES = 400 * 1024 * 1024;       // files up to this size are moved in one go
const MAX_BIG_BYTES = 4 * 1024 * 1024 * 1024;  // bigger files (up to 4 GB) are moved in 40 MB pieces, across several runs if needed
const PIECE = 40 * 1024 * 1024;
const isDriveUrl = (u: unknown) => typeof u === 'string' && /drive\.google\.com/.test(u);

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export function driveIdOf(item: any): string | null {
    if (!item) return null;
    if (item.fileId && !String(item.fileId).startsWith('/')) return String(item.fileId);
    const url = String(item.url || '');
    const m = url.match(/\/file\/d\/([^/?#]+)/) || url.match(/[?&]id=([^&#]+)/) || url.match(/\/folders\/([^/?#]+)/);
    return m ? m[1] : null;
}

type DriveGet = { ok: true; buffer: ArrayBuffer; name?: string } | { ok: false; error: string };

async function downloadFromDrive(token: string, id: string): Promise<DriveGet> {
    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;
    const auth = { Authorization: `Bearer ${token}` };
    const metaRes = await fetch(`${base}?fields=name,size,mimeType&supportsAllDrives=true`, { headers: auth });
    if (!metaRes.ok) return { ok: false, error: `Drive says ${metaRes.status} (file not found or no access)` };
    const meta = await metaRes.json();
    if (meta.size && Number(meta.size) > MAX_FILE_BYTES) return { ok: false, error: 'File is too large for the automatic move' };
    const res = await fetch(`${base}?alt=media&supportsAllDrives=true`, { headers: auth });
    if (!res.ok) return { ok: false, error: `Drive download failed (${res.status})` };
    return { ok: true, buffer: await res.arrayBuffer(), name: meta.name };
}

type BigResult =
    | { ok: true; done: true; path: string; size: number }
    | { ok: true; done: false; offset: number }
    | { ok: false; error: string };

/**
 * Move a large Drive file to the Pi WITHOUT holding it in memory: read 40 MB from Drive, send 40 MB to the Pi, repeat.
 * If the time budget runs out it stops cleanly and reports how far it got, so the next run carries on from there.
 */
async function moveBig(token: string, driveId: string, dir: string, nameHint: string | undefined, startOffset: number, deadline: number): Promise<BigResult> {
    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}`;
    const auth = { Authorization: `Bearer ${token}` };
    const metaRes = await fetch(`${base}?fields=name,size&supportsAllDrives=true`, { headers: auth });
    if (!metaRes.ok) return { ok: false, error: `Drive says ${metaRes.status} (file not found or no access)` };
    const meta = await metaRes.json();
    const total = Number(meta.size);
    if (!Number.isFinite(total) || total <= 0) return { ok: false, error: 'Drive did not report a file size' };
    if (total > MAX_BIG_BYTES) return { ok: false, error: 'File is too large for the automatic move' };
    const name = sanitizeSegment(nameHint || meta.name || `file-${driveId}`);
    const rel = dir.split('/').filter(Boolean).join('/');
    let link: string;
    try { link = forceHttps(await getUploadLink()); } catch (e: any) { return { ok: false, error: e?.message || 'Pi upload link failed' }; }
    const url = `${link}${link.includes('?') ? '&' : '?'}ret-json=1`;
    let start = Math.max(0, Math.min(startOffset || 0, total - 1));
    let finalName = name;
    let finalSize = total;
    while (start < total) {
        if (Date.now() > deadline) return { ok: true, done: false, offset: start };
        const end = Math.min(start + PIECE, total) - 1;
        const dl = await fetch(`${base}?alt=media&supportsAllDrives=true`, { headers: { ...auth, Range: `bytes=${start}-${end}` } });
        if (dl.status !== 206 && !(dl.status === 200 && start === 0 && end + 1 >= total)) return { ok: false, error: `Drive download failed (${dl.status}) at ${Math.round((start / total) * 100)}%` };
        const buf = await dl.arrayBuffer();
        if (buf.byteLength !== end - start + 1) return { ok: false, error: `Drive piece was the wrong size at ${Math.round((start / total) * 100)}%` };
        const form = new FormData();
        form.append('parent_dir', '/');
        if (rel) form.append('relative_path', rel);
        form.append('replace', '1');
        form.append('file', new Blob([buf]), name);
        const up = await fetch(url, {
            method: 'POST',
            body: form,
            headers: { 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"` },
        });
        if (!up.ok) return { ok: false, error: `Pi upload failed (${up.status}) at ${Math.round((start / total) * 100)}%` };
        if (end + 1 >= total) {
            const body = await up.json().catch(() => null);
            if (Array.isArray(body) && body[0]) {
                finalName = String(body[0].name || name);
                if (typeof body[0].size === 'number') finalSize = body[0].size;
            }
        }
        start = end + 1;
    }
    if (finalSize !== total) return { ok: false, error: `Size mismatch (Drive ${total} vs Pi ${finalSize})` };
    return { ok: true, done: true, path: '/' + [rel, finalName].filter(Boolean).join('/'), size: finalSize };
}

/** Move one Drive file to the Pi. Returns the new Pi path. */
async function moveOne(token: string, driveId: string, dir: string, nameHint?: string): Promise<{ ok: true; path: string; size: number } | { ok: false; error: string }> {
    const got = await downloadFromDrive(token, driveId);
    if (!got.ok) return got;
    const name = sanitizeSegment(nameHint || got.name || `file-${driveId}`);
    const up = await uploadLargeToSeafile(dir, name, got.buffer);
    if (!up.ok || !up.path) return { ok: false, error: up.error || 'Pi upload failed' };
    if (up.size !== got.buffer.byteLength) return { ok: false, error: `Size mismatch (Drive ${got.buffer.byteLength} vs Pi ${up.size})` };
    return { ok: true, path: up.path, size: up.size };
}

async function saveJob(client: ReturnType<typeof db>, id: string, files: any[], print: any[], driveLink: string | null) {
    const { error } = await client.rpc('fn_relink_job_files', { p_job: id, p_files: files, p_print: print, p_drive_link: driveLink });
    if (!error) return null;
    // Helper function not installed? fall back to a plain update.
    if (/fn_relink_job_files|function|schema cache/i.test(error.message || '')) {
        const patch: any = { files, print_files: print };
        if (driveLink) patch.drive_link = driveLink;
        const { error: e2 } = await client.from('jobs').update(patch).eq('id', id);
        return e2 ? e2.message : null;
    }
    return error.message;
}

const pendingItems = (arr: any[]) =>
    (arr || []).filter((it) => it && isDriveUrl(it.url) && !it.old_drive_url && (it.migrate_attempts || 0) < MAX_ATTEMPTS);

export type BatchResult = { moved: number; failed: number; jobsTouched: number; bytes: number; done: boolean; note?: string; partial?: number };

/** Work through jobs until the time budget is used up. */
export async function migrateJobsBatch(budgetMs: number): Promise<BatchResult> {
    const started = Date.now();
    const out: BatchResult = { moved: 0, failed: 0, jobsTouched: 0, bytes: 0, done: false };
    if (!seafileConfigured()) return { ...out, note: 'Pi not configured' };
    const sa = await getServiceAccountToken();
    if (!sa.success || !sa.accessToken) return { ...out, note: `Google token failed: ${sa.error}` };
    const client = db();

    const { data: jobs, error } = await client
        .from('jobs')
        .select('id,job_number,project_name,drive_link,files,print_files')
        .or('drive_link.ilike.*drive.google.com*,drive_link.is.null')
        .order('created_at', { ascending: false });
    if (error) return { ...out, note: error.message };

    const work = (jobs || []).filter((j: any) => pendingItems(j.files).length + pendingItems(j.print_files).length > 0);
    if (work.length === 0) { out.done = true; return out; }

    for (const job of work as any[]) {
        if (Date.now() - started > budgetMs) break;
        const dir = `Aayam Projects/${sanitizeSegment(`${job.job_number || 'misc'} - ${job.project_name || 'Project'}`.slice(0, 100))}`;
        let files: any[] = Array.isArray(job.files) ? [...job.files] : [];
        let print: any[] = Array.isArray(job.print_files) ? [...job.print_files] : [];
        const seen = new Map<string, string>(); // driveId -> Pi path (same file listed twice = copied once)
        const seenSame = new Map<string, string>(); // same name + same size inside one job = same file, copied once
        let touched = false;

        const handle = async (arr: any[]) => {
            for (let i = 0; i < arr.length; i++) {
                const it = arr[i];
                if (!(it && isDriveUrl(it.url) && !it.old_drive_url && (it.migrate_attempts || 0) < MAX_ATTEMPTS)) continue;
                if (Date.now() - started > budgetMs) return;
                const id = driveIdOf(it);
                if (!id) { arr[i] = { ...it, migrate_attempts: MAX_ATTEMPTS, migrate_error: 'No Drive file id in link' }; out.failed++; touched = true; continue; }
                const sameKey = `${it.name || ''}|${it.size || ''}`;
                let path = seen.get(id) || (it.size && it.name ? seenSame.get(sameKey) : undefined);
                let size = it.size;
                if (!path) {
                    const big = Number(it.size) > MAX_FILE_BYTES;
                    if (big) {
                        const r = await moveBig(sa.accessToken!, id, dir, it.name, Number(it.migrate_offset) || 0, started + budgetMs);
                        if (!r.ok) {
                            // a resumed upload that the Pi refuses starts again from the beginning next time
                            arr[i] = { ...it, migrate_attempts: (it.migrate_attempts || 0) + 1, migrate_error: r.error, migrate_offset: 0 };
                            out.failed++; touched = true;
                            continue;
                        }
                        if (!r.done) {
                            arr[i] = { ...it, migrate_offset: r.offset, migrate_error: undefined };
                            out.partial = (out.partial || 0) + 1; touched = true;
                            return; // out of time: carry on from here next run
                        }
                        path = r.path; size = r.size; out.bytes += r.size;
                    } else {
                        const r = await moveOne(sa.accessToken!, id, dir, it.name);
                        if (!r.ok) {
                            arr[i] = { ...it, migrate_attempts: (it.migrate_attempts || 0) + 1, migrate_error: r.error };
                            out.failed++; touched = true;
                            continue;
                        }
                        path = r.path; size = r.size; out.bytes += r.size;
                    }
                    seen.set(id, path);
                    if (it.size && it.name) seenSame.set(sameKey, path);
                }
                arr[i] = {
                    ...it,
                    url: seafileFileUrl(path),
                    storage: 'seafile',
                    fileId: path,
                    size: size ?? it.size,
                    old_drive_url: it.url,
                    old_drive_id: id,
                    migrated_at: new Date().toISOString(),
                    migrate_error: undefined,
                    migrate_offset: undefined,
                };
                out.moved++; touched = true;
                // saved once per job (below): a timeout only means the last file is simply moved again next run
            }
        };
        await handle(files);
        await handle(print);

        if (touched) {
            out.jobsTouched++;
            const left = pendingItems(files).length + pendingItems(print).length;
            const failedLeft = [...files, ...print].some((it) => it && isDriveUrl(it.url) && !it.old_drive_url);
            const folderLink = !failedLeft && (job.drive_link == null || isDriveUrl(job.drive_link)) ? seafileFolderLink(dir) : null;
            {
                // Final save: records failed attempts too, and sets the job's folder link when everything moved.
                const msg = await saveJob(client, job.id, files, print, left === 0 ? folderLink : null);
                if (msg) out.note = `Could not save job ${job.job_number}: ${msg}`;
            }
            if (out.note) break;
        }
    }
    return out;
}

/** Count what is left, for the progress card. */
export async function migrationStatus() {
    const client = db();
    const { data: jobs } = await client.from('jobs').select('files,print_files');
    let pending = 0, moved = 0, failed = 0, pendingBytes = 0, movedBytes = 0;
    for (const j of (jobs || []) as any[]) {
        for (const it of [...(j.files || []), ...(j.print_files || [])]) {
            if (!it) continue;
            if (it.old_drive_url) { moved++; movedBytes += Number(it.size) || 0; }
            else if (isDriveUrl(it.url)) {
                if ((it.migrate_attempts || 0) >= MAX_ATTEMPTS) failed++;
                else { pending++; pendingBytes += Number(it.size) || 0; }
            }
        }
    }
    return { pending, moved, failed, pendingGB: +(pendingBytes / 1073741824).toFixed(1), movedGB: +(movedBytes / 1073741824).toFixed(1) };
}

/** Product library files (small): file_url + thumbnail_url on products and product_versions. */
export async function migrateProductsBatch(budgetMs: number): Promise<{ moved: number; failed: number }> {
    const started = Date.now();
    const out = { moved: 0, failed: 0 };
    if (!seafileConfigured()) return out;
    const sa = await getServiceAccountToken();
    if (!sa.success || !sa.accessToken) return out;
    const client = db();
    const { data: prods } = await client.from('products').select('id,name,file_url,thumbnail_url');
    const names = new Map<string, string>((prods || []).map((p: any) => [p.id, p.name]));
    const cache = new Map<string, string>(); // old url -> new url

    const convert = async (url: string | null, productName: string): Promise<string | null> => {
        if (!url || !isDriveUrl(url)) return null;
        if (cache.has(url)) return cache.get(url)!;
        const id = driveIdOf({ url });
        if (!id) return null;
        const r = await moveOne(sa.accessToken!, id, `Product Library/${sanitizeSegment(productName || 'Product').slice(0, 80)}`);
        if (!r.ok) { out.failed++; return null; }
        const nu = seafileFileUrl(r.path);
        cache.set(url, nu);
        out.moved++;
        return nu;
    };

    for (const table of ['products', 'product_versions'] as const) {
        const sel = table === 'products' ? 'id,name,file_url,thumbnail_url' : 'id,product_id,file_url,thumbnail_url';
        const { data: rows } = await client.from(table).select(sel).or('file_url.ilike.*drive.google.com*,thumbnail_url.ilike.*drive.google.com*');
        for (const row of (rows || []) as any[]) {
            if (Date.now() - started > budgetMs) return out;
            const pname = table === 'products' ? row.name : names.get(row.product_id) || 'Product';
            const f = await convert(row.file_url, pname);
            const t = await convert(row.thumbnail_url, pname);
            const patch: any = {};
            if (f) patch.file_url = f;
            if (t) patch.thumbnail_url = t;
            if (Object.keys(patch).length) await client.from(table).update(patch).eq('id', row.id);
        }
    }
    return out;
}

/**
 * Free up Google Drive: move the OLD copies of already-moved files to the Drive TRASH.
 * Safe by design:
 *  - Only items that were moved (have old_drive_id) and whose Pi copy has exactly the same size as the Drive file.
 *  - A Drive file that is still used by any unmoved item is never touched.
 *  - It goes to the Drive trash (recoverable for 30 days) — never permanently deleted by the app.
 *  - Every handled item is marked with drive_trashed_at so it is not handled twice.
 */
async function piSize(path: string): Promise<number | null> {
    try {
        const link = forceHttps(await getDownloadLink(path));
        const r = await fetch(link, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
        if (r.status !== 206 && r.status !== 200) return null;
        const cr = r.headers.get('content-range');
        const total = cr ? Number(cr.split('/')[1]) : Number(r.headers.get('content-length'));
        try { await r.arrayBuffer(); } catch { /* ignore */ }
        return Number.isFinite(total) ? total : null;
    } catch { return null; }
}

export async function cleanupDriveBatch(budgetMs: number): Promise<{ trashed: number; skipped: number; gone: number; left: number; note?: string; reasons?: Record<string, number> }> {
    const started = Date.now();
    const out = { trashed: 0, skipped: 0, gone: 0, left: 0, reasons: {} as Record<string, number> } as { trashed: number; skipped: number; gone: number; left: number; note?: string; reasons: Record<string, number> };
    const why = (r: string) => { out.reasons[r] = (out.reasons[r] || 0) + 1; };
    const sa = await getServiceAccountToken();
    if (!sa.success || !sa.accessToken) { out.note = 'Google service account unavailable'; return out; }
    const auth = { Authorization: `Bearer ${sa.accessToken}` };
    const client = db();
    const { data: jobs } = await client.from('jobs').select('id,job_number,files,print_files');
    // Drive ids still in use by items that have NOT been moved: never touch these.
    const inUse = new Set<string>();
    for (const j of (jobs || []) as any[]) for (const it of [...(j.files || []), ...(j.print_files || [])]) {
        if (it && isDriveUrl(it.url)) { const id = driveIdOf(it); if (id) inUse.add(id); }
    }
    const verdict = new Map<string, 'trashed' | 'gone' | 'skip'>();
    const eligible = (it: any) => it && it.old_drive_id && it.storage === 'seafile' && !it.drive_trashed_at && !inUse.has(it.old_drive_id);

    for (const job of (jobs || []) as any[]) {
        if (!([...(job.files || []), ...(job.print_files || [])].some(eligible))) continue;
        if (Date.now() - started > budgetMs) { out.left++; continue; }
        let touched = false;
        const handle = async (arr: any[]) => {
            for (let i = 0; i < arr.length; i++) {
                const it = arr[i];
                if (!eligible(it)) continue;
                if (Date.now() - started > budgetMs) return;
                const id = it.old_drive_id as string;
                let v = verdict.get(id);
                if (!v) {
                    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;
                    const m = await fetch(`${base}?fields=size,trashed,mimeType&supportsAllDrives=true`, { headers: auth });
                    if (m.status === 404) v = 'gone';
                    else if (!m.ok) { v = 'skip'; why(`drive-meta-${m.status}`); }
                    else {
                        const meta = await m.json();
                        if (meta.trashed) v = 'gone';
                        else if (meta.mimeType === 'application/vnd.google-apps.folder') v = 'skip';
                        else {
                            const pi = await piSize(String(it.fileId));
                            if (pi == null) { v = 'skip'; why('pi-copy-missing'); }
                            else if (meta.size != null && Number(meta.size) !== pi) { v = 'skip'; why('size-mismatch'); }
                            else {
                                const t = await fetch(`${base}?supportsAllDrives=true`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
                                if (t.ok) v = 'trashed'; else { v = 'skip'; why(`trash-denied-${t.status}-pi-verified`); }
                            }
                        }
                    }
                    verdict.set(id, v);
                    if (v === 'trashed') out.trashed++; else if (v === 'gone') out.gone++; else out.skipped++;
                }
                if (v === 'trashed' || v === 'gone') { arr[i] = { ...it, drive_trashed_at: new Date().toISOString() }; touched = true; }
                else out.left++;
            }
        };
        const files: any[] = Array.isArray(job.files) ? [...job.files] : [];
        const print: any[] = Array.isArray(job.print_files) ? [...job.print_files] : [];
        await handle(files); await handle(print);
        if (touched) {
            const msg = await saveJob(client, job.id, files, print, null);
            if (msg) { out.note = `Could not save job ${job.job_number}: ${msg}`; break; }
        }
    }
    return out;
}
