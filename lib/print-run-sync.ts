// =============================================================================
// PRINT RUN → JOB STAGE SYNC  (client helpers)
// -----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH: a job's position on the Jobs board lives in ONE field,
// `jobs.current_stage`. The Print Runs / Print Planner screens are a different
// window onto the same jobs, so whenever a run's status changes (or jobs are
// added/removed) we push the implied stage back onto every linked job.
//
// IMPORTANT: the actual write goes through the /api/print-runs/sync-stage route,
// which runs with the service role. A direct browser update to `jobs` silently
// failed with an "anon" RLS violation whenever the browser's Supabase JWT had
// lapsed — that's why a run could be "At Printer" while its jobs were stuck in
// "Ready to Print". All stage writes now go server-side.
//
// Mapping (handled server-side):
//   planned        → (no change)
//   at_printer      → printing            (sent to printer = In Print Process)
//   printing_done   → material_received   (↳ warehouse delivery → quality_check)
//   dispatched      → dispatched
// =============================================================================

/**
 * Push a print run's current status onto every job linked to it.
 * Call AFTER updating the print_runs row (or after adding jobs).
 */
export async function syncRunJobsToStage(printRunId: string): Promise<void> {
    if (!printRunId) return;
    try {
        await fetch('/api/print-runs/sync-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync', printRunId }),
        });
    } catch (err) {
        console.warn('Stage sync failed:', err);
    }
}

/**
 * When a job is pulled OUT of a run (removed, or run deleted), send it back to
 * "Ready to Print" — but ONLY if it's still in `printing`, so we never drag a
 * job that has already moved further along backwards.
 */
export async function revertJobsToReadyToPrint(jobIds: string[]): Promise<void> {
    const ids = (jobIds || []).filter(Boolean);
    if (ids.length === 0) return;
    try {
        await fetch('/api/print-runs/sync-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revert', jobIds: ids }),
        });
    } catch (err) {
        console.warn('Stage revert failed:', err);
    }
}
