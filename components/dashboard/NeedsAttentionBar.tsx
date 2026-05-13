'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, ChevronDown, ChevronUp, Clock, IndianRupee, Users, AlertTriangle, ExternalLink, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import Link from 'next/link';

interface AlertCategory {
    key: string;
    label: string;
    count: number;
    color: string;
    icon: React.ReactNode;
    href: string;
    pulse?: boolean;
}

interface DetailItem {
    id: string;
    title: string;
    subtitle: string;
    badge?: string;
    badgeColor?: string;
    href: string;
}

interface NeedsAttentionBarProps {
    overduePayments: number;
    pendingApprovals: number;
    followUpsDue: number;
    blockedJobs: number;
    blockedFeedback: number;
    loading: boolean;
}

export default function NeedsAttentionBar({
    overduePayments,
    pendingApprovals,
    followUpsDue,
    blockedJobs,
    blockedFeedback,
    loading,
}: NeedsAttentionBarProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<DetailItem[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [approvingId, setApprovingId] = useState<string | null>(null);

    // One-click approve/reject handler
    const handleApprove = useCallback(async (jobId: string, action: 'approve' | 'reject') => {
        setApprovingId(jobId);
        try {
            const res = await fetch(`/api/jobs/${jobId}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed');
            toast.success(action === 'approve' ? '✅ Job approved — designer notified!' : '❌ Job rejected');
            // Remove from local list immediately
            setExpandedItems(prev => prev.filter(i => i.id !== jobId));
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setApprovingId(null);
        }
    }, []);

    const hasAlerts = overduePayments > 0 || pendingApprovals > 0 || followUpsDue > 0 || blockedJobs > 0;

    const fetchDetails = useCallback(async (category: string) => {
        if (!isSupabaseConfigured()) return;
        setDetailsLoading(true);
        setExpandedItems([]);

        const today = new Date().toISOString().split('T')[0];
        const items: DetailItem[] = [];

        try {
            if (category === 'overdue_payments') {
                const { data, error } = await supabase
                    .from('jobs')
                    .select('id, job_number, project_name, total_amount, amount_received, client_deadline')
                    .neq('payment_status', 'paid')
                    .lt('client_deadline', today)
                    .not('current_stage', 'in', '("delivered","cancelled")')
                    .order('client_deadline', { ascending: true })
                    .limit(10);

                if (error) console.warn('NeedsAttention overdue_payments error:', error.message);

                (data || []).forEach(j => {
                    const due = (j.total_amount || 0) - (j.amount_received || 0);
                    const daysLate = Math.floor((Date.now() - new Date(j.client_deadline).getTime()) / 86400000);
                    items.push({
                        id: j.id,
                        title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                        subtitle: `₹${due.toLocaleString('en-IN')} pending`,
                        badge: `${daysLate}d late`,
                        badgeColor: daysLate >= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                        href: `/admin/jobs?highlight=${j.id}`,
                    });
                });
            }

            if (category === 'pending_approvals') {
                const { data, error } = await supabase
                    .from('jobs')
                    .select('id, job_number, project_name, created_at, client:clients(name)')
                    .eq('current_stage', 'awaiting_admin')
                    .order('created_at', { ascending: true })
                    .limit(10);

                if (error) console.warn('NeedsAttention pending_approvals error:', error.message);

                (data || []).forEach((j: any) => {
                    const daysWaiting = Math.floor((Date.now() - new Date(j.created_at).getTime()) / 86400000);
                    items.push({
                        id: j.id,
                        title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                        subtitle: j.client?.name || 'Unknown client',
                        badge: daysWaiting > 0 ? `${daysWaiting}d waiting` : 'New',
                        badgeColor: daysWaiting > 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700',
                        href: `/admin/jobs?highlight=${j.id}`,
                    });
                });
            }

            if (category === 'followups_due') {
                const { data, error } = await supabase
                    .from('follow_ups')
                    .select('id, notes, follow_up_date, lead:leads(name, company)')
                    .lte('follow_up_date', today)
                    .order('follow_up_date', { ascending: true })
                    .limit(10);

                if (error) console.warn('NeedsAttention followups_due error:', error.message);

                (data || []).forEach((f: any) => {
                    const daysLate = Math.floor((Date.now() - new Date(f.follow_up_date).getTime()) / 86400000);
                    items.push({
                        id: f.id,
                        title: f.lead?.company || f.lead?.name || 'Lead',
                        subtitle: f.notes ? f.notes.slice(0, 50) : 'Follow-up scheduled',
                        badge: daysLate > 0 ? `${daysLate}d overdue` : 'Today',
                        badgeColor: daysLate > 3 ? 'bg-red-100 text-red-700' : daysLate > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
                        href: '/admin/marketing/follow-ups',
                    });
                });
            }

            if (category === 'blocked_jobs') {
                const { data, error } = await supabase
                    .from('jobs')
                    .select('id, job_number, project_name, current_stage, updated_at')
                    .in('current_stage', ['approval', 'on_hold'])
                    .order('updated_at', { ascending: true })
                    .limit(10);

                if (error) console.warn('NeedsAttention blocked_jobs error:', error.message);

                (data || []).forEach(j => {
                    const daysSince = Math.floor((Date.now() - new Date(j.updated_at).getTime()) / 86400000);
                    items.push({
                        id: j.id,
                        title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                        subtitle: j.current_stage === 'approval' ? 'Awaiting client feedback' : 'On hold',
                        badge: daysSince > 0 ? `${daysSince}d stuck` : 'Recent',
                        badgeColor: daysSince > 5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                        href: `/admin/jobs?highlight=${j.id}`,
                    });
                });
            }
        } catch (err) {
            console.error('NeedsAttention fetch error:', err);
        }

        setExpandedItems(items);
        setDetailsLoading(false);
    }, []);

    // Fetch details when category changes
    useEffect(() => {
        if (expandedCategory) {
            fetchDetails(expandedCategory);
        } else {
            setExpandedItems([]);
        }
    }, [expandedCategory, fetchDetails]);

    if (loading) return (
        <Card className="h-full flex items-center justify-center">
            <CardContent className="pt-6"><span className="text-sm text-muted-foreground">Loading alerts...</span></CardContent>
        </Card>
    );

    if (!hasAlerts) return (
        <Card className="h-full flex items-center justify-center bg-green-50/50 border-green-200">
            <CardContent className="pt-6 text-center">
                <span className="text-2xl">✅</span>
                <p className="text-sm font-medium text-green-800 mt-1">All Clear</p>
                <p className="text-xs text-green-600">No items need attention right now</p>
            </CardContent>
        </Card>
    );

    const categories: AlertCategory[] = [
        overduePayments > 0 ? {
            key: 'overdue_payments',
            label: 'Overdue Payments',
            count: overduePayments,
            color: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
            icon: <IndianRupee className="w-3.5 h-3.5" />,
            href: '/admin/finance',
        } : null,
        pendingApprovals > 0 ? {
            key: 'pending_approvals',
            label: `Pending Approval${pendingApprovals > 1 ? 's' : ''}`,
            count: pendingApprovals,
            color: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
            icon: <Clock className="w-3.5 h-3.5" />,
            href: '/admin/jobs?status=awaiting_admin',
            pulse: true,
        } : null,
        followUpsDue > 0 ? {
            key: 'followups_due',
            label: 'Lead Follow-ups Due',
            count: followUpsDue,
            color: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
            icon: <Users className="w-3.5 h-3.5" />,
            href: '/admin/marketing/follow-ups',
        } : null,
        blockedJobs > 0 ? {
            key: 'blocked_jobs',
            label: 'Blocked Jobs',
            count: blockedJobs,
            color: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            href: '/admin/jobs',
        } : null,
    ].filter(Boolean) as AlertCategory[];

    const toggleExpand = (key: string) => {
        setExpandedCategory(prev => prev === key ? null : key);
    };

    const expandedCat = categories.find(c => c.key === expandedCategory);

    return (
        <Card className="border-amber-200 bg-amber-50/50 overflow-hidden">
            <CardContent className="pt-4 pb-3">
                {/* Header with badges */}
                <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-amber-800">Needs Attention</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => toggleExpand(cat.key)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-all cursor-pointer ${cat.color} ${expandedCategory === cat.key ? 'ring-2 ring-offset-1 ring-amber-300' : ''} ${cat.pulse ? 'animate-pulse' : ''}`}
                        >
                            {cat.icon}
                            <span className="font-bold">{cat.count}</span> {cat.label}
                            {expandedCategory === cat.key ? (
                                <ChevronUp className="w-3 h-3 ml-0.5" />
                            ) : (
                                <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Expanded detail panel */}
                {expandedCategory && expandedCat && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-amber-800">{expandedCat.label} Details</span>
                            <Link
                                href={expandedCat.href}
                                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
                            >
                                View all <ExternalLink className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {detailsLoading ? (
                                <div className="flex items-center justify-center gap-2 py-3">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                    <span className="text-xs text-amber-600">Loading details...</span>
                                </div>
                            ) : expandedItems.length === 0 ? (
                                <div className="text-xs text-amber-600 text-center py-3">No items found</div>
                            ) : (
                                expandedItems.map(item => {
                                    const isPendingApproval = expandedCategory === 'pending_approvals';
                                    const isProcessing = approvingId === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100 hover:border-amber-300 transition-colors gap-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                                                <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {item.badge && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.badgeColor}`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                                {isPendingApproval ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(item.id, 'approve')}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                            ✓ Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(item.id, 'reject')}
                                                            disabled={isProcessing}
                                                            className="px-2.5 py-1 text-red-600 text-xs font-bold rounded-md bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            ✗ Reject
                                                        </button>
                                                    </>
                                                ) : (
                                                    <Link href={item.href} className="text-amber-600 hover:text-amber-800">
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
