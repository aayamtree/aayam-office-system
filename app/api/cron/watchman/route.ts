// /api/cron/watchman — deliver what the daily watchman needs Satish to answer,
// and notice when the watchman itself has stopped showing up.
//
// THE ARRANGEMENT THIS SERVES
// Satish asked Claude to watch the app for him and only interrupt when a human
// decision is genuinely required. He chose the careful version of that: Claude
// changes NOTHING without his yes. So the daily audit stopped Telegramming him
// a technical list, and instead the watchman writes a plain-language request
// into watchman_notices. This route is the postman.
//
// WHY THE POSTMAN IS SEPARATE FROM THE WATCHMAN
// The watchman is a Claude session. It runs once a morning and then it is gone,
// and its sandbox cannot reach api.telegram.org at all. If it delivered its own
// messages, then "Claude never ran" and "Claude had nothing to say" would arrive
// as the same thing: silence. Splitting them means a notice written at 9:07 is
// delivered even if the session that wrote it has ended, retried if Telegram is
// down, and left in the table with an error on it if delivery keeps failing.
//
// THE DEAD MAN'S HANDLE
// Silence is now the normal, expected state — which makes a silently dead
// watchman the most dangerous failure in the whole arrangement. So this route
// also checks the watchman's own heartbeat, and if nobody has checked the app
// for three days it says so, unprompted. That check is the reason Satish can
// treat quiet mornings as good news.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron } from '@/lib/api-auth';
import { sendToChatResult, escapeHtml } from '@/lib/telegram-groups';
import { logCronRun } from '@/lib/cron-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Give up on a notice after this many failed sends, and say so in the row. */
const MAX_ATTEMPTS = 5;

/** How long the watchman may be silent before that silence is itself the news. */
const HEARTBEAT_GRACE_HOURS = 72;

const HEADERS: Record<string, { icon: string; label: string; ask: string }> = {
    approval: {
        icon: '✋',
        label: 'Needs your OK',
        ask: 'Reply to Claude with yes or no. Nothing has been changed.',
    },
    decision: {
        icon: '🤔',
        label: 'Needs your decision',
        ask: 'Only you can answer this one — it is a business call, not a technical one.',
    },
    alert: {
        icon: '🔴',
        label: 'You should know now',
        ask: '',
    },
    summary: {
        icon: '📋',
        label: 'Weekly summary',
        ask: '',
    },
};

function serviceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

/** The admin group, plus any admin who has linked their own Telegram. */
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

function render(notice: any): string {
    const h = HEADERS[notice.kind] || HEADERS.alert;
    const lines = [
        `${h.icon} <b>${escapeHtml(h.label)}</b>`,
        '',
        `<b>${escapeHtml(notice.title)}</b>`,
        '',
        // The watchman writes this in plain business language. It is passed
        // through escaped and otherwise untouched — this route deliberately
        // does not reformat, summarise or truncate it.
        escapeHtml(notice.body),
    ];
    if (h.ask) lines.push('', `<i>${escapeHtml(h.ask)}</i>`);
    return lines.join('\n');
}

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const started = Date.now();
    const db = serviceClient();
    if (!db) {
        return NextResponse.json({ error: 'service role not configured' }, { status: 503 });
    }

    try {
        const targets = await adminTargets(db);

        // ---- 1. Deliver anything waiting -------------------------------------
        const { data: pending, error } = await db
            .from('watchman_notices')
            .select('id, kind, title, body, app_path, attempts')
            .eq('status', 'pending')
            .lt('attempts', MAX_ATTEMPTS)
            .order('created_at', { ascending: true })
            .limit(10);

        if (error) throw new Error(`could not read notices: ${error.message}`);

        let sent = 0;
        let failed = 0;

        for (const notice of pending || []) {
            if (!targets.length) {
                // No Telegram target configured. Do NOT mark it sent — that would
                // quietly throw away a request for approval.
                await db.from('watchman_notices')
                    .update({ attempts: notice.attempts + 1, last_error: 'no admin telegram target configured' })
                    .eq('id', notice.id);
                failed++;
                continue;
            }

            const text = render(notice);
            const results = await Promise.all(
                targets.map(chatId => sendToChatResult(chatId, text, notice.app_path || '/admin/system-health')),
            );
            const ok = results.some(r => r.ok); // one target reached is delivered
            const firstError = results.find(r => !r.ok)?.error || null;

            if (ok) {
                await db.from('watchman_notices')
                    .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: notice.attempts + 1, last_error: firstError })
                    .eq('id', notice.id);
                sent++;
            } else {
                // Stays pending and is retried on the next run — unless it has
                // exhausted its attempts, in which case it is marked failed so
                // it shows up as a problem instead of retrying forever.
                const attempts = notice.attempts + 1;
                await db.from('watchman_notices')
                    .update({
                        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
                        attempts,
                        last_error: firstError,
                    })
                    .eq('id', notice.id);
                failed++;
            }
        }

        // ---- 2. Is the watchman still alive? ---------------------------------
        // Only checked once a day, at the first run after 6pm IST, so a dead
        // watchman produces one message a day rather than one every 15 minutes.
        let heartbeat: string | null = null;
        const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const isEveningRun = nowIST.getUTCHours() === 18;

        if (isEveningRun) {
            const { data: last } = await db
                .from('cron_runs')
                .select('ran_at')
                .eq('job', 'watchman')
                .order('ran_at', { ascending: false })
                .limit(1);

            const lastRun = last?.[0]?.ran_at ? new Date(last[0].ran_at).getTime() : 0;
            const hoursQuiet = lastRun ? (Date.now() - lastRun) / 36e5 : Infinity;

            if (hoursQuiet > HEARTBEAT_GRACE_HOURS) {
                heartbeat = lastRun ? `${Math.floor(hoursQuiet / 24)} days` : 'never';
                // Deduped like any other notice: one open "watchman is missing"
                // at a time, not one per evening.
                await db.from('watchman_notices').insert({
                    kind: 'alert',
                    dedupe_key: 'watchman-missing',
                    title: 'Nobody has checked your app for 3 days',
                    body:
                        'Claude checks the app every morning and only messages you when something needs you. ' +
                        'That check has not run since ' + (lastRun ? new Date(lastRun).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'it was set up') + '. ' +
                        'So quiet mornings no longer mean everything is fine — they mean nobody is looking. ' +
                        'Open Claude and say "run the watchman" to start it again.',
                    app_path: '/admin/system-health',
                });
            }
        }

        await logCronRun('watchman-dispatch', {
            ok: true,
            durationMs: Date.now() - started,
            message: `sent ${sent}, failed ${failed}${heartbeat ? `, watchman quiet ${heartbeat}` : ''}`,
        });

        return NextResponse.json({
            ok: true,
            sent,
            failed,
            targets: targets.length,
            watchmanQuietFor: heartbeat,
            responseTime: `${Date.now() - started}ms`,
        });
    } catch (e: any) {
        await logCronRun('watchman-dispatch', {
            ok: false,
            durationMs: Date.now() - started,
            message: e?.message || String(e),
        });
        return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
    }
}
