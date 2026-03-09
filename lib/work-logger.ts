/**
 * Work Logger — Auto-captures designer activity throughout the day.
 * Call logWork() anywhere in the app when a meaningful action happens.
 * These logs auto-populate the EOD report so designers don't need to remember.
 */

import { supabase } from '@/lib/supabase';

export type WorkLogType =
    | 'task_started'
    | 'task_completed'
    | 'task_updated'
    | 'file_uploaded'
    | 'stage_changed'
    | 'note_added'
    | 'manual';

interface WorkLogEntry {
    userId: string;
    logType: WorkLogType;
    description: string;
    jobId?: string;
    taskId?: string;
    metadata?: Record<string, any>;
}

/**
 * Log a work activity. Fire-and-forget — never blocks the UI action.
 * 
 * Usage:
 *   logWork({ userId, logType: 'task_completed', description: 'Completed: Logo Design - ABC Corp', jobId })
 */
export async function logWork(entry: WorkLogEntry): Promise<void> {
    try {
        await supabase.from('work_logs').insert({
            user_id: entry.userId,
            log_type: entry.logType,
            description: entry.description,
            job_id: entry.jobId || null,
            task_id: entry.taskId || null,
            metadata: entry.metadata || {},
            log_date: new Date().toISOString().split('T')[0],
        });
    } catch (err) {
        // Silent — logging failures should never interrupt user workflow
        console.warn('[WorkLog] Failed to log activity:', err);
    }
}

/**
 * Pre-built log helpers for common designer actions
 */
export const WorkLog = {
    taskStarted: (userId: string, taskName: string, jobName: string, jobId?: string) =>
        logWork({ userId, logType: 'task_started', description: `Started working on: ${taskName} (${jobName})`, jobId }),

    taskCompleted: (userId: string, taskName: string, jobName: string, jobId?: string) =>
        logWork({ userId, logType: 'task_completed', description: `✅ Completed: ${taskName} (${jobName})`, jobId }),

    taskUpdated: (userId: string, taskName: string, update: string, jobId?: string) =>
        logWork({ userId, logType: 'task_updated', description: `Updated ${taskName}: ${update}`, jobId }),

    fileUploaded: (userId: string, fileName: string, jobName: string, jobId?: string) =>
        logWork({ userId, logType: 'file_uploaded', description: `📎 Uploaded file "${fileName}" for ${jobName}`, jobId }),

    stageChanged: (userId: string, jobName: string, from: string, to: string, jobId?: string) =>
        logWork({ userId, logType: 'stage_changed', description: `Moved "${jobName}" from ${from} → ${to}`, jobId }),

    noteAdded: (userId: string, jobName: string, notePreview: string, jobId?: string) =>
        logWork({ userId, logType: 'note_added', description: `💬 Added note on ${jobName}: "${notePreview.slice(0, 60)}${notePreview.length > 60 ? '...' : ''}"`, jobId }),

    manual: (userId: string, description: string) =>
        logWork({ userId, logType: 'manual', description }),
};
