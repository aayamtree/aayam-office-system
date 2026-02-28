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
            return;
        }
    }
    if (!uid) return;

    // Fetch the user's real full_name to store alongside user_id
    let userName: string | null = null;
    try {
        const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', uid)
            .single();
        userName = prof?.full_name || null;
    } catch { /* non-blocking */ }

    try {
        supabase.from('activity_logs').insert([{
            user_id: uid,
            user_name: userName,
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
