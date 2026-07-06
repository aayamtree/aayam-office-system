// API Route: /api/cron/warmup
// Pre-warms the app's key pages and API functions just before office opens
// (9:30 AM IST), so the first person of the day doesn't pay the cold-start cost.
//
// Why this exists: /api/cron/keep-alive only keeps ITS OWN function + the DB
// connection warm. On Vercel every page/API route is a separate serverless
// function with its own cold start — so the dashboard, jobs page, login and
// the APIs they call each need their own warm-up hit.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Production base URL — pinned (NEXT_PUBLIC_APP_URL has bitten us before with
// preview domains; see drive redirect_uri fix).
const BASE_URL = process.env.WARMUP_BASE_URL || 'https://aayam-office-system.vercel.app';

// The routes the team hits first thing in the morning.
// Pages warm the page function + middleware; APIs warm their lambdas
// (a 401/redirect response is fine — the expensive part is loading the code).
const WARM_PATHS = [
    '/login',
    '/admin/dashboard',
    '/admin/jobs',
    '/admin/cmyk-print/retail-pos',
    '/api/auth/session',
    '/api/drive/connect',
    '/api/designers/available-today',
    '/api/attendance/heartbeat',
    '/api/cron/keep-alive', // also touches the DB so Supabase is warm too
];

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.VERCEL === '1') {
        if (process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const start = Date.now();

    const results = await Promise.all(
        WARM_PATHS.map(async (path) => {
            const t = Date.now();
            try {
                const res = await fetch(`${BASE_URL}${path}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'x-warmup': '1' },
                    signal: AbortSignal.timeout(15000),
                });
                return { path, status: res.status, ms: Date.now() - t };
            } catch (err: any) {
                return { path, status: 0, error: err?.name || 'error', ms: Date.now() - t };
            }
        })
    );

    const totalMs = Date.now() - start;
    console.log(`[warmup] Completed in ${totalMs}ms`, results);

    return NextResponse.json({
        status: 'warmed',
        totalMs,
        results,
        timestamp: new Date().toISOString(),
    });
}
