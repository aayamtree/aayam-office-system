// /api/cron/pi-health — every 5 minutes: is the Pi file server alive?
// Sends a Telegram message to the admin group (and linked admins) when the Pi has
// been unreachable for 2 checks in a row (~10 min), and again when it comes back.
// State is kept in public.cron_runs (message = up | down1 | down-alerted), so no
// new table is needed. Only active when the app is switched to Pi storage.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron } from '@/lib/api-auth';
import { checkSeafileHealth } from '@/lib/seafile-server';
import { sendToChatResult, escapeHtml } from '@/lib/telegram-groups';
import { logCronRun } from '@/lib/cron-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

const JOB = 'pi-health';

function serviceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

async function adminTargets(db: any): Promise<string[]> {
    const [{ data: groups }, { data: admins }] = await Promise.all([
        db.from('telegram_groups').select('chat_id').eq('is_active', true).eq('department', 'admin'),
        db.from('profiles').select('telegram_chat_id').eq('role', 'admin').eq('is_active', true)
            .not('telegram_chat_id', 'is', null),
    ]);
    const set = new Set<string>();
    for (const g of groups || []) if (g.chat_id) set.add(g.chat_id);
    for (const a of admins || []) if (a.telegram_chat_id) set.add(a.telegram_chat_id);
    return Array.from(set);
}

async function alertAdmins(db: any, html: string) {
    for (const chat of await adminTargets(db)) await sendToChatResult(chat, html);
}

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;

    if (process.env.NEXT_PUBLIC_STORAGE_BACKEND !== 'seafile') {
        return NextResponse.json({ skipped: 'Pi storage is not switched on' });
    }
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const health = await checkSeafileHealth();

    const { data: last } = await db.from('cron_runs').select('message').eq('job', JOB)
        .order('ran_at', { ascending: false }).limit(1);
    const prev = (last?.[0]?.message as string | undefined) || 'up';

    let state: 'up' | 'down1' | 'down-alerted';
    if (health.ok) {
        state = 'up';
        if (prev === 'down-alerted') {
            await alertAdmins(db, `✅ <b>Office cloud (Raspberry Pi) is back online</b>\n\nFile uploads and downloads work again.`);
        }
    } else if (prev === 'down1' || prev === 'down-alerted') {
        state = 'down-alerted';
        if (prev === 'down1') {
            await alertAdmins(
                db,
                `🔴 <b>Office cloud (Raspberry Pi) is OFFLINE</b>\n\n${escapeHtml(health.detail)}\n\n` +
                `File uploads and downloads are not working. Please check that the Pi is powered on and connected to the internet.`
            );
        }
    } else {
        state = 'down1';
    }

    await logCronRun(JOB, { ok: health.ok, durationMs: health.ms, message: state });
    return NextResponse.json({ ok: health.ok, state, ms: health.ms, detail: health.detail });
}
