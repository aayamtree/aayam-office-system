/**
 * Lead statuses — the ONE place that knows their names, colours and which are closed.
 * The database stores the `key`; people see the `label`.
 */

export type LeadStatusKey =
    | 'fresh_lead' | 'in_followup' | 'in_review'
    | 'deal_done' | 'cancelled' | 'not_interested' | 'not_in_product';

export interface LeadStatusMeta {
    key: LeadStatusKey;
    label: string;
    closed: boolean;
    /** Coloured pill: Fresh blue, Followup orange, Review purple, Done green, Cancelled red, others grey. */
    badge: string;
}

export const LEAD_STATUS_LIST: LeadStatusMeta[] = [
    { key: 'fresh_lead',     label: 'Fresh Lead',      closed: false, badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    { key: 'in_followup',    label: 'In Followup',     closed: false, badge: 'bg-orange-100 text-orange-800 border-orange-200' },
    { key: 'in_review',      label: 'In Review',       closed: false, badge: 'bg-purple-100 text-purple-800 border-purple-200' },
    { key: 'deal_done',      label: 'Deal Done',       closed: true,  badge: 'bg-green-100 text-green-800 border-green-200' },
    { key: 'cancelled',      label: 'Cancelled',       closed: true,  badge: 'bg-red-100 text-red-800 border-red-200' },
    { key: 'not_interested', label: 'Not Interested',  closed: true,  badge: 'bg-gray-100 text-gray-700 border-gray-300' },
    { key: 'not_in_product', label: 'Not In Product',  closed: true,  badge: 'bg-gray-100 text-gray-700 border-gray-300' },
];

const META = Object.fromEntries(LEAD_STATUS_LIST.map(s => [s.key, s])) as Record<string, LeadStatusMeta>;

export const CLOSED_STATUS_KEYS: string[] = LEAD_STATUS_LIST.filter(s => s.closed).map(s => s.key);
export const OPEN_STATUS_KEYS: string[] = LEAD_STATUS_LIST.filter(s => !s.closed).map(s => s.key);

/** For Supabase `.not('status','in', CLOSED_STATUS_FILTER)` */
export const CLOSED_STATUS_FILTER = `(${CLOSED_STATUS_KEYS.join(',')})`;

export function isClosedStatus(status?: string | null): boolean {
    return !!status && CLOSED_STATUS_KEYS.includes(status);
}

export function leadStatusLabel(status?: string | null): string {
    if (!status) return '—';
    return META[status]?.label || status.replace(/_/g, ' ');
}

export function leadStatusBadge(status?: string | null): string {
    return (status && META[status]?.badge) || 'bg-gray-100 text-gray-700 border-gray-300';
}

/** Roles that may change leads. Everyone else sees plain text. */
export function canEditLeads(role?: string | null): boolean {
    return role === 'admin' || role === 'marketing';
}

/** "Make quotation" is hidden for these leads. */
export function canMakeQuotationFor(status?: string | null): boolean {
    return !(status === 'cancelled' || status === 'not_interested' || status === 'not_in_product');
}

/** Open leads first, closed leads at the bottom; order inside each group is kept. */
export function sortClosedLast<T extends { status: string }>(rows: T[]): T[] {
    const open: T[] = [];
    const closed: T[] = [];
    rows.forEach(r => (isClosedStatus(r.status) ? closed : open).push(r));
    return [...open, ...closed];
}

/** An open lead whose follow-up date is today or earlier (IST calendar day). */
export function isFollowUpDue(lead: { status: string; next_follow_up?: string | null }): boolean {
    if (isClosedStatus(lead.status) || !lead.next_follow_up) return false;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return lead.next_follow_up.slice(0, 10) <= today;
}
