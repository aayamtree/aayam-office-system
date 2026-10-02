'use client';

/**
 * Lead actions — thin wrappers over the three database functions in
 * supabase/ADD_LEAD_STATUS_MENU_2026-10-02.sql. Each one is all-or-nothing in the
 * database, and every one writes to lead_history (who, when, what).
 */

import { supabase } from '@/lib/supabase';

export interface LeadHistoryRow {
    id: string;
    lead_id: string;
    kind: string;
    old_status: string | null;
    new_status: string | null;
    note: string | null;
    created_by_name: string | null;
    created_at: string;
}

type Result<T> = { data?: T; error?: string };

function clean(message?: string): string {
    // Postgres wraps our messages; keep the human part.
    return (message || 'Something went wrong. Please try again.').replace(/^.*?ERROR:\s*/i, '');
}

export async function changeLeadStatus(
    leadId: string, newStatus: string, note: string, nextFollowUp?: string | null
): Promise<Result<any>> {
    const { data, error } = await supabase.rpc('change_lead_status', {
        p_lead_id: leadId, p_new_status: newStatus, p_note: note, p_next_follow_up: nextFollowUp || null,
    });
    return error ? { error: clean(error.message) } : { data };
}

export async function addLeadFollowUp(
    leadId: string, note: string, date?: string | null
): Promise<Result<any>> {
    const { data, error } = await supabase.rpc('add_lead_followup', {
        p_lead_id: leadId, p_note: note, p_date: date || null,
    });
    return error ? { error: clean(error.message) } : { data };
}

/**
 * THE one function that makes or links a client from a lead. Every button uses it.
 * Same company name (any capitals) -> that client. Otherwise a new client.
 * Calling it again for the same lead returns the same client (safe to retry).
 */
export async function makeClientFromLead(
    leadId: string, markWon = false
): Promise<Result<{ client: any; created: boolean }>> {
    const { data, error } = await supabase.rpc('make_client_from_lead', {
        p_lead_id: leadId, p_mark_won: markWon,
    });
    return error ? { error: clean(error.message) } : { data };
}

export async function fetchLeadHistory(leadId: string): Promise<Result<LeadHistoryRow[]>> {
    const { data, error } = await supabase
        .from('lead_history')
        .select('id, lead_id, kind, old_status, new_status, note, created_by_name, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(100);
    return error ? { error: clean(error.message) } : { data: (data || []) as LeadHistoryRow[] };
}
