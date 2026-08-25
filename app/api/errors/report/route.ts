// POST /api/errors/report — record a client-side crash.
//
// WHY THIS EXISTS
// The error boundary used to call console.error and nothing else. That log
// lives in one browser tab and dies with it, so a crashed page left no trace
// anywhere. On 2026-07-31 the Sales Reports page had been throwing
// "Cannot read properties of undefined (reading 'split')" and the only reason
// anyone found out was that Satish happened to look at the screen. The daily
// health audit could not have caught it: there was nothing written down to
// audit. This route is the "written down" part.
//
// DESIGN NOTES
//  - Writes use the service role. There is deliberately no INSERT policy on
//    page_errors, so the browser cannot write to the table directly — otherwise
//    anyone could flood it.
//  - Requires a signed-in user. Crashes matter because staff hit them; an
//    anonymous firehose is just an attack surface.
//  - Rate limited hard. A crash inside a render loop can fire hundreds of times
//    per second, and we do not want the log to be the thing that takes the DB down.
//  - Never throws back at the caller. A failure to record a crash must not turn
//    into a second crash on top of the first one.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Keep one field from becoming a megabyte of minified stack trace. */
function clip(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > max ? trimmed.slice(0, max) + '…[truncated]' : trimmed;
}

export async function POST(request: NextRequest) {
    // 30 reports/minute/caller. Enough for a genuinely broken page, not enough
    // for a render loop to hammer the database.
    const limited = rateLimit(request, { key: 'error-report', limit: 30, windowMs: 60_000 });
    if (limited) return limited;

    const gate = await requireUser();
    if (!gate.ok) return gate.response;

    try {
        const body = await request.json();

        const message = clip(body?.message, 500);
        if (!message) {
            return NextResponse.json({ error: 'message is required' }, { status: 400 });
        }

        // Chunk-load errors mean a tab was open across a deploy. The app already
        // auto-reloads for these. They are deploy noise, not bugs — logging them
        // would bury the real crashes under them.
        if (/ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(message)) {
            return NextResponse.json({ ok: true, ignored: 'chunk-load' });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            console.error('[errors/report] SUPABASE_SERVICE_ROLE_KEY missing — crash not recorded:', message);
            return NextResponse.json({ ok: false, error: 'not configured' }, { status: 200 });
        }

        const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
            auth: { persistSession: false },
        });

        const { error } = await db.from('page_errors').insert({
            path: clip(body?.path, 300) || 'unknown',
            message,
            stack: clip(body?.stack, 4000),
            component: clip(body?.component, 4000),
            // 'query' comes from lib/query-failure.ts — a PostgREST request that
            // failed without any page crashing. Those are the quiet ones, and the
            // whole reason a broken page could look like an empty one, so they are
            // recorded in the same place the daily audit already reads.
            source: ['route-error', 'query'].includes(body?.source) ? body.source : 'boundary',
            user_id: gate.user.id,
            user_email: gate.user.email || null,
            user_agent: clip(request.headers.get('user-agent'), 300),
        });

        if (error) {
            console.error('[errors/report] insert failed:', error.message);
            return NextResponse.json({ ok: false }, { status: 200 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        // Swallow. Reporting a crash must never cause one.
        console.error('[errors/report] threw:', e?.message || e);
        return NextResponse.json({ ok: false }, { status: 200 });
    }
}
