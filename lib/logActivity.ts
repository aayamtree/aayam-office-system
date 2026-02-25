import { supabase } from '@/lib/supabase';

interface LogActivityParams {
    userId: string;
    userName: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'STATUS_CHANGE' | 'UPLOAD' | 'APPROVE' | string;
    module: 'CRM' | 'Finance' | 'Sales' | 'Print Planner' | 'Dispatch' | 'Settings' | 'System' | string;
    entityId?: string | null;
    entityName?: string | null;
    description: string;
}

export async function logActivity({
    userId,
    userName,
    action,
    module,
    entityId,
    entityName,
    description,
}: LogActivityParams): Promise<void> {
    try {
        // Try full insert (with user_name, entity_name, module from migration)
        const { error } = await supabase.from('activity_logs').insert([{
            user_id: userId,
            user_name: userName,
            action,
            module,
            entity_id: entityId || null,
            entity_name: entityName || null,
            description,
        }]);

        // If columns not yet added (SQL not run), fall back to core columns
        if (error) {
            await supabase.from('activity_logs').insert([{
                user_id: userId,
                action,
                entity_id: entityId || null,
                description,
                metadata: { user_name: userName, module, entity_name: entityName },
            }]);
        }
    } catch {
        // Never throw — logging must never break the app
    }
}
