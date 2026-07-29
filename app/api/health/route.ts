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

        return NextResponse.json({
            ...base,
            tables,
            config,
            telegram,
            systemHealth,
            responseTime: `${Date.now() - start}ms`,
        });

    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            responseTime: `${Date.now() - start}ms`,
        }, { status: 500 });
    }
}
