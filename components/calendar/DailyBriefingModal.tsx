'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
    X, Calendar, Clock, AlertTriangle, CheckCircle, Users,
    Package, ClipboardCheck, Truck, TrendingUp, IndianRupee,
    Printer, ArrowRight, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface DailyBriefingModalProps {
    onClose: () => void;
}

interface BriefingItem {
    id: string;
    title: string;
    subtitle: string;
    urgency: 'high' | 'medium' | 'low';
    href: string;
    badge?: string;
}

interface BriefingStat {
    label: string;
    value: number;
    color: string;
}

interface BriefingSection {
    title: string;
    icon: React.ReactNode;
    items: BriefingItem[];
}

export default function DailyBriefingModal({ onClose }: DailyBriefingModalProps) {
    const { profile } = useAuth();
    const role = profile?.role || 'designer';
    const userId = profile?.id || '';

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<BriefingStat[]>([]);
    const [sections, setSections] = useState<BriefingSection[]>([]);
    const [footerLink, setFooterLink] = useState({ label: 'Go to Dashboard →', href: '/admin/dashboard' });

    const fetchBriefing = useCallback(async () => {
        if (!isSupabaseConfigured() || !profile?.id) {
            setLoading(false);
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        try {
            if (role === 'designer') {
                await fetchDesignerBriefing(userId, today);
            } else if (role === 'marketing') {
                await fetchMarketingBriefing(today);
            } else if (role === 'dispatch') {
                await fetchDispatchBriefing(today);
            } else if (role === 'cmyk') {
                await fetchCmykBriefing(today);
            } else {
                // Admin
                await fetchAdminBriefing(today);
            }
        } catch (err) {
            console.error('DailyBriefing fetch error:', err);
        }

        setLoading(false);
    }, [profile?.id, role, userId]);

    // ═══════════════════════════════════════════
    // DESIGNER BRIEFING
    // ═══════════════════════════════════════════
    const fetchDesignerBriefing = async (designerId: string, today: string) => {
        // Get designer record linked to this user
        const { data: designerRecord } = await supabase
            .from('designers')
            .select('id')
            .eq('user_id', designerId)
            .maybeSingle();

        const designerDbId = designerRecord?.id;

        // Fetch design tasks assigned to this user
        const { data: tasks } = await supabase
            .from('design_tasks')
            .select('id, task_number, title, status, priority, deadline, client:clients(name, company)')
            .eq('assigned_to', designerDbId || designerId)
            .in('status', ['pending', 'in_progress', 'review', 'rework'])
            .order('priority', { ascending: false })
            .limit(15);

        // Fetch jobs assigned to this designer
        const { data: jobs } = await supabase
            .from('jobs')
            .select('id, job_number, project_name, current_stage, priority, client_deadline')
            .eq('designer_id', designerDbId || designerId)
            .not('current_stage', 'in', '("delivered","cancelled","dispatched")')
            .order('client_deadline', { ascending: true })
            .limit(10);

        const allTasks = tasks || [];
        const allJobs = jobs || [];

        const todoTasks = allTasks.filter(t => t.status === 'pending');
        const inProgressTasks = allTasks.filter(t => t.status === 'in_progress');
        const urgentTasks = allTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
        const overdueJobs = allJobs.filter(j => j.client_deadline && j.client_deadline < today);
        const reworkTasks = allTasks.filter(t => t.status === 'rework');

        setStats([
            { label: 'To Do', value: todoTasks.length, color: 'bg-blue-500/20' },
            { label: 'In Progress', value: inProgressTasks.length, color: 'bg-amber-500/20' },
            { label: 'Urgent / High', value: urgentTasks.length, color: 'bg-red-500/20' },
        ]);

        const briefingSections: BriefingSection[] = [];

        if (reworkTasks.length > 0) {
            briefingSections.push({
                title: `Revision Requests (${reworkTasks.length})`,
                icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
                items: reworkTasks.slice(0, 5).map(t => ({
                    id: t.id,
                    title: `${t.task_number} — ${t.title}`,
                    subtitle: (t as any).client?.company || (t as any).client?.name || 'Client',
                    urgency: 'high' as const,
                    href: '/admin/designers/tasks',
                    badge: 'REWORK',
                })),
            });
        }

        if (overdueJobs.length > 0) {
            briefingSections.push({
                title: `Overdue Jobs (${overdueJobs.length})`,
                icon: <Clock className="w-4 h-4 text-red-600" />,
                items: overdueJobs.slice(0, 5).map(j => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: `Deadline was ${format(new Date(j.client_deadline!), 'MMM d')}`,
                    urgency: 'high' as const,
                    href: `/admin/jobs?highlight=${j.id}`,
                    badge: `${Math.floor((Date.now() - new Date(j.client_deadline!).getTime()) / 86400000)}d late`,
                })),
            });
        }

        if (todoTasks.length > 0) {
            briefingSections.push({
                title: `To Do Tasks (${todoTasks.length})`,
                icon: <ClipboardCheck className="w-4 h-4 text-blue-600" />,
                items: todoTasks.slice(0, 5).map(t => ({
                    id: t.id,
                    title: `${t.task_number} — ${t.title}`,
                    subtitle: (t as any).client?.company || (t as any).client?.name || '',
                    urgency: (t.priority === 'urgent' || t.priority === 'high') ? 'high' as const : 'medium' as const,
                    href: '/admin/designers/tasks',
                    badge: t.priority === 'urgent' ? 'URGENT' : t.priority === 'high' ? 'HIGH' : undefined,
                })),
            });
        }

        if (inProgressTasks.length > 0) {
            briefingSections.push({
                title: `In Progress (${inProgressTasks.length})`,
                icon: <Clock className="w-4 h-4 text-amber-600" />,
                items: inProgressTasks.slice(0, 3).map(t => ({
                    id: t.id,
                    title: `${t.task_number} — ${t.title}`,
                    subtitle: (t as any).client?.company || (t as any).client?.name || '',
                    urgency: 'medium' as const,
                    href: '/admin/designers/tasks',
                })),
            });
        }

        setSections(briefingSections);
        setFooterLink({ label: 'Go to My Tasks →', href: '/admin/designers/tasks' });
    };

    // ═══════════════════════════════════════════
    // MARKETING BRIEFING
    // ═══════════════════════════════════════════
    const fetchMarketingBriefing = async (today: string) => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

        const [followUpsRes, leadsRes] = await Promise.all([
            supabase
                .from('follow_ups')
                .select('id, notes, follow_up_date, completed, lead:leads(name, company)')
                .lte('follow_up_date', today)
                .order('follow_up_date', { ascending: true })
                .limit(15),
            supabase
                .from('leads')
                .select('id, lead_number, name, company, status, created_at, source')
                .in('status', ['new', 'contacted', 'follow_up', 'quotation_shared'])
                .order('created_at', { ascending: false })
                .limit(10),
        ]);

        const followUps = (followUpsRes.data || []) as any[];
        const leads = leadsRes.data || [];

        const todayFollowUps = followUps.filter(f => f.follow_up_date === today && !f.completed);
        const overdueFollowUps = followUps.filter(f => f.follow_up_date < today && !f.completed);
        const newLeads = leads.filter(l => l.created_at >= sevenDaysAgo);

        setStats([
            { label: "Follow-ups Today", value: todayFollowUps.length, color: 'bg-blue-500/20' },
            { label: 'Overdue Follow-ups', value: overdueFollowUps.length, color: 'bg-red-500/20' },
            { label: 'New Leads (7d)', value: newLeads.length, color: 'bg-green-500/20' },
        ]);

        const briefingSections: BriefingSection[] = [];

        if (overdueFollowUps.length > 0) {
            briefingSections.push({
                title: `Overdue Follow-ups (${overdueFollowUps.length})`,
                icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
                items: overdueFollowUps.slice(0, 5).map(f => ({
                    id: f.id,
                    title: f.lead?.company || f.lead?.name || 'Lead',
                    subtitle: f.notes ? f.notes.slice(0, 50) : 'Follow-up overdue',
                    urgency: 'high' as const,
                    href: '/admin/marketing/follow-ups',
                    badge: `${Math.floor((Date.now() - new Date(f.follow_up_date).getTime()) / 86400000)}d overdue`,
                })),
            });
        }

        if (todayFollowUps.length > 0) {
            briefingSections.push({
                title: `Today's Follow-ups (${todayFollowUps.length})`,
                icon: <Calendar className="w-4 h-4 text-blue-600" />,
                items: todayFollowUps.slice(0, 5).map(f => ({
                    id: f.id,
                    title: f.lead?.company || f.lead?.name || 'Lead',
                    subtitle: f.notes ? f.notes.slice(0, 50) : 'Follow-up scheduled',
                    urgency: 'medium' as const,
                    href: '/admin/marketing/follow-ups',
                    badge: 'TODAY',
                })),
            });
        }

        if (newLeads.length > 0) {
            briefingSections.push({
                title: `New Leads (${newLeads.length})`,
                icon: <TrendingUp className="w-4 h-4 text-green-600" />,
                items: newLeads.slice(0, 4).map(l => ({
                    id: l.id,
                    title: l.company || l.name,
                    subtitle: `${l.source || 'Unknown source'} · ${l.status.replace('_', ' ')}`,
                    urgency: 'low' as const,
                    href: '/admin/marketing/leads',
                    badge: l.status === 'new' ? 'NEW' : undefined,
                })),
            });
        }

        setSections(briefingSections);
        setFooterLink({ label: 'Go to Follow-ups →', href: '/admin/marketing/follow-ups' });
    };

    // ═══════════════════════════════════════════
    // DISPATCH BRIEFING
    // ═══════════════════════════════════════════
    const fetchDispatchBriefing = async (today: string) => {
        const { data: jobs } = await supabase
            .from('jobs')
            .select('id, job_number, project_name, current_stage, priority, client_deadline, client:clients(name, company)')
            .in('current_stage', ['quality_check', 'ready'])
            .order('client_deadline', { ascending: true })
            .limit(15);

        const allJobs = (jobs || []) as any[];
        const pendingQC = allJobs.filter(j => j.current_stage === 'quality_check');
        const readyToShip = allJobs.filter(j => j.current_stage === 'ready');
        const delayed = allJobs.filter(j => j.client_deadline && j.client_deadline < today);

        setStats([
            { label: 'Pending QC', value: pendingQC.length, color: 'bg-amber-500/20' },
            { label: 'Ready to Ship', value: readyToShip.length, color: 'bg-green-500/20' },
            { label: 'Delayed', value: delayed.length, color: 'bg-red-500/20' },
        ]);

        const briefingSections: BriefingSection[] = [];

        if (delayed.length > 0) {
            briefingSections.push({
                title: `Delayed Orders (${delayed.length})`,
                icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
                items: delayed.slice(0, 5).map((j: any) => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.client?.company || j.client?.name || '',
                    urgency: 'high' as const,
                    href: `/admin/dispatch`,
                    badge: `${Math.floor((Date.now() - new Date(j.client_deadline).getTime()) / 86400000)}d late`,
                })),
            });
        }

        if (readyToShip.length > 0) {
            briefingSections.push({
                title: `Ready to Dispatch (${readyToShip.length})`,
                icon: <Package className="w-4 h-4 text-green-600" />,
                items: readyToShip.slice(0, 5).map((j: any) => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.client?.company || j.client?.name || '',
                    urgency: 'medium' as const,
                    href: '/admin/dispatch',
                    badge: j.priority === 'urgent' ? 'URGENT' : undefined,
                })),
            });
        }

        if (pendingQC.length > 0) {
            briefingSections.push({
                title: `Pending QC (${pendingQC.length})`,
                icon: <ClipboardCheck className="w-4 h-4 text-amber-600" />,
                items: pendingQC.slice(0, 5).map((j: any) => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.client?.company || j.client?.name || '',
                    urgency: 'low' as const,
                    href: '/admin/dispatch/qc-check',
                })),
            });
        }

        setSections(briefingSections);
        setFooterLink({ label: 'Go to Dispatch →', href: '/admin/dispatch' });
    };

    // ═══════════════════════════════════════════
    // CMYK / PRINT BRIEFING
    // ═══════════════════════════════════════════
    const fetchCmykBriefing = async (today: string) => {
        const [jobsRes, stockRes] = await Promise.all([
            supabase
                .from('jobs')
                .select('id, job_number, project_name, current_stage, priority, client_deadline, client:clients(name, company)')
                .in('current_stage', ['printing', 'finishing'])
                .order('client_deadline', { ascending: true })
                .limit(15),
            supabase
                .from('paper_stock')
                .select('id, name, quantity, reorder_level')
                .limit(20),
        ]);

        const allJobs = (jobsRes.data || []) as any[];
        const stock = stockRes.data || [];

        const printQueue = allJobs.filter(j => j.current_stage === 'printing');
        const dueToday = allJobs.filter(j => j.client_deadline === today);
        const lowStock = stock.filter(s => s.quantity <= s.reorder_level);

        setStats([
            { label: 'Print Queue', value: printQueue.length, color: 'bg-blue-500/20' },
            { label: 'Due Today', value: dueToday.length, color: 'bg-amber-500/20' },
            { label: 'Low Stock', value: lowStock.length, color: 'bg-red-500/20' },
        ]);

        const briefingSections: BriefingSection[] = [];

        if (dueToday.length > 0) {
            briefingSections.push({
                title: `Due Today (${dueToday.length})`,
                icon: <Clock className="w-4 h-4 text-amber-600" />,
                items: dueToday.slice(0, 5).map((j: any) => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.client?.company || j.client?.name || '',
                    urgency: 'high' as const,
                    href: '/admin/cmyk-print',
                    badge: 'TODAY',
                })),
            });
        }

        if (printQueue.length > 0) {
            briefingSections.push({
                title: `Print Queue (${printQueue.length})`,
                icon: <Printer className="w-4 h-4 text-blue-600" />,
                items: printQueue.slice(0, 5).map((j: any) => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.client?.company || j.client?.name || '',
                    urgency: j.priority === 'urgent' ? 'high' as const : 'medium' as const,
                    href: '/admin/cmyk-print',
                    badge: j.priority === 'urgent' ? 'URGENT' : undefined,
                })),
            });
        }

        if (lowStock.length > 0) {
            briefingSections.push({
                title: `Low Stock Alert (${lowStock.length})`,
                icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
                items: lowStock.slice(0, 4).map(s => ({
                    id: s.id,
                    title: s.name,
                    subtitle: `${s.quantity} left (reorder at ${s.reorder_level})`,
                    urgency: s.quantity === 0 ? 'high' as const : 'medium' as const,
                    href: '/admin/cmyk-print/paper-stock',
                    badge: s.quantity === 0 ? 'OUT' : 'LOW',
                })),
            });
        }

        setSections(briefingSections);
        setFooterLink({ label: 'Go to Print Queue →', href: '/admin/cmyk-print' });
    };

    // ═══════════════════════════════════════════
    // ADMIN BRIEFING
    // ═══════════════════════════════════════════
    const fetchAdminBriefing = async (today: string) => {
        const [jobsRes, followUpsRes] = await Promise.all([
            supabase
                .from('jobs')
                .select('id, job_number, project_name, current_stage, priority, client_deadline, payment_status, total_amount, amount_received, client:clients(name, company)')
                .not('current_stage', 'in', '("delivered","cancelled")')
                .order('client_deadline', { ascending: true })
                .limit(30),
            supabase
                .from('follow_ups')
                .select('id, notes, follow_up_date, completed, lead:leads(name, company)')
                .lte('follow_up_date', today)
                .eq('completed', false)
                .order('follow_up_date', { ascending: true })
                .limit(10),
        ]);

        const allJobs = (jobsRes.data || []) as any[];
        const followUps = (followUpsRes.data || []) as any[];

        const pendingApprovals = allJobs.filter(j => j.current_stage === 'awaiting_admin');
        const overduePayments = allJobs.filter(j =>
            j.payment_status !== 'paid' &&
            j.client_deadline && j.client_deadline < today
        );
        const blockedJobs = allJobs.filter(j => ['approval', 'on_hold'].includes(j.current_stage));

        setStats([
            { label: 'Pending Approvals', value: pendingApprovals.length, color: 'bg-orange-500/20' },
            { label: 'Overdue Payments', value: overduePayments.length, color: 'bg-red-500/20' },
            { label: 'Follow-ups Due', value: followUps.length, color: 'bg-blue-500/20' },
        ]);

        const briefingSections: BriefingSection[] = [];

        if (pendingApprovals.length > 0) {
            briefingSections.push({
                title: `Pending Approvals (${pendingApprovals.length})`,
                icon: <Clock className="w-4 h-4 text-orange-600" />,
                items: pendingApprovals.slice(0, 5).map((j: any) => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.client?.company || j.client?.name || '',
                    urgency: 'high' as const,
                    href: `/admin/jobs?highlight=${j.id}`,
                    badge: j.priority === 'urgent' ? 'URGENT' : 'NEW',
                })),
            });
        }

        if (overduePayments.length > 0) {
            briefingSections.push({
                title: `Overdue Payments (${overduePayments.length})`,
                icon: <IndianRupee className="w-4 h-4 text-red-600" />,
                items: overduePayments.slice(0, 5).map((j: any) => {
                    const due = (j.total_amount || 0) - (j.amount_received || 0);
                    return {
                        id: j.id,
                        title: `${j.job_number} — ₹${due.toLocaleString('en-IN')} pending`,
                        subtitle: j.client?.company || j.client?.name || '',
                        urgency: 'high' as const,
                        href: '/admin/finance/payments',
                        badge: `${Math.floor((Date.now() - new Date(j.client_deadline).getTime()) / 86400000)}d late`,
                    };
                }),
            });
        }

        if (followUps.length > 0) {
            briefingSections.push({
                title: `Follow-ups Due (${followUps.length})`,
                icon: <Users className="w-4 h-4 text-blue-600" />,
                items: followUps.slice(0, 4).map((f: any) => ({
                    id: f.id,
                    title: f.lead?.company || f.lead?.name || 'Lead',
                    subtitle: f.notes ? f.notes.slice(0, 50) : 'Follow-up due',
                    urgency: f.follow_up_date < today ? 'high' as const : 'medium' as const,
                    href: '/admin/marketing/follow-ups',
                })),
            });
        }

        if (blockedJobs.length > 0) {
            briefingSections.push({
                title: `Blocked Jobs (${blockedJobs.length})`,
                icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
                items: blockedJobs.slice(0, 3).map((j: any) => ({
                    id: j.id,
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.current_stage === 'approval' ? 'Awaiting client feedback' : 'On hold',
                    urgency: 'medium' as const,
                    href: `/admin/jobs?highlight=${j.id}`,
                })),
            });
        }

        setSections(briefingSections);
        setFooterLink({ label: 'Go to Dashboard →', href: '/admin/dashboard' });
    };

    useEffect(() => {
        fetchBriefing();
    }, [fetchBriefing]);

    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

    const urgencyBorder = {
        high: 'border-l-red-500 bg-red-50/50',
        medium: 'border-l-amber-500 bg-amber-50/50',
        low: 'border-l-gray-300 bg-gray-50/50',
    };

    const roleLabel: Record<string, string> = {
        designer: '🎨 Designer',
        marketing: '📢 Marketing',
        dispatch: '📦 Dispatch',
        cmyk: '🖨️ Print',
        admin: '👑 Admin',
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg max-w-xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gray-900 p-5 text-white">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className="text-xl font-bold mb-0.5">
                                Good {getTimeOfDay()}, {profile?.full_name?.split(' ')[0] || 'User'}! 👋
                            </h2>
                            <p className="text-white/70 text-sm">
                                {format(new Date(), 'EEEE, MMMM d, yyyy')} · {roleLabel[role] || role}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-md transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Quick Stats */}
                    {!loading && (
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            {stats.map(stat => (
                                <div key={stat.label} className={`${stat.color} backdrop-blur-sm rounded-lg p-3`}>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <div className="text-xs text-white/80">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[calc(90vh-260px)]">
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">Loading your briefing...</p>
                        </div>
                    ) : totalItems === 0 ? (
                        <div className="text-center py-10">
                            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                                All Caught Up! 🎉
                            </h3>
                            <p className="text-gray-500 text-sm">
                                No pending items for today. Great job!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {sections.map(section => (
                                <div key={section.title}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {section.icon}
                                        <h3 className="font-bold text-sm text-gray-900">{section.title}</h3>
                                    </div>
                                    <div className="space-y-1.5">
                                        {section.items.map(item => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                onClick={onClose}
                                                className={`block p-2.5 rounded-md border-l-4 hover:shadow-sm transition-all ${urgencyBorder[item.urgency]}`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                                                        <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                                                    </div>
                                                    {item.badge && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${item.urgency === 'high' ? 'bg-red-100 text-red-700' :
                                                                item.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 p-4 bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        I&apos;ll check this later
                    </button>
                    <button
                        onClick={() => {
                            onClose();
                            window.location.href = footerLink.href;
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm rounded-md transition-colors font-medium"
                    >
                        {footerLink.label}
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}
