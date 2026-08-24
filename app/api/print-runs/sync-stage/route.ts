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
// Mirrors fn_print_run_stage_rank() in the database. A job that has already
// moved further down the pipeline must never be dragged back — re-syncing a run
// that is in `qc` would otherwise yank jobs the dispatch team already marked
// `ready` back into the QC queue.
const STAGE_RANK: Record<string, number> = {
    new: 0, designing: 1, approval: 2, pre_print_qc: 3, print_file_ready: 4,
    file_sent_client: 5, file_received: 6, file_check: 7, ready_to_print: 8,
    printing: 9, material_received: 10, quality_check: 11, ready: 12,
    dispatched: 13, delivered: 14, cancelled: 15,
};
const rank = (stage: string | null | undefined) =>
    stage && stage in STAGE_RANK ? STAGE_RANK[stage] : -1;

const PRINT_RUN_STAGE_MAP: Record<string, string | null> = {
    planned: null,                 // run still being assembled — leave jobs alone
    at_printer: 'printing',         // sent to printer → In Print Process
    printing_done: 'material_received',
    qc: 'quality_check',            // warehouse delivery chosen → dispatch team QC
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
    // Legacy rows: before the `qc` status existed, a warehouse delivery was left
    // sitting on 'printing_done'. Keep honouring that shape for anything not yet
    // migrated so an old run still lands its jobs in QC rather than the warehouse.
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

    // Only move jobs that are BEHIND the target stage.
    const { data: current } = await db
        .from('jobs')
        .select('id, current_stage')
        .in('id', jobIds);
    const targetRank = rank(targetStage);
    const toMove = (current || [])
        .filter((j: any) => rank(j.current_stage) < targetRank)
        .map((j: any) => j.id);
    if (toMove.length === 0) {
        return NextResponse.json({ updated: [], skipped: jobIds, stage: targetStage });
    }

    const { error: updErr } = await db
        .from('jobs')
        .update({ current_stage: targetStage, updated_at: new Date().toISOString() })
        .in('id', toMove);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ updated: toMove, stage: targetStage });
}
