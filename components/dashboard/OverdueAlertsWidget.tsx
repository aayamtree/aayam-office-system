'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, FileText, Phone } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface OverdueItem {
    id: string;
    type: 'job' | 'invoice' | 'followup';
    title: string;
    subtitle: string;
    dueDate: string;
    daysOverdue: number;
    link: string;
}

// PERF: Fetches ONLY overdue items with targeted queries instead of
// loading ALL jobs + ALL invoices + ALL follow-ups via 3 separate SWR hooks
export default function OverdueAlertsWidget() {
    const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
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
            const items: OverdueItem[] = [];

            // 1) Overdue jobs — only active stages, past deadline
            const { data: jobs } = await supabase
                .from('jobs')
                .select('id, job_number, project_name, current_stage, client_deadline')
                .in('current_stage', ['new', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'])
                .lt('client_deadline', today)
                .not('client_deadline', 'is', null)
                .order('client_deadline', { ascending: true })
                .limit(10);

            (jobs || []).forEach(job => {
                const days = getDaysOverdue(job.client_deadline);
                items.push({
                    id: job.id, type: 'job',
                    title: job.project_name || 'Untitled',
                    subtitle: `${job.job_number} • ${job.current_stage}`,
                    dueDate: job.client_deadline, daysOverdue: days,
                    link: '/admin/jobs',
                });
            });

            // 2) Overdue invoices — unpaid, past due date
            const { data: invoices } = await supabase
                .from('invoices')
                .select('id, invoice_number, total_amount, amount_paid, due_date, payment_status')
                .neq('payment_status', 'paid')
                .lt('due_date', today)
                .not('due_date', 'is', null)
                .order('due_date', { ascending: true })
                .limit(10);

            (invoices || []).forEach(inv => {
                const days = getDaysOverdue(inv.due_date);
                items.push({
                    id: inv.id, type: 'invoice',
                    title: `Invoice ${inv.invoice_number}`,
                    subtitle: `₹${((inv.total_amount || 0) - (inv.amount_paid || 0)).toLocaleString('en-IN')} pending`,
                    dueDate: inv.due_date, daysOverdue: days,
                    link: '/admin/finance/invoices',
                });
            });

            // 3) Overdue follow-ups — past date, not completed
            try {
                const { data: followUps } = await supabase
                    .from('follow_ups')
                    .select('id, notes, follow_up_date, status, lead:leads(name), client:clients(name)')
                    .not('follow_up_date', 'is', null)
                    .lt('follow_up_date', today)
                    .not('status', 'in', '("completed","cancelled")')
                    .order('follow_up_date', { ascending: true })
                    .limit(10);

                (followUps || []).forEach((fu: any) => {
                    const days = getDaysOverdue(fu.follow_up_date);
                    items.push({
                        id: fu.id, type: 'followup',
                        title: fu.lead?.name || fu.client?.name || 'Follow-up',
                        subtitle: fu.notes?.slice(0, 40) || 'Pending follow-up',
                        dueDate: fu.follow_up_date, daysOverdue: days,
                        link: '/admin/marketing/follow-ups',
                    });
                });
            } catch { /* follow_ups table may not exist */ }

            items.sort((a, b) => b.daysOverdue - a.daysOverdue);
            setOverdueItems(items);
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

    if (loading) {
        return (
            <div className="bg-white rounded-md border border-gray-100 p-4">
                <div className="h-32 animate-pulse bg-gray-50 rounded-lg"></div>
            </div>
        );
    }

    if (overdueItems.length === 0) {
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
                        {overdueItems.length}
                    </span>
                </div>
            </div>

            <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {overdueItems.slice(0, 8).map((item) => (
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

            {overdueItems.length > 8 && (
                <p className="text-xs text-gray-400 text-center mt-2">
                    +{overdueItems.length - 8} more overdue items
                </p>
            )}
        </div>
    );
}
