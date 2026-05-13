// =============================================
// CALENDAR AUTO-EVENTS
// Auto-create calendar events for job deadlines,
// follow-up dates, dispatch dates, etc.
// =============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

interface AutoEventOptions {
    userId: string;
    sourceType: 'job' | 'followup' | 'dispatch' | 'invoice' | 'task';
    sourceId: string;
    title: string;
    date: string; // ISO date string
    description?: string;
    visibility?: 'private' | 'team' | 'all';
}

/**
 * Create or update a system-generated calendar event.
 * Uses source_type + source_id to find existing events and update them
 * instead of creating duplicates.
 */
export async function upsertAutoCalendarEvent(options: AutoEventOptions) {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Database not configured' };

    const { userId, sourceType, sourceId, title, date, description, visibility } = options;

    // Check if an auto-event already exists for this source
    const { data: existing } = await supabase
        .from('user_calendar_events')
        .select('id')
        .eq('source', 'auto')
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        // Update existing event
        const { error } = await supabase
            .from('user_calendar_events')
            .update({
                title,
                event_date: date,
                description: description || null,
                visibility: visibility || 'private',
            })
            .eq('id', existing.id);

        return { error: error?.message };
    }

    // Create new auto-event
    const { error } = await supabase
        .from('user_calendar_events')
        .insert([{
            user_id: userId,
            title,
            event_date: date,
            event_type: 'deadline',
            description: description || null,
            source: 'auto',
            source_type: sourceType,
            source_id: sourceId,
            visibility: visibility || 'private',
        }]);

    return { error: error?.message };
}

/**
 * Remove auto-events for a specific source (e.g., when a job is deleted)
 */
export async function removeAutoCalendarEvents(sourceType: string, sourceId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase
        .from('user_calendar_events')
        .delete()
        .eq('source', 'auto')
        .eq('source_type', sourceType)
        .eq('source_id', sourceId);
}
