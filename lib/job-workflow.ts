/**
 * Job Workflow Utility
 * Central definition of stage flows for each job type.
 * Used across Jobs page, Dispatch, Design Studio, hooks etc.
 */

export type WorkflowJobType = 'print_only' | 'design_only' | 'design_print';

// ─── Stage Flows per Job Type ────────────────────────────────────────────────

export const JOB_WORKFLOWS: Record<WorkflowJobType, string[]> = {
    design_only: [
        'new',
        'designing',
        'approval',
        'pre_print_qc',   // Internal file check before delivering print-ready file
        'delivered',
    ],
    print_only: [
        'new',
        'file_check',     // Designer verifies client-supplied file
        'pre_print_qc',   // Final check before press
        'printing',
        'quality_check',  // QC & Dispatch — physical print quality check
        'ready',
        'dispatched',
        'delivered',
    ],
    design_print: [
        'new',
        'designing',
        'approval',
        'pre_print_qc',   // Internal file check before press
        'printing',
        'quality_check',  // QC & Dispatch — physical print quality check
        'ready',
        'dispatched',
        'delivered',
    ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the next stage in the workflow for this job type */
export function getNextStage(
    jobType: string | undefined,
    currentStage: string
): string | null {
    const flow = JOB_WORKFLOWS[(jobType as WorkflowJobType)] ?? JOB_WORKFLOWS.design_print;
    const idx = flow.indexOf(currentStage);
    if (idx < 0 || idx >= flow.length - 1) return null;
    return flow[idx + 1];
}

/** Get the label for the "advance stage" button */
export function getAdvanceLabel(
    jobType: string | undefined,
    currentStage: string
): string {
    const next = getNextStage(jobType, currentStage);
    if (!next) return 'Mark Delivered';

    const labels: Record<string, string> = {
        designing: '🎨 Start Designing',
        file_check: '🔍 Start File Check',
        approval: '📤 Send for Approval',
        pre_print_qc: '✅ Pass Pre Print QC',
        printing: '🖨️ Send to Printing',
        quality_check: '📦 Pass to QC & Dispatch',
        ready: '✅ Mark Ready',
        dispatched: '🚚 Mark Dispatched',
        delivered: '🏁 Mark Delivered',
    };
    return labels[next] ?? `Move to ${next.replace(/_/g, ' ')}`;
}

/** Get the human-readable label for a stage */
export function getStageName(stage: string): string {
    const names: Record<string, string> = {
        new: 'New',
        awaiting_admin: 'Awaiting Admin',
        file_check: 'File Check',
        designing: 'Designing',
        approval: 'Client Approval',
        pre_print_qc: 'Pre Print QC',
        printing: 'Printing',
        quality_check: 'QC & Dispatch',
        finishing: 'Finishing',
        ready: 'Ready',
        dispatched: 'Dispatched',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
    };
    return names[stage] ?? stage.replace(/_/g, ' ');
}

/** Get the badge color class for a stage */
export function getStageColor(stage: string): string {
    const colors: Record<string, string> = {
        new: 'bg-gray-100 text-gray-700',
        awaiting_admin: 'bg-yellow-100 text-yellow-800',
        file_check: 'bg-purple-100 text-purple-800',
        designing: 'bg-blue-100 text-blue-800',
        approval: 'bg-orange-100 text-orange-800',
        pre_print_qc: 'bg-cyan-100 text-cyan-800',
        printing: 'bg-indigo-100 text-indigo-800',
        quality_check: 'bg-emerald-100 text-emerald-800',
        finishing: 'bg-teal-100 text-teal-800',
        ready: 'bg-green-100 text-green-800',
        dispatched: 'bg-blue-100 text-blue-800',
        delivered: 'bg-gray-100 text-gray-500',
        cancelled: 'bg-red-100 text-red-700',
    };
    return colors[stage] ?? 'bg-gray-100 text-gray-600';
}

/** Check if a stage is valid for a given job type */
export function isStageInWorkflow(jobType: string | undefined, stage: string): boolean {
    const flow = JOB_WORKFLOWS[(jobType as WorkflowJobType)] ?? JOB_WORKFLOWS.design_print;
    return flow.includes(stage);
}

/** All stages that appear in any workflow (for DB constraints etc.) */
export const ALL_WORKFLOW_STAGES = [
    'new', 'awaiting_admin', 'file_check', 'designing', 'approval',
    'pre_print_qc', 'printing', 'finishing', 'quality_check',
    'ready', 'dispatched', 'delivered', 'cancelled',
];

// ─── Label ↔ Enum Mapping ────────────────────────────────────────────────────

/**
 * Normalise any job type string to a WorkflowJobType enum key.
 * Handles both DB enum ('print_only') and display labels ('Print Only').
 * Unknown values fall back to 'design_print'.
 */
export function normalizeJobType(jobType: string | undefined): WorkflowJobType {
    if (!jobType) return 'design_print';
    const map: Record<string, WorkflowJobType> = {
        // Enum values
        print_only: 'print_only',
        design_only: 'design_only',
        design_print: 'design_print',
        // Display labels (from job_types table names)
        'Print Only': 'print_only',
        'Design Only': 'design_only',
        'Design + Print': 'design_print',
        'Design+Print': 'design_print',
        'design and print': 'design_print',
        printing: 'print_only',
    };
    return map[jobType] ?? 'design_print';
}

/** Get the ordered stage IDs for a given job type (any format) */
export function getWorkflowForJobType(jobType: string | undefined): string[] {
    return JOB_WORKFLOWS[normalizeJobType(jobType)];
}

/**
 * Filter a raw job_stages array (from DB) to only include stages
 * valid for the given job type, in the correct workflow order.
 * Always includes 'cancelled' at the end.
 *
 * @param stages  - array of stage objects with { id, name, ... }
 * @param jobType - job type string (enum or label)
 */
export function getStagesForJobType(
    stages: Array<{ id: string; name: string;[key: string]: any }>,
    jobType: string | undefined
): Array<{ id: string; name: string;[key: string]: any }> {
    const flow = getWorkflowForJobType(jobType);
    const ordered: typeof stages = [];
    for (const stageId of flow) {
        const found = stages.find(s => s.id === stageId);
        if (found) ordered.push(found);
        else ordered.push({ id: stageId, name: getStageName(stageId) }); // fallback if not in DB yet
    }
    // Always add cancelled at the end if it exists
    const cancelled = stages.find(s => s.id === 'cancelled');
    if (cancelled && !ordered.find(s => s.id === 'cancelled')) {
        ordered.push(cancelled);
    }
    return ordered;
}
