// API Route: /api/cron/optimize-db
// Runs automatically at 7 AM and 2:30 PM IST via Vercel Cron
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
    // Verify cron secret (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow if no CRON_SECRET is set (for backwards compatibility)
        if (process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const start = Date.now();

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        // FIX 2026-07-06: run_system_maintenance is only granted to authenticated/service_role,
        // so calling it with the anon key failed every night ("permission denied").
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Run the maintenance RPC
        const { data, error } = await supabase.rpc('run_system_maintenance');

        if (error) {
            console.error('[CRON] DB optimization failed:', error.message);
            return NextResponse.json({
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString(),
            }, { status: 500 });
        }

        const duration = Date.now() - start;
        console.log(`[CRON] DB optimization completed in ${duration}ms`, data);

        return NextResponse.json({
            status: 'success',
            message: `Database optimized in ${duration}ms`,
            result: data,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[CRON] DB optimization error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message || 'Unknown error',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
