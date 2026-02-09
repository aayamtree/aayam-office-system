'use client';

import { AlertTriangle, Clock, FileText, Phone, Calendar } from 'lucide-react';
import { useJobs, useInvoices, useFollowUps } from '@/lib/hooks';
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

export default function OverdueAlertsWidget() {
    const { jobs } = useJobs();
    const { invoices } = useInvoices();
    const { followUps } = useFollowUps();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getDaysOverdue = (dateStr: string) => {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    };

    const overdueItems: OverdueItem[] = [];

    // Overdue Jobs (past deadline, not yet delivered/cancelled)
    const activeStages = ['new', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'];
    (jobs || []).forEach(job => {
        if (job.client_deadline && activeStages.includes(job.current_stage)) {
            const days = getDaysOverdue(job.client_deadline);
            if (days > 0) {
                overdueItems.push({
                    id: job.id,
                    type: 'job',
                    title: job.project_name,
                    subtitle: `${job.job_number} • ${job.current_stage}`,
                    dueDate: job.client_deadline,
                    daysOverdue: days,
                    link: '/admin/jobs',
                });
            }
        }
    });

    // Overdue Invoices (past due date, not fully paid)
    (invoices || []).forEach(invoice => {
        if (invoice.due_date && invoice.payment_status !== 'paid') {
            const days = getDaysOverdue(invoice.due_date);
            if (days > 0) {
                overdueItems.push({
                    id: invoice.id,
                    type: 'invoice',
                    title: `Invoice ${invoice.invoice_number}`,
                    subtitle: `₹${(invoice.total_amount - (invoice.amount_paid || 0)).toLocaleString('en-IN')} pending`,
                    dueDate: invoice.due_date,
                    daysOverdue: days,
                    link: '/admin/finance/invoices',
                });
            }
        }
    });

    // Overdue Follow-ups (past scheduled date, not completed)
    (followUps || []).forEach(fu => {
        if (fu.next_followup_date && fu.status !== 'completed' && fu.status !== 'cancelled') {
            const days = getDaysOverdue(fu.next_followup_date);
            if (days > 0) {
                overdueItems.push({
                    id: fu.id,
                    type: 'followup',
                    title: fu.lead?.name || fu.client?.name || 'Follow-up',
                    subtitle: fu.notes?.slice(0, 40) || 'Pending follow-up',
                    dueDate: fu.next_followup_date,
                    daysOverdue: days,
                    link: '/admin/marketing/follow-ups',
                });
            }
        }
    });

    // Sort by most overdue first
    overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

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
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Overdue Items</h3>
                    <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {overdueItems.length}
                    </span>
                </div>
            </div>

            {/* Items List */}
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
