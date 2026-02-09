import { supabase } from './supabase';

export async function logActivity(
    action: string,
    entityType: string,
    entityId?: string,
    description?: string,
    metadata?: Record<string, any>
) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    try {
        await supabase.from('activity_logs').insert([{
            user_id: user.id,
            action,
            entity_type: entityType,
            entity_id: entityId,
            description: description || `${action}`,
            metadata: metadata || {},
        }]);
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}
