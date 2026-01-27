/**
 * Activity Logger Utility
 * Logs all user activities for audit trail
 */

import { supabase } from './supabase';

export type ActivityAction =
    | 'login'
    | 'logout'
    | 'create'
    | 'update'
    | 'delete'
    | 'view'
    | 'export'
    | 'approve'
    | 'reject'
    | 'upload';

export type ResourceType =
    | 'job'
    | 'invoice'
    | 'payment'
    | 'client'
    | 'quotation'
    | 'user'
    | 'order'
    | 'lead'
    | 'delivery'
    | 'file';

interface LogActivityParams {
    action: ActivityAction;
    resourceType?: ResourceType;
    resourceId?: string;
    details?: Record<string, any>;
}

/**
 * Log user activity
 */
export async function logActivity({
    action,
    resourceType,
    resourceId,
    details
}: LogActivityParams): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: details || {},
            ip_address: null, // Can be added if needed
            user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw - activity logging should never break the app
    }
}

/**
 * Log login event
 */
export async function logLogin() {
    await logActivity({ action: 'login' });

    // Update last_login_at in profiles
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from('profiles')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', user.id);
        }
    } catch (error) {
        console.error('Failed to update last login:', error);
    }
}

/**
 * Log logout event
 */
export async function logLogout() {
    await logActivity({ action: 'logout' });
}

/**
 * Log resource creation
 */
export async function logCreate(resourceType: ResourceType, resourceId: string, details?: Record<string, any>) {
    await logActivity({ action: 'create', resourceType, resourceId, details });
}

/**
 * Log resource update
 */
export async function logUpdate(resourceType: ResourceType, resourceId: string, details?: Record<string, any>) {
    await logActivity({ action: 'update', resourceType, resourceId, details });
}

/**
 * Log resource deletion
 */
export async function logDelete(resourceType: ResourceType, resourceId: string, details?: Record<string, any>) {
    await logActivity({ action: 'delete', resourceType, resourceId, details });
}

/**
 * Log resource view (for sensitive data)
 */
export async function logView(resourceType: ResourceType, resourceId: string, details?: Record<string, any>) {
    await logActivity({ action: 'view', resourceType, resourceId, details });
}

/**
 * Log file upload activity
 * @param details - File details (name, size, type, url, uploadedTo)
 */
export async function logFileUpload(details: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    uploadedTo: string;
    resourceId?: string;
}) {
    await logActivity({
        action: 'upload',
        resourceType: 'file',
        resourceId: details.resourceId,
        details: {
            fileName: details.fileName,
            fileSize: details.fileSize,
            fileType: details.fileType,
            fileUrl: details.fileUrl,
            uploadedTo: details.uploadedTo,
            description: `uploaded ${details.fileName} to ${details.uploadedTo}`
        }
    });
}

/**
 * Get user's recent activity
 */
export async function getUserActivity(userId: string, limit: number = 50) {
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

/**
 * Get all recent activity (admin only)
 */
export async function getAllActivity(limit: number = 100) {
    const { data, error } = await supabase
        .from('activity_logs')
        .select(`
      *,
      profiles (name, username, role)
    `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}
