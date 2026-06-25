import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';

// =============================================================================
// PRINT RUN → JOB STAGE SYNC  (server / service-role)
// -----------------------------------------------------------------------------
// The job's board position lives in ONE field, jobs.current_stage. This route
// pushes a print run's status onto its linked jobs. It runs with the service
// role so the write succeeds even if the browser's Supabase JWT has lapsed
// (the old direct browser update silently failed with an "anon" RLS violation,
// which is why a run could be sent to the printer while its jobs stayed in
// "Ready to Print"). The caller is still authenticated via the SSR cookie.
//
//   action 'sync'   { printRunId }  → move linked jobs to the run's implied stage
//   action 'revert' { jobIds }      → back to ready_to_print, only if still printing
// =============================================================================

// Print run status → the job stage it implies on the board.
const PRINT_RUN_STAGE_MAP: Record<string, string | null> = {
    planned: null,                 // run still being assembled — leave jobs alone
    at_printer: 'printing',         // sent to printer → In Print Process
    printing_done: 'material_received',
    dispatched: 'dispatched',
};

export async function POST(request: NextRequest) {
    // 1. Confirm the caller is a logged-in user (cookie session).
    const cookieStore = await cookies();
    const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const db = createServerSupabase();
    const action = body.action || 'sync';

    // ── REVERT ───────────────────────────────────────────────────────────────
    if (action === 'revert') {
        const jobIds: string[] = (body.jobIds || []).filter(Boolean);
        if (jobIds.length === 0) return NextResponse.json({ updated: [] });
        const { error } = await db
            .from('jobs')
            .update({ current_stage: 'ready_to_print', updated_at: new Date().toISOString() })
            .in('id', jobIds)
            .eq('current_stage', 'printing');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ updated: jobIds });
    }

    // ── SYNC ─────────────────────────────────────────────────────────────────
    const printRunId: string = body.printRunId;
    if (!printRunId) return NextResponse.json({ error: 'printRunId required' }, { status: 400 });

    const { data: run, error: runErr } = await db
        .from('print_runs')
        .select('status, delivery_mode')
        .eq('id', printRunId)
        .single();
    if (runErr || !run) return NextResponse.json({ error: 'Print run not found' }, { status: 404 });

    let targetStage = PRINT_RUN_STAGE_MAP[run.status] ?? null;
    if (run.status === 'printing_done' && run.delivery_mode === 'warehouse') {
        targetStage = 'quality_check';
    }
    if (!targetStage) return NextResponse.json({ updated: [], stage: null });

    const { data: rows } = await db
        .from('print_run_jobs')
        .select('job_id')
        .eq('print_run_id', printRunId);
    const jobIds = (rows || []).map((r: any) => r.job_id).filter(Boolean);
    if (jobIds.length === 0) return NextResponse.json({ updated: [], stage: targetStage });

    const { error: updErr } = await db
        .from('jobs')
        .update({ current_stage: targetStage, updated_at: new Date().toISOString() })
        .in('id', jobIds);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ updated: jobIds, stage: targetStage });
}
