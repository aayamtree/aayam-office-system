'use client';

// OVERDUE ITEMS — what is late, and one tap to the exact record.
//
// Satish, 2026-10-13: every item here must open ITS OWN page, not a general
// list — a job opens that job, a follow-up opens that follow-up, an invoice
// opens that customer's row in Money In. Whatever is edited there is what
// shows here, because this box only reads the originals.
//
// INVOICES COME FROM ZOHO, NOT THE OLD `invoices` TABLE. That table holds 2
// rows and has been closed for writing since phase 2, so this box used to say
// "1 overdue invoice, ₹33,040" while Zoho held 107 overdue invoices worth
// ~₹64 lakh. Invoices are grouped by customer, exactly as Money In groups
// them (same statuses, same grouping), so a row here is always a row there.
//
// Each type shows its worst 3 and a "See all" link, so 100+ overdue invoices
// can never push the late jobs and follow-ups out of sight.

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, FileText, Phone, ArrowRight } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

type ItemType = 'job' | 'invoice' | 'followup';

interface OverdueItem {
    id: string;
    type: ItemType;
    title: string;
    subtitle: string;
    dueDate: string;
    daysOverdue: number;
    link: string;
}

interface Group {
    items: OverdueItem[];
    total: number;
    /** Extra figure for the group heading, e.g. total rupees owed. */
    note?: string;
}

const SHOWN_PER_GROUP = 3;

/** Same statuses Money In (lib/receivables.ts) counts as money genuinely owed. */
const OWED_STATUSES = ['overdue', 'sent'];

const SEE_ALL: Record<ItemType, string> = {
    job: '/admin/jobs/overdue',
    followup: '/admin/marketing/follow-ups',
    invoice: '/admin/finance/money-in',
};

const GROUP_LABEL: Record<ItemType, string> = {
    job: 'Jobs past deadline',
    followup: 'Follow-ups',
    invoice: 'Invoices owed',
};

function inrShort(n: number): string {
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const EMPTY: Group = { items: [], total: 0 };

// PERF: three small targeted queries; each shows only its worst few rows.
export default function OverdueAlertsWidget() {
    const [groups, setGroups] = useState<Record<ItemType, Group>>({ job: EMPTY, followup: EMPTY, invoice: EMPTY });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isSupabaseConfigured()) { setLoading(false); return; }

        const today = new Date().toISOString().split('T')[0];

        const getDaysOverdue = (dateStr: string) => {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const date = new Date(dateStr); date.setHours(0, 0, 0, 0);
            return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        };

        const fetchOverdue = async () => {
            const next: Record<ItemType, Group> = { job: EMPTY, followup: EMPTY, invoice: EMPTY };

            // 1) Overdue jobs — active stages, past client deadline. Opens the job itself.
            try {
                const { data: jobs, count } = await supabase
                    .from('jobs')
                    .select('id, job_number, project_name, current_stage, client_deadline', { count: 'exact' })
                    .in('current_stage', ['new', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'])
                    .lt('client_deadline', today)
                    .not('client_deadline', 'is', null)
                    .order('client_deadline', { ascending: true })
                    .limit(SHOWN_PER_GROUP);

                const items: OverdueItem[] = (jobs || []).map((job: any) => ({
                    id: job.id, type: 'job' as const,
                    title: job.project_name || 'Untitled',
                    subtitle: `${job.job_number} • ${job.current_stage}`,
                    dueDate: job.client_deadline, daysOverdue: getDaysOverdue(job.client_deadline),
                    link: `/admin/jobs/${job.id}`,
                }));
                next.job = { items, total: count ?? items.length };
            } catch { /* leave the group empty rather than break the dashboard */ }

            // 2) Overdue invoices — from Zoho, grouped by customer, like Money In.
            try {
                const { data: docs } = await supabase
                    .from('zoho_documents')
                    .select('customer_name, balance, due_date')
                    .eq('doc_type', 'invoice')
                    .in('status', OWED_STATUSES)
                    .gt('balance', 0)
                    .lt('due_date', today);

                const byCustomer = new Map<string, { owed: number; count: number; oldest: string }>();
                let totalOwed = 0;
                for (const d of (docs || []) as any[]) {
                    if (!d.due_date) continue;
                    const owed = Number(d.balance) || 0;
                    if (owed <= 0) continue;
                    // Must match lib/receivables.ts exactly so the row exists in Money In.
                    const name = (d.customer_name || '').trim() || 'Unknown customer';
                    const g = byCustomer.get(name) || { owed: 0, count: 0, oldest: d.due_date };
                    g.owed += owed;
                    g.count += 1;
                    if (new Date(d.due_date) < new Date(g.oldest)) g.oldest = d.due_date;
                    byCustomer.set(name, g);
                    totalOwed += owed;
                }

                // Biggest money first — the same order Money In uses.
                const sorted = Array.from(byCustomer.entries()).sort((a, b) => b[1].owed - a[1].owed);
                const items: OverdueItem[] = sorted.slice(0, SHOWN_PER_GROUP).map(([name, g]) => ({
                    id: name, type: 'invoice' as const,
                    title: name,
                    subtitle: `${inrShort(g.owed)} · ${g.count} invoice${g.count !== 1 ? 's' : ''}`,
                    dueDate: g.oldest, daysOverdue: getDaysOverdue(g.oldest),
                    link: `/admin/finance/money-in?customer=${encodeURIComponent(name)}`,
                }));
                next.invoice = { items, total: sorted.length, note: totalOwed > 0 ? `${inrShort(totalOwed)} overdue` : undefined };
            } catch { /* leave the group empty rather than break the dashboard */ }

            // 3) Overdue follow-ups — past date, not completed. Opens that follow-up, highlighted.
            try {
                const { data: followUps, count } = await supabase
                    .from('follow_ups')
                    .select('id, notes, follow_up_date, status, lead:leads(name), client:clients(name)', { count: 'exact' })
                    .not('follow_up_date', 'is', null)
                    .lt('follow_up_date', today)
                    .not('status', 'in', '("completed","cancelled")')
                    .order('follow_up_date', { ascending: true })
                    .limit(SHOWN_PER_GROUP);

                const items: OverdueItem[] = (followUps || []).map((fu: any) => ({
                    id: fu.id, type: 'followup' as const,
                    title: fu.lead?.name || fu.client?.name || 'Follow-up',
                    subtitle: fu.notes?.slice(0, 40) || 'Pending follow-up',
                    dueDate: fu.follow_up_date, daysOverdue: getDaysOverdue(fu.follow_up_date),
                    link: `/admin/marketing/follow-ups?highlight=${fu.id}`,
                }));
                next.followup = { items, total: count ?? items.length };
            } catch { /* follow_ups table may not exist */ }

            setGroups(next);
            setLoading(false);
        };

        fetchOverdue();
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case 'job': return <Clock className="w-4 h-4 text-red-500" />;
            case 'invoice': return <FileText className="w-4 h-4 text-amber-500" />;
            case 'followup': return <Phone className="w-4 h-4 text-blue-500" />;
            default: return <AlertTriangle className="w-4 h-4 text-gray-400" />;
        }
    };

    const getSeverity = (days: number) => {
        if (days >= 7) return 'bg-red-50 border-red-100 text-red-700';
        if (days >= 3) return 'bg-amber-50 border-amber-100 text-amber-700';
        return 'bg-orange-50 border-orange-100 text-orange-700';
    };

    const order: ItemType[] = ['job', 'followup', 'invoice'];
    const grandTotal = order.reduce((s, t) => s + groups[t].total, 0);

    if (loading) {
        return (
            <div className="bg-white rounded-md border border-gray-100 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 rounded-md bg-gray-50 border border-gray-100 animate-pulse" />
                ))}
            </div>
        );
    }

    if (grandTotal === 0) {
        return (
            <div className="bg-white rounded-md border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-gray-300" />
                    <h3 className="text-sm font-semibold text-gray-900">Overdue Items</h3>
                </div>
                <div className="text-center py-6 text-sm text-gray-400">
                    ✅ All caught up — no overdue items!
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-md border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Overdue Items</h3>
                    <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
                        {grandTotal}
                    </span>
                </div>
            </div>

            <div className="space-y-3">
                {order.map(type => {
                    const g = groups[type];
                    if (g.total === 0) return null;
                    return (
                        <div key={type} className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                <span>
                                    {GROUP_LABEL[type]} · {g.total}
                                    {g.note ? <span className="ml-1 normal-case font-medium text-gray-400">({g.note})</span> : null}
                                </span>
                                {g.total > g.items.length && (
                                    <Link href={SEE_ALL[type]} className="inline-flex items-center gap-0.5 normal-case font-medium text-gray-500 hover:text-gray-900">
                                        See all <ArrowRight className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                            {g.items.map(item => (
                                <Link
                                    key={`${item.type}-${item.id}`}
                                    href={item.link}
                                    className={`block p-2.5 rounded-md border transition-colors hover:opacity-80 ${getSeverity(item.daysOverdue)}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 min-w-0">
                                            {getIcon(item.type)}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{item.title}</p>
                                                <p className="text-xs opacity-70">{item.subtitle}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs font-bold">{item.daysOverdue}d late</p>
                                            <p className="text-[10px] opacity-60">{formatDate(item.dueDate)}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
