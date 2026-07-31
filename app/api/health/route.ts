// GET /api/health — uptime probe + operator diagnostics.
//
// This route is PUBLIC (Vercel's daily cron hits it, and any uptime monitor
// should be able to), so it is split into two layers:
//
//   Public       — is the app up, is the database reachable, how fast.
//                  Nothing here reveals anything about the business.
//   Privileged   — row counts, which env vars are configured, DB internals.
//                  Only for an admin session or the cron secret.
//
// Why the split: the counts used to be read with the ANON key, so RLS (correctly)
// returned nothing and every number showed 0 — the check was decoration. Reading
// them with the service role makes them real, but real counts tell any passer-by
// how many clients and jobs the business has. So the numbers became meaningful
// and gated at the same time.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api-auth';
import { sendToChat, escapeHtml } from '@/lib/telegram-groups';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Admin session, or Vercel's cron calling with the shared secret. */
async function isPrivileged(request: NextRequest): Promise<boolean> {
    const secret = process.env.CRON_SECRET;
    if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true;

    try {
        const gate = await requireAdmin();
        return gate.ok;
    } catch {
        return false;
    }
}

/**
 * Telegram the admin group when the daily audit finds something wrong.
 *
 * The audit existed before this and ran every night at 3:45 AM, but its output
 * went into a Vercel log nobody opens. That is why a crashing Sales Reports page
 * survived undetected: the check that could have run wasn't reporting to a human.
 * Failures here are swallowed — a broken alert must not fail the health check
 * itself, which would be its own confusing outage.
 */
async function alertAdmins(db: any, payload: any) {
    try {
        const [{ data: groups }, { data: admins }] = await Promise.all([
            db.from('telegram_groups').select('chat_id').eq('is_active', true).eq('department', 'admin'),
            db.from('profiles').select('telegram_chat_id').eq('role', 'admin').eq('is_active', true)
                .not('telegram_chat_id', 'is', null),
        ]);

        const targets = new Set<string>();
        for (const g of groups || []) if (g.chat_id) targets.add(g.chat_id);
        for (const a of admins || []) if (a.telegram_chat_id) targets.add(a.telegram_chat_id);
        if (!targets.size) return;

        const lines = ['⚠️ <b>Daily health audit — issues found</b>', ''];
        for (const reason of payload.degradedReasons) lines.push(`• ${escapeHtml(reason)}`);

        if (payload.pageErrors?.top?.length) {
            lines.push('', '<b>Crashing pages</b>');
            for (const c of payload.pageErrors.top.slice(0, 5)) {
                lines.push(`• <code>${escapeHtml(c.path)}</code> ×${c.count}`);
                lines.push(`   ${escapeHtml(String(c.message).slice(0, 120))}`);
            }
        }

        lines.push('', `DB ${escapeHtml(payload.database?.responseTime || '?')}`);

        const text = lines.join('\n');
        for (const chatId of Array.from(targets)) {
            await sendToChat(chatId, text, '/admin/system-health');
        }
    } catch (e: any) {
        console.error('[health] admin alert failed:', e?.message || e);
    }
}

export async function GET(request: NextRequest) {
    const start = Date.now();

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!supabaseUrl || !anonKey) {
            return NextResponse.json({
                status: 'error',
                message: 'Supabase not configured',
                timestamp: new Date().toISOString(),
            }, { status: 503 });
        }

        // 1. Connectivity — anon key on purpose. This proves the public path to
        //    the database works, which is what an uptime check should measure.
        const supabase = createClient(supabaseUrl, anonKey);
        const dbStart = Date.now();
        const { error: pingError } = await supabase.from('profiles').select('id').limit(1);
        const dbTime = Date.now() - dbStart;

        if (pingError) {
            return NextResponse.json({
                status: 'degraded',
                timestamp: new Date().toISOString(),
                database: { connected: false, error: pingError.message, responseTime: `${dbTime}ms` },
                responseTime: `${Date.now() - start}ms`,
            }, { status: 200 });
        }

        const base = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: { connected: true, responseTime: `${dbTime}ms` },
        };

        if (!(await isPrivileged(request))) {
            return NextResponse.json({
                ...base,
                detail: 'Sign in as an admin to see table counts and configuration.',
                responseTime: `${Date.now() - start}ms`,
            });
        }

        // ---- Privileged from here down -------------------------------------

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const db = serviceKey
            ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
            : supabase;

        // 2. Real row counts (service role bypasses RLS, so these are the truth).
        //    head:true means no rows travel back — just the count.
        const [jobs, leads, invoices, clients] = await Promise.all([
            db.from('jobs').select('id', { count: 'exact', head: true }),
            db.from('leads').select('id', { count: 'exact', head: true }),
            db.from('invoices').select('id', { count: 'exact', head: true }),
            db.from('clients').select('id', { count: 'exact', head: true }),
        ]);

        const tables = {
            jobs: { count: jobs.count ?? 0 },
            leads: { count: leads.count ?? 0 },
            invoices: { count: invoices.count ?? 0 },
            clients: { count: clients.count ?? 0 },
        };

        // 3. Optional deeper health RPC, if it has been deployed.
        let systemHealth = null;
        try {
            const { data } = await db.rpc('get_system_health');
            if (data) systemHealth = data;
        } catch {
            // Not deployed — fine.
        }

        // 4. Which env vars the background jobs depend on are actually present.
        //    BOOLEANS ONLY — never the values. Added because sendToChat() fails
        //    silently without TELEGRAM_BOT_TOKEN, so a misnamed variable made the
        //    7:30pm EOD report vanish with nothing anywhere to explain it.
        const config = {
            telegramBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
            cronSecret: !!process.env.CRON_SECRET,
            vapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
            vapidPublicKey: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            anthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
            googleServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
            supabaseServiceRole: !!serviceKey,
        };

        // 5. Telegram delivery over the last 7 days.
        //    A configured bot token only proves the variable exists. This says
        //    whether alerts are actually landing: any row where fewer groups
        //    accepted the message than were targeted is a real, named failure.
        let telegram: any = null;
        try {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: alerts } = await db
                .from('telegram_stage_alerts')
                .select('groups_targeted, telegram_sent, last_error, sent_at')
                .gte('sent_at', since)
                .order('sent_at', { ascending: false });

            const rows = alerts || [];
            const failed = rows.filter((r: any) => (r.telegram_sent || 0) < (r.groups_targeted || 0));
            const unrouted = rows.filter((r: any) => (r.groups_targeted || 0) === 0);
            telegram = {
                alerts7d: rows.length,
                delivered: rows.length - failed.length - unrouted.length,
                failed: failed.length,
                unrouted: unrouted.length, // department has no group mapped
                lastError: failed[0]?.last_error || null,
                lastAlertAt: rows[0]?.sent_at || null,
            };
        } catch {
            // Column set not migrated yet — omit rather than fail the check.
        }

        // 6. Page crashes — the check that was missing.
        //    Everything above this point is infrastructure: is the DB up, are the
        //    env vars set, did Telegram deliver. All of it passed on 2026-07-31
        //    while the Sales Reports page was throwing on every load, because a
        //    page that crashes in the browser looks perfectly healthy from here.
        //    page_errors is written by /api/errors/report from the error boundary,
        //    so a crash now leaves a trace this check can find.
        let pageErrors: any = null;
        try {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: crashes } = await db
                .from('page_errors')
                .select('path, message, occurred_at, user_email')
                .gte('occurred_at', since)
                .is('resolved_at', null)
                .order('occurred_at', { ascending: false })
                .limit(200);

            const rows = crashes || [];

            // Group by page + message: one broken page hit by five staff is one
            // problem, not five. Counting raw rows would overstate it.
            const grouped = new Map<string, { path: string; message: string; count: number; lastSeen: string }>();
            for (const r of rows) {
                const key = `${r.path}::${r.message}`;
                const hit = grouped.get(key);
                if (hit) {
                    hit.count += 1;
                } else {
                    grouped.set(key, { path: r.path, message: r.message, count: 1, lastSeen: r.occurred_at });
                }
            }

            const distinct = Array.from(grouped.values()).sort((a, b) => b.count - a.count);
            pageErrors = {
                total24h: rows.length,
                distinct: distinct.length,
                affectedPages: Array.from(new Set(rows.map((r: any) => r.path))),
                top: distinct.slice(0, 10),
            };
        } catch {
            // Table not migrated yet — omit rather than fail the whole check.
        }

        // A crashing page is not "healthy", whatever the database says. This is
        // the line that would have turned 2026-07-31 into an alert instead of a
        // discovery. Uptime monitors key off `status`, so it has to move.
        const degradedReasons: string[] = [];
        if (pageErrors && pageErrors.distinct > 0) {
            degradedReasons.push(`${pageErrors.distinct} page crash type(s) in the last 24h`);
        }
        if (!config.telegramBotToken) degradedReasons.push('TELEGRAM_BOT_TOKEN missing');
        if (!config.supabaseServiceRole) degradedReasons.push('SUPABASE_SERVICE_ROLE_KEY missing');
        if (telegram && telegram.failed > 0) {
            degradedReasons.push(`${telegram.failed} Telegram alert(s) failed to deliver`);
        }

        const payload = {
            ...base,
            status: degradedReasons.length ? 'degraded' : 'healthy',
            degradedReasons,
            tables,
            config,
            telegram,
            pageErrors,
            systemHealth,
            responseTime: `${Date.now() - start}ms`,
        };

        // 7. Tell someone. A daily audit nobody reads is not an audit. Only the
        //    cron alerts — an admin loading this page should not fire Telegram.
        const isCron = !!process.env.CRON_SECRET &&
            request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
        if (isCron && degradedReasons.length) {
            await alertAdmins(db, payload);
        }

        return NextResponse.json(payload);

    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            responseTime: `${Date.now() - start}ms`,
        }, { status: 500 });
    }
}
