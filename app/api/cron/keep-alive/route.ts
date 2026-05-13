import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Keep-Alive Cron — Prevents Supabase free-tier from pausing due to inactivity.
 * 
 * Runs a lightweight query every 5 minutes to keep the DB connection warm.
 * Also keeps Vercel functions warm to avoid cold start delays every morning.
 * 
 * This solves the "app is dead every morning" problem.
 */
export async function GET(request: Request) {
    const start = Date.now();

    // Verify cron secret (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.VERCEL === '1') {
        // Allow without auth in dev, but require in production
        // Skip auth check if CRON_SECRET is not set (hobby plan)
        if (process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                status: 'error',
                message: 'Supabase not configured',
                timestamp: new Date().toISOString(),
            }, { status: 503 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Lightweight ping — just select 1 row to keep the connection alive
        const { error } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);

        const responseTime = Date.now() - start;

        if (error) {
            console.log(`[keep-alive] ⚠️ Supabase ping failed: ${error.message} (${responseTime}ms)`);
            return NextResponse.json({
                status: 'degraded',
                message: error.message,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
            }, { status: 200 });
        }

        console.log(`[keep-alive] ✅ Supabase alive (${responseTime}ms)`);
        return NextResponse.json({
            status: 'alive',
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error(`[keep-alive] ❌ Error: ${error.message}`);
        return NextResponse.json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
