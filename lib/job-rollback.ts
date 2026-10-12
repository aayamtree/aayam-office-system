/**
 * Job rollback — one rule for every stage.
 *
 * The database function fn_rollback_job does the real work: admin only, reason
 * required, only to an EARLIER stage of the job's own flow, undoes what the later
 * stage created (dispatch record, dispatch dates, package) and writes who / when / why
 * into job_stage_history (is_rollback = true) and activity_logs (action = 'rollback').
 */
import { supabase } from '@/lib/supabase';
import { getWorkflowForJobType, getStageName } from '@/lib/job-workflow';

export interface RollbackTarget { stage: string; label: string }

/** Stages a job can be rolled back to: everything before its current stage in its own flow. */
export function getRollbackTargets(jobType: string | undefined, currentStage: string): RollbackTarget[] {
    const flow = getWorkflowForJobType(jobType);
    const idx = flow.indexOf(currentStage);
    if (idx <= 0) return [];
    return flow.slice(0, idx).map(stage => ({ stage, label: getStageName(stage) }));
}

/** Plain-words list of what the rollback will undo, so the admin sees it before confirming. */
export function describeRollbackEffects(jobType: string | undefined, currentStage: string, toStage: string): string[] {
    const flow = getWorkflowForJobType(jobType);
    const from = flow.indexOf(currentStage);
    const to = flow.indexOf(toStage);
    const at = (s: string) => flow.indexOf(s);
    const out: string[] = [];
    if (to < 0 || from < 0) return out;
    if (from >= at('dispatched') && at('dispatched') >= 0 && to < at('dispatched')) {
        out.push('The dispatch record is removed (a copy is kept in the history) and the dispatch / delivery dates are cleared.');
    }
    if (to < at('ready') && at('ready') >= 0 && from >= at('ready')) {
        out.push('The job is taken out of its package.');
    }
    if (toStage === 'designing') out.push('Counts as one more design revision.');
    if (to < at('printing') && at('printing') >= 0) out.push('If the job is inside a print run you must remove it from the run first.');
    return out;
}

export async function rollbackJob(
    jobId: string,
    toStage: string,
    reason: string
): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.rpc('fn_rollback_job', {
        p_job_id: jobId,
        p_to_stage: toStage,
        p_reason: reason.trim(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
