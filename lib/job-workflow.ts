/**
 * Job Workflow Utility — SINGLE SOURCE OF TRUTH for project stages.
 *
 * One master pipeline (15 stages, two phases) lives here and in the
 * `job_stages` DB table. Each project type is just a FILTERED view of it:
 *
 *   DESIGN ONLY  (6)  : new → designing → approval → pre_print_qc → print_file_ready → file_sent_client
 *   PRINT ONLY   (9)  : file_received → file_check → ready_to_print → printing → material_received → quality_check → ready → dispatched → delivered
 *   DESIGN+PRINT (12) : new → designing → approval → pre_print_qc → print_file_ready → ready_to_print → printing → material_received → quality_check → ready → dispatched → delivered
 *
 * The Design→Print BRIDGE: for design_print, "Print File Ready" (print_file_ready)
 * flows straight into "Ready to Print" (ready_to_print) — skipping "sent to client",
 * "received from client" and the printability QC, because we made & QC'd the file ourselves.
 *
 * Stage IDs are reused from the legacy set wherever the meaning matches, so existing
 * data and hardcoded references keep working. Only display names/order changed.
 */

export type WorkflowJobType = 'print_only' | 'design_only' | 'design_print';
export type StagePhase = 'design' | 'print';

// ─── Stage Flows per Job Type (filtered views of the master pipeline) ─────────

export const JOB_WORKFLOWS: Record<WorkflowJobType, string[]> = {
    design_only: [
        'new',              // Brief & Assets received
        'designing',        // Design in progress
        'approval',         // Sent for client approval
        'pre_print_qc',     // Pre-print QC
        'print_file_ready', // Print file ready
        'file_sent_client', // Print file sent to client (terminal)
    ],
    print_only: [
        'file_received',    // Print file received from client
        'file_check',       // Printability QC (design team checks it's printable)
        'ready_to_print',   // Ready to print
        'printing',         // In print process
        'material_received',// Printing material received
        'quality_check',    // QC of printing material
        'ready',            // Ready for dispatch
        'dispatched',       // Dispatched
        'delivered',        // Delivered (mode of dispatch captured here)
    ],
    design_print: [
        'new',
        'designing',
        'approval',
        'pre_print_qc',
        'print_file_ready', // ── BRIDGE ──┐
        'ready_to_print',   // ←───────────┘ design file flows straight into printing
        'printing',
        'material_received',
        'quality_check',
        'ready',
        'dispatched',
        'delivered',
    ],
};

// ─── Stage phase map (design vs print) ────────────────────────────────────────

export const STAGE_PHASE: Record<string, StagePhase> = {
    new: 'design',
    designing: 'design',
    approval: 'design',
    pre_print_qc: 'design',
    print_file_ready: 'design',
    file_sent_client: 'design',
    file_received: 'print',
    file_check: 'print',
    ready_to_print: 'print',
    printing: 'print',
    material_received: 'print',
    quality_check: 'print',
    ready: 'print',
    dispatched: 'print',
    delivered: 'print',
};

/** Which phase is a stage in? */
export function getStagePhase(stage: string): StagePhase | null {
    return STAGE_PHASE[stage] ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Master ordering of every stage across both phases. Used as a fallback so a job
 * that's sitting on a stage outside its type's flow (e.g. its job_type was changed
 * mid-pipeline) can still advance instead of getting a "stuck" card with no button.
 */
export const MASTER_STAGE_ORDER: string[] = [
    'new', 'designing', 'approval', 'pre_print_qc', 'print_file_ready', 'file_sent_client',
    'file_received', 'file_check', 'ready_to_print', 'printing', 'material_received',
    'quality_check', 'ready', 'dispatched', 'delivered',
];

/** Stages that legitimately end a pipeline (no further advance). */
export const TERMINAL_STAGES = ['file_sent_client', 'delivered', 'cancelled'];

/** Get the next stage in the workflow for this job type */
export function getNextStage(
    jobType: string | undefined,
    currentStage: string
): string | null {
    const flow = getWorkflowForJobType(jobType);
    const idx = flow.indexOf(currentStage);
    if (idx >= 0) {
        return idx >= flow.length - 1 ? null : flow[idx + 1];
    }
    // currentStage is NOT in this type's flow (mismatch). Fall back to master order:
    // advance to the first stage in this type's flow that comes after currentStage.
    const cIdx = MASTER_STAGE_ORDER.indexOf(currentStage);
    if (cIdx < 0) return flow[0] ?? null;
    for (const s of flow) {
        if (MASTER_STAGE_ORDER.indexOf(s) > cIdx) return s;
    }
    return null;
}

/** Get the label for the "advance stage" button */
export function getAdvanceLabel(
    jobType: string | undefined,
    currentStage: string
): string {
    const next = getNextStage(jobType, currentStage);
    if (!next) return 'Mark Complete';

    const labels: Record<string, string> = {
        designing: '🎨 Start Designing',
        approval: '📤 Send for Approval',
        pre_print_qc: '✅ Pass Pre-Print QC',
        print_file_ready: '📁 Print File Ready',
        file_sent_client: '📨 Send File to Client',
        file_check: '🔍 Start Printability QC',
        ready_to_print: '🟢 Ready to Print',
        printing: '🖨️ Start Printing',
        material_received: '📦 Material Received',
        quality_check: '🔎 QC Printing Material',
        ready: '✅ Ready for Dispatch',
        dispatched: '🚚 Mark Dispatched',
        delivered: '🏁 Mark Delivered',
    };
    return labels[next] ?? `Move to ${getStageName(next)}`;
}

/** Get the human-readable label for a stage (mirrors job_stages.name) */
export function getStageName(stage: string): string {
    const names: Record<string, string> = {
        new: 'Brief & Assets',
        awaiting_admin: 'Awaiting Admin',
        designing: 'Design In Progress',
        approval: 'Sent for Client Approval',
        pre_print_qc: 'Pre-Print QC',
        print_file_ready: 'Print File Ready',
        file_sent_client: 'Print File Sent to Client',
        file_received: 'File Received from Client',
        file_check: 'Printability QC',
        ready_to_print: 'Ready to Print',
        printing: 'In Print Process',
        material_received: 'Printing Material Received',
        quality_check: 'QC of Printing Material',
        finishing: 'Post Print',
        ready: 'Ready for Dispatch',
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
        designing: 'bg-purple-100 text-purple-800',
        approval: 'bg-yellow-100 text-yellow-800',
        pre_print_qc: 'bg-cyan-100 text-cyan-800',
        print_file_ready: 'bg-blue-100 text-blue-800',
        file_sent_client: 'bg-green-100 text-green-800',
        file_received: 'bg-gray-100 text-gray-700',
        file_check: 'bg-cyan-100 text-cyan-800',
        ready_to_print: 'bg-indigo-100 text-indigo-800',
        printing: 'bg-blue-100 text-blue-800',
        material_received: 'bg-teal-100 text-teal-800',
        quality_check: 'bg-emerald-100 text-emerald-800',
        finishing: 'bg-teal-100 text-teal-800',
        ready: 'bg-indigo-100 text-indigo-800',
        dispatched: 'bg-orange-100 text-orange-800',
        delivered: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-700',
    };
    return colors[stage] ?? 'bg-gray-100 text-gray-600';
}

/** Check if a stage is valid for a given job type */
export function isStageInWorkflow(jobType: string | undefined, stage: string): boolean {
    return getWorkflowForJobType(jobType).includes(stage);
}

/** All stages that appear in any workflow (for DB constraints etc.) */
export const ALL_WORKFLOW_STAGES = [
    'new', 'designing', 'approval', 'pre_print_qc', 'print_file_ready', 'file_sent_client',
    'file_received', 'file_check', 'ready_to_print', 'printing', 'material_received',
    'quality_check', 'ready', 'dispatched', 'delivered', 'cancelled',
];

// ─── Label ↔ Enum Mapping ────────────────────────────────────────────────────

/**
 * Normalise any job type string to a WorkflowJobType enum key.
 * Handles DB enum ('print_only'), display labels ('Print Only') and legacy strays.
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
        'Design': 'design_only',
        'Design + Print': 'design_print',
        'Design+Print': 'design_print',
        'design and print': 'design_print',
        printing: 'print_only',
        // Design Studio's New Project form wrote its own vocabulary for the same
        // three types until 2026-09-08 ("Design" / "Printing" / "Design + Printing",
        // 403 jobs). The form now writes the master names, but these stay so the
        // pre-rename rows and any old bookmark still resolve. 'Printing' with a
        // capital P matched nothing before and fell through to design_print,
        // silently filing 20 print-only jobs as design work.
        'Printing': 'print_only',
        'Design + Printing': 'design_print',
    };
    return map[jobType] ?? 'design_print';
}

/** Get the ordered stage IDs for a given job type (any format) */
export function getWorkflowForJobType(jobType: string | undefined): string[] {
    return JOB_WORKFLOWS[normalizeJobType(jobType)];
}

// ─── Project type short code + badge (DO / PO / DP) ───────────────────────────

/** Short code for the project type: DO = Design Only, PO = Print Only, DP = Design + Print. */
export function getProjectTypeCode(jobType: string | undefined): 'DO' | 'PO' | 'DP' {
    const t = normalizeJobType(jobType);
    return t === 'design_only' ? 'DO' : t === 'print_only' ? 'PO' : 'DP';
}

/** Full label for the project type code. */
export function getProjectTypeLabel(jobType: string | undefined): string {
    const t = normalizeJobType(jobType);
    return t === 'design_only' ? 'Design Only' : t === 'print_only' ? 'Print Only' : 'Design + Print';
}

/** Tailwind badge classes for the DO/PO/DP chip. */
export function getProjectTypeBadgeClass(jobType: string | undefined): string {
    const t = normalizeJobType(jobType);
    if (t === 'design_only') return 'bg-violet-100 text-violet-700 border border-violet-300';
    if (t === 'print_only') return 'bg-orange-100 text-orange-700 border border-orange-300';
    return 'bg-blue-100 text-blue-700 border border-blue-300';
}

/**
 * Filter a raw job_stages array (from DB) to only include stages
 * valid for the given job type, in the correct workflow order.
 * Always includes 'cancelled' at the end if present.
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
    const cancelled = stages.find(s => s.id === 'cancelled');
    if (cancelled && !ordered.find(s => s.id === 'cancelled')) {
        ordered.push(cancelled);
    }
    return ordered;
}

// ─── When is a job DONE? ──────────────────────────────────────────────────────
//
// A job has two lives, and the board was only tracking one of them:
//
//   1. the WORK    — new → … → file sent to client / delivered
//   2. the MONEY   — pending → paid
//
// Because only the work life had stages, a job that finished in June was still
// sitting on the kanban in August. 248 of 270 cards were finished work. A board
// you cannot read in one glance is a board nobody reads.
//
// So: a job leaves the board when the work is done AND the money is settled.
// Finished-but-unpaid is not a production problem, it is a collection problem —
// it belongs on the money screen, not in the production column.

/** How long a finished job stays visible on the board before dropping into Closed. */
export const RECENTLY_FINISHED_DAYS = 7;

/** The shape any of the rules below need. Deliberately loose — every job list
 *  in the app selects a different set of columns. */
export interface JobCloseState {
    current_stage?: string | null;
    payment_status?: string | null;
    total_amount?: number | null;
    amount_received?: number | null;
    dispatched_at?: string | null;
    completed_date?: string | null;
    updated_at?: string | null;
}

/** Nothing left to do in production. */
export function isWorkFinished(job: JobCloseState): boolean {
    return TERMINAL_STAGES.includes(job.current_stage || '');
}

/**
 * Money settled. Paid outright, or nothing was owed in the first place —
 * free/non-billable design work carries a zero balance and must not sit
 * forever on a "waiting for payment" list that nobody can ever clear.
 */
export function isMoneySettled(job: JobCloseState): boolean {
    if (job.payment_status === 'paid') return true;
    const balance = (Number(job.total_amount) || 0) - (Number(job.amount_received) || 0);
    return balance <= 0;
}

/** Closed = work done AND money settled. Cancelled is always closed. */
export function isJobClosed(job: JobCloseState): boolean {
    if (job.current_stage === 'cancelled') return true;
    return isWorkFinished(job) && isMoneySettled(job);
}

/** Work delivered, money still out. A collection problem, not a production one. */
export function isAwaitingPayment(job: JobCloseState): boolean {
    if (job.current_stage === 'cancelled') return false;
    return isWorkFinished(job) && !isMoneySettled(job);
}

/**
 * The date the work finished. Prefer the trigger-stamped dispatch date, then the
 * completion date, and only fall back to updated_at — which moves on any edit and
 * would otherwise quietly resurrect an old job onto the board.
 */
export function finishedAt(job: JobCloseState): Date | null {
    const iso = job.dispatched_at || job.completed_date || job.updated_at || null;
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Finished within the last N days — still worth a victory lap on the board. */
export function isRecentlyFinished(job: JobCloseState, days = RECENTLY_FINISHED_DAYS): boolean {
    const d = finishedAt(job);
    if (!d) return false;
    return (Date.now() - d.getTime()) <= days * 86_400_000;
}

/**
 * Does this job belong on the live production board?
 * Everything still in progress, plus anything finished in the last week so the
 * board still shows work completing rather than jumping straight to empty.
 */
export function isOnActiveBoard(job: JobCloseState, days = RECENTLY_FINISHED_DAYS): boolean {
    if (job.current_stage === 'cancelled') return false;
    if (!isWorkFinished(job)) return true;
    return isRecentlyFinished(job, days);
}

/** 1-based position + total count of a stage within its type's pipeline (for "Step 3 of 12"). */
export function getStageProgress(
    jobType: string | undefined,
    currentStage: string
): { index: number; total: number; percent: number } {
    const flow = getWorkflowForJobType(jobType);
    const idx = flow.indexOf(currentStage);
    const total = flow.length;
    const index = idx < 0 ? 0 : idx + 1;
    return { index, total, percent: total ? Math.round((index / total) * 100) : 0 };
}
