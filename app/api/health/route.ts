import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const start = Date.now();

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

        // 1. Basic connectivity test
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

        // 2. Quick table health check (count queries are fast with indexes)
        const tableChecks = await Promise.all([
            supabase.from('jobs').select('id', { count: 'exact', head: true }),
            supabase.from('leads').select('id', { count: 'exact', head: true }),
            supabase.from('invoices').select('id', { count: 'exact', head: true }),
            supabase.from('clients').select('id', { count: 'exact', head: true }),
        ]);

        const tables = {
            jobs: { count: tableChecks[0].count || 0 },
            leads: { count: tableChecks[1].count || 0 },
            invoices: { count: tableChecks[2].count || 0 },
            clients: { count: tableChecks[3].count || 0 },
        };

        // 3. Try to get detailed health from RPC (if deployed)
        let systemHealth = null;
        try {
            const { data } = await supabase.rpc('get_system_health');
            if (data) systemHealth = data;
        } catch {
            // RPC not deployed yet — that's fine
        }

        return NextResponse.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                responseTime: `${dbTime}ms`,
            },
            tables,
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
