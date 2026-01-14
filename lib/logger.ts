import { supabase } from './supabase';
import { ActivityLog } from '@/types/database';

export async function logActivity(
    action: string,
    entityType: string,
    entityId?: string,
    description?: string,
    metadata?: Record<string, any>
) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return; // Or log as 'system'

    try {
        await supabase.from('activity_logs').insert([{
            user_id: user.id,
            action,
            entity_type: entityType,
            entity_id: entityId,
            description,
            metadata
        }]);
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}
