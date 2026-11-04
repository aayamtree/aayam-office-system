/**
 * Finance log — a separate, add-only record of money-related changes.
 * Not the same as activity_logs (whole-app log). Never throws: logging must
 * never stop a save.
 */
import { supabase } from '@/lib/supabase';

export type FinanceAction = 'added' | 'edited' | 'deleted' | 'warning';
export type FinanceCategory = 'transaction' | 'contact' | 'account' | 'rule' | 'setting';

export interface FieldChange {
    field: string;
    old: unknown;
    new: unknown;
}

export interface FinanceLogEntry {
    action: FinanceAction;
    category: FinanceCategory;
    entityType?: string;       // e.g. 'invoice', 'bill', 'bank_rule'
    entityId?: string;
    entityLabel?: string;      // e.g. 'Invoice #1622'
    changes?: FieldChange[];   // old -> new, for edits
    snapshot?: Record<string, unknown>; // full record, kept for deletes
    note?: string;
}

/** List the fields whose value differs between two versions of a record. */
export function diffFields(
    before: Record<string, any> | null | undefined,
    after: Record<string, any> | null | undefined,
    fields?: string[],
): FieldChange[] {
    const b = before || {};
    const a = after || {};
    const keys = fields || Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
    const out: FieldChange[] = [];
    for (const k of keys) {
        if (JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null)) {
            out.push({ field: k, old: b[k] ?? null, new: a[k] ?? null });
        }
    }
    return out;
}

export async function logFinance(entry: FinanceLogEntry): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: prof } = await supabase
            .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
        const { error } = await supabase.from('finance_log').insert({
            user_id: user.id,
            user_name: prof?.full_name || user.email || 'Unknown',
            action: entry.action,
            category: entry.category,
            entity_type: entry.entityType ?? null,
            entity_id: entry.entityId ?? null,
            entity_label: entry.entityLabel ?? null,
            changes: entry.changes && entry.changes.length ? entry.changes : null,
            snapshot: entry.snapshot ?? null,
            note: entry.note ?? null,
        });
        if (error) console.error('Finance log write failed:', error.message);
    } catch (err) {
        console.error('Finance log write failed:', err);
    }
}
