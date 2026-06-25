// =============================================================================
// PRINT RUN → JOB STAGE SYNC
// -----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH: a job's position on the Jobs board lives in ONE field,
// `jobs.current_stage`. The Print Runs / Print Planner screens are just a
// different window onto the same jobs, so whenever a print run's status changes
// (or jobs are added to it), we push the implied stage back onto every linked
// job. That way a change "downstream" (in a print run) always shows up
// "upstream" on the Jobs board automatically — there is only one copy to change.
//
// Mapping (print run status  →  job stage on the board):
//   planned        → (no change)   run is still being assembled
//   at_printer      → printing       "sent to printer" = In Print Process
//   printing_done   → material_received   printed stock back from printer
//        ↳ if delivery_mode = warehouse → quality_check (handed to QC team)
//   dispatched      → dispatched
// =============================================================================

import { supabase } from '@/lib/supabase';

/** Print run status → the job stage it implies on the board. */
export const PRINT_RUN_STAGE_MAP: Record<string, string | null> = {
    planned: null,                 // run being built — leave jobs in ready_to_print
    at_printer: 'printing',         // sent to printer → In Print Process
    printing_done: 'material_received',
    dispatched: 'dispatched',
};

/**
 * Push a print run's current status onto every job linked to it.
 *
 * Re-reads the run so callers don't have to pass status/delivery_mode — call it
 * AFTER you've updated the print_runs row (or after adding/removing jobs) and it
 * will move the linked jobs to the matching board stage.
 *
 * Returns the job IDs that were updated (empty array = nothing to do).
 */
export async function syncRunJobsToStage(printRunId: string): Promise<string[]> {
    if (!printRunId) return [];

    // 1. What state is the run in now?
    const { data: run, error: runErr } = await supabase
        .from('print_runs')
        .select('status, delivery_mode')
        .eq('id', printRunId)
        .single();
    if (runErr || !run) return [];

    // 2. Work out the target job stage.
    let targetStage = PRINT_RUN_STAGE_MAP[run.status] ?? null;
    // Warehouse delivery at "printing done" means it's gone to the QC team.
    if (run.status === 'printing_done' && run.delivery_mode === 'warehouse') {
        targetStage = 'quality_check';
    }
    if (!targetStage) return []; // planned / unknown → don't touch jobs

    // 3. Which jobs are in this run?
    const { data: rows } = await supabase
        .from('print_run_jobs')
        .select('job_id')
        .eq('print_run_id', printRunId);
    const jobIds = (rows || []).map(r => r.job_id).filter(Boolean);
    if (jobIds.length === 0) return [];

    // 4. Move them all to the target stage.
    const { error: updErr } = await supabase
        .from('jobs')
        .update({ current_stage: targetStage, updated_at: new Date().toISOString() })
        .in('id', jobIds);
    if (updErr) return [];

    return jobIds;
}

/**
 * When a job is pulled OUT of a print run (removed, or the run is deleted),
 * send it back to "Ready to Print" — but ONLY if it's still sitting in
 * `printing`. If it has already moved further along (material received, QC,
 * dispatched, etc.) we leave it alone so we never drag a job backwards.
 */
export async function revertJobsToReadyToPrint(jobIds: string[]): Promise<void> {
    const ids = (jobIds || []).filter(Boolean);
    if (ids.length === 0) return;
    await supabase
        .from('jobs')
        .update({ current_stage: 'ready_to_print', updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('current_stage', 'printing');
}
