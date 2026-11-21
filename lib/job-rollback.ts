/**
 * Job rollback — one rule for every stage.
 *
 * The database function fn_rollback_job does the real work: admin only, reason
 * required, to any other stage of the job's own flow (up to Ready for Dispatch), undoes what the later
 * stage created (dispatch record, dispatch dates, package) and writes who / when / why
 * into job_stage_history (is_rollback = true) and activity_logs (action = 'rollback').
 */
import { supabase } from '@/lib/supabase';
import { getWorkflowForJobType, getStageName } from '@/lib/job-workflow';

export interface RollbackTarget { stage: string; label: string }

/**
 * The job's own flow with the "Pending QC" step (stored as 'finishing', shown as "Post Print")
 * placed just before "QC of Printing Material". The QC-Dispatch screen uses that step as its
 * "Pending QC" list, but it is not part of the normal flow, so we add it here.
 */
function rollbackFlow(jobType: string | undefined): string[] {
    const flow = [...getWorkflowForJobType(jobType)];
    const q = flow.indexOf('quality_check');
    if (q >= 0 && !flow.includes('finishing')) flow.splice(q, 0, 'finishing');
    return flow;
}

function rollbackLabel(stage: string): string {
    return stage === 'finishing' ? 'Pending QC (Post Print)' : getStageName(stage);
}

/**
 * Stages the admin can move a job to: every stage of its own flow except the current one,
 * from the first stage up to "Ready for Dispatch". Going forward past that is not offered —
 * dispatch must go through the dispatch screen so the dispatch record is created.
 */
export function getRollbackTargets(jobType: string | undefined, currentStage: string): RollbackTarget[] {
    const flow = rollbackFlow(jobType);
    if (flow.indexOf(currentStage) < 0) return [];
    const lastAllowed = flow.indexOf('ready') >= 0 ? flow.indexOf('ready') : flow.length - 1;
    return flow
        .filter((s, i) => s !== currentStage && i <= lastAllowed)
        .map(stage => ({ stage, label: rollbackLabel(stage) }));
}

/** Pre-selected target: the stage just before the current one in the flow. */
export function defaultRollbackTarget(jobType: string | undefined, currentStage: string, targets: RollbackTarget[]): string {
    const flow = rollbackFlow(jobType);
    const cur = flow.indexOf(currentStage);
    const before = targets.filter(t => flow.indexOf(t.stage) < cur);
    return (before.length ? before[before.length - 1] : targets[0])?.stage ?? '';
}

/** Plain-words list of what the rollback will undo, so the admin sees it before confirming. */
export function describeRollbackEffects(jobType: string | undefined, currentStage: string, toStage: string): string[] {
    const flow = rollbackFlow(jobType);
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
