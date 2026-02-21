import { supabase } from './supabase';

export async function logActivity(
    action: string,
    entityType: string,
    entityId?: string,
    description?: string,
    metadata?: Record<string, any>,
    userId?: string
) {
    // Use passed userId to avoid redundant supabase.auth.getUser() round-trip
    let uid = userId;
    if (!uid) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            uid = user?.id;
        } catch {
            // Auth call failed — skip logging silently
            return;
        }
    }

    if (!uid) return;

    try {
        // Fire-and-forget: don't block calling code on activity logging
        supabase.from('activity_logs').insert([{
            user_id: uid,
            action,
            entity_type: entityType,
            entity_id: entityId,
            description: description || `${action}`,
            metadata: metadata || {},
        }]).then(({ error }) => {
            if (error) console.warn('Activity log insert failed:', error.message);
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}
