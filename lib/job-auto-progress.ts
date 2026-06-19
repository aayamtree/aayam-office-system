// =============================================
// JOB AUTO-PROGRESSION
// Auto-move jobs to the next stage based on events
// =============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

type JobStage =
    | 'new' | 'designing' | 'approval' | 'pre_print_qc' | 'print_file_ready' | 'file_sent_client'
    | 'file_received' | 'file_check' | 'ready_to_print' | 'printing' | 'material_received'
    | 'quality_check' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';

interface AutoProgressResult {
    progressed: boolean;
    fromStage?: string;
    toStage?: string;
    error?: string;
}

/**
 * Auto-progress a job to the next stage based on a trigger event.
 * Returns whether the job was progressed and to which stage.
 */
export async function autoProgressJob(
    jobId: string,
    trigger: 'design_completed' | 'client_approved' | 'qc_passed' | 'dispatch_created' | 'payment_complete'
): Promise<AutoProgressResult> {
    const supabase = getSupabase();
    if (!supabase) return { progressed: false, error: 'Database not configured' };

    // Get current job stage
    const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('current_stage, job_number')
        .eq('id', jobId)
        .single();

    if (fetchError || !job) return { progressed: false, error: fetchError?.message || 'Job not found' };

    const currentStage = job.current_stage as JobStage;

    // Auto-progression rules
    const progressionMap: Record<string, { from: JobStage[]; to: JobStage }> = {
        'design_completed': { from: ['new', 'designing'], to: 'approval' },
        'client_approved': { from: ['approval'], to: 'pre_print_qc' },
        'qc_passed': { from: ['quality_check'], to: 'ready' },
        'dispatch_created': { from: ['ready'], to: 'dispatched' },
        'payment_complete': { from: ['dispatched'], to: 'delivered' },
    };

    const rule = progressionMap[trigger];
    if (!rule) return { progressed: false, error: `Unknown trigger: ${trigger}` };

    // Only progress if the job is in an expected stage
    if (!rule.from.includes(currentStage)) {
        return { progressed: false }; // Not an error — job is in a different stage
    }

    // Update job stage
    const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_stage: rule.to })
        .eq('id', jobId);

    if (updateError) return { progressed: false, error: updateError.message };

    // Log stage history
    await supabase.from('job_stage_history').insert([{
        job_id: jobId,
        from_stage: currentStage,
        to_stage: rule.to,
        notes: `Auto-progressed: ${trigger.replace(/_/g, ' ')}`
    }]);

    return { progressed: true, fromStage: currentStage, toStage: rule.to };
}
