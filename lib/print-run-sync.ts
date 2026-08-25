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
//   printing_done   → material_received
//   qc              → quality_check       (warehouse delivery, awaiting dispatch QC)
//   dispatched      → dispatched
// =============================================================================

/**
 * Push a print run's current status onto every job linked to it.
 * Call AFTER updating the print_runs row (or after adding jobs).
 */
export async function syncRunJobsToStage(printRunId: string): Promise<boolean> {
    if (!printRunId) return false;
    try {
        const res = await fetch('/api/print-runs/sync-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync', printRunId }),
        });
        // fetch() only rejects on a network-level failure, so a 401 from a lapsed
        // session used to look exactly like success — the run's card moved on
        // while its jobs stayed put. Report the status back to the caller.
        if (!res.ok) {
            console.warn('Stage sync rejected:', res.status, await res.text().catch(() => ''));
            return false;
        }
        return true;
    } catch (err) {
        console.warn('Stage sync failed:', err);
        return false;
    }
}

/**
 * When a job is pulled OUT of a run (removed, or run deleted), send it back to
 * "Ready to Print" — but ONLY if it's still in `printing`, so we never drag a
 * job that has already moved further along backwards.
 */
export interface RevertOutcome {
    /** false only when the request itself failed — not when zero jobs qualified. */
    ok: boolean;
    /** How many jobs were actually moved back. */
    moved: number;
    /** How many were asked about. */
    requested: number;
}

export async function revertJobsToReadyToPrint(jobIds: string[]): Promise<RevertOutcome> {
    const ids = (jobIds || []).filter(Boolean);
    if (ids.length === 0) return { ok: true, moved: 0, requested: 0 };
    try {
        // fetch only rejects on a network fault. A 401 from a lapsed session or a
        // 500 from the handler resolves like a success, so the status has to be
        // read — otherwise the caller cheerfully reports the jobs were moved back
        // when nothing happened, and only a console warning says otherwise.
        const res = await fetch('/api/print-runs/sync-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revert', jobIds: ids }),
        });
        if (!res.ok) {
            console.warn('Stage revert refused:', res.status, res.statusText);
            return { ok: false, moved: 0, requested: ids.length };
        }
        const json = await res.json().catch(() => ({}));
        return { ok: true, moved: Number(json?.moved ?? 0), requested: ids.length };
    } catch (err) {
        console.warn('Stage revert failed:', err);
        return { ok: false, moved: 0, requested: ids.length };
    }
}
