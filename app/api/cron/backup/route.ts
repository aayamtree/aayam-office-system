import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceAccountToken } from '@/lib/google-service-account';
import { withCronLog } from '@/lib/cron-log';
import { uploadBufferToSeafile, seafileConfigured } from '@/lib/seafile-server';

const PI_MODE = process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'seafile';

/**
 * DB Backup Cron (nightly; Pi copy every night, Drive copy Saturdays)
 * Exports every public table as JSON and uploads a single dated file to the
 * company Shared Drive under "Aayam Projects/DB Backups/".
 * Backups older than 180 days are pruned.
 *
 * Vercel cron config (vercel.json):
 * { "path": "/api/cron/backup", "schedule": "30 20 * * 6" }
 * (Runs 20:30 UTC Saturday = 02:00 IST Sunday)
 */

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SHARED_DRIVE_ID = process.env.NEXT_PUBLIC_GOOGLE_SHARED_DRIVE_ID || '0AFECdIXIxXjSUk9PVA';
const ALL_DRIVES = 'supportsAllDrives=true&includeItemsFromAllDrives=true';
const PAGE = 1000;
const RETENTION_DAYS = 180;

function serviceSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
    const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&${ALL_DRIVES}&corpora=drive&driveId=${SHARED_DRIVE_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const search = await searchRes.json();
    if (search.files?.length) return search.files[0].id;

    const createRes = await fetch(`https://www.googleapis.com/drive/v3/files?${ALL_DRIVES}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    const created = await createRes.json();
    if (!created.id) throw new Error(`Could not create Drive folder "${name}": ${JSON.stringify(created)}`);
    return created.id;
}

async function uploadJson(token: string, folderId: string, fileName: string, content: string): Promise<string> {
    const boundary = 'aayam_backup_boundary';
    const metadata = { name: fileName, parents: [folderId] };
    const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&${ALL_DRIVES}`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body,
        }
    );
    const json = await res.json();
    if (!json.id) throw new Error(`Upload failed: ${JSON.stringify(json)}`);
    return json.id;
}

async function pruneOldBackups(token: string, folderId: string) {
    try {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
        const q = `'${folderId}' in parents and trashed=false and createdTime < '${cutoff}'`;
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&${ALL_DRIVES}&corpora=drive&driveId=${SHARED_DRIVE_ID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        for (const f of json.files || []) {
            await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?${ALL_DRIVES}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
        }
    } catch {
        // Pruning is best-effort; never fail the backup because of it.
    }
}

async function runJob(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const supabase = serviceSupabase();

        // 1. Which tables exist right now (schema evolves — never hardcode)
        const { data: tables, error: tablesError } = await supabase.rpc('fn_backup_tables');
        if (tablesError || !tables?.length) {
            return NextResponse.json({ error: `Could not list tables: ${tablesError?.message}` }, { status: 500 });
        }

        // 2. Export each table (paged — PostgREST caps at 1000 rows per request)
        const dump: Record<string, unknown[]> = {};
        const rowCounts: Record<string, number> = {};
        for (const t of tables as { table_name: string }[]) {
            const name = t.table_name;
            const rows: unknown[] = [];
            for (let from = 0; ; from += PAGE) {
                const { data, error } = await supabase.from(name).select('*').range(from, from + PAGE - 1);
                if (error) { rows.push({ __backup_error: error.message }); break; }
                rows.push(...(data || []));
                if (!data || data.length < PAGE) break;
            }
            dump[name] = rows;
            rowCounts[name] = rows.length;
        }

        const stamp = new Date().toISOString().split('T')[0];
        const fileName = `aayam-db-backup-${stamp}.json`;
        const payload = JSON.stringify({
            exportedAt: new Date().toISOString(),
            tableCount: Object.keys(dump).length,
            rowCounts,
            tables: dump,
        });

        // 3a. Pi mode: save the dated file on the office Raspberry Pi (every run = every night).
        let piPath: string | null = null;
        if (PI_MODE) {
            if (!seafileConfigured()) throw new Error('Pi backup failed: Seafile is not configured');
            const up = await uploadBufferToSeafile('Aayam Projects/DB Backups', fileName, payload, 'application/json');
            if (!up.ok) throw new Error(`Pi backup failed: ${up.error}`);
            piPath = up.path || null;
        }

        // 3b. Google Drive copy. Pi mode: only on Saturdays, as the off-site second copy,
        //     and a Drive problem (e.g. Drive full) never fails the run. Drive mode: every run.
        const isSaturdayUtc = new Date().getUTCDay() === 6;
        let fileId: string | null = null;
        let driveError: string | null = null;
        if (!PI_MODE || isSaturdayUtc) {
            try {
                const sa = await getServiceAccountToken();
                if (!sa.success || !sa.accessToken) throw new Error(`Drive token failed: ${sa.error}`);
                const root = await findOrCreateFolder(sa.accessToken, 'Aayam Projects', SHARED_DRIVE_ID);
                const folder = await findOrCreateFolder(sa.accessToken, 'DB Backups', root);
                fileId = await uploadJson(sa.accessToken, folder, fileName, payload);
                // 4. Prune old backups on Drive (best-effort)
                await pruneOldBackups(sa.accessToken, folder);
            } catch (e: any) {
                driveError = e?.message || 'Drive copy failed';
                if (!PI_MODE) throw e;
            }
        }

        return NextResponse.json({
            ok: true,
            file: fileName,
            fileId,
            piPath,
            driveError,
            tables: Object.keys(dump).length,
            totalRows: Object.values(rowCounts).reduce((s, n) => s + n, 0),
            sizeKb: Math.round(payload.length / 1024),
            ms: Date.now() - startedAt,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Backup failed' }, { status: 500 });
    }
}

// Every run of this cron is recorded in public.cron_runs (see lib/cron-log.ts).
// Vercel knows whether the schedule fired, but that lives in a dashboard nobody
// opens; the daily audit needs the fact inside the database so it can alert when
// this job silently stops running.
export async function GET(request: NextRequest) {
    return withCronLog('backup', () => runJob(request));
}
