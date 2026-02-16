'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Clock, IndianRupee, CalendarClock, Users, X, ChevronRight, Zap } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface Reminder {
    id: string;
    type: 'overdue_payment' | 'follow_up_due' | 'deadline_today' | 'deadline_tomorrow';
    title: string;
    subtitle: string;
    href: string;
    urgency: 'high' | 'medium' | 'low';
}

export default function SmartReminders() {
    const { profile } = useAuth();
    const pathname = usePathname();
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [collapsed, setCollapsed] = useState(false);

    const role = profile?.role || 'designer';
    const isAdmin = role === 'admin';
    const isDesigner = role === 'designer';
    const isMarketing = role === 'marketing';
    const isDispatch = role === 'dispatch';
    const isCmyk = role === 'cmyk';
    const isOnDashboard = pathname === '/admin/dashboard';

    const fetchReminders = useCallback(async () => {
        if (!profile || !isSupabaseConfigured()) return;

        const userId = profile.id;
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
        const items: Reminder[] = [];

        try {
            // 1. Overdue payments — ADMIN ONLY (financial data)
            if (isAdmin) {
                const { data: overdueJobs } = await supabase
                    .from('jobs')
                    .select('id, job_number, project_name, total_amount, amount_received, client_deadline')
                    .neq('payment_status', 'paid')
                    .lt('client_deadline', today)
                    .not('current_stage', 'in', '("delivered","cancelled")')
                    .limit(5);

                overdueJobs?.forEach(j => {
                    const due = (j.total_amount || 0) - (j.amount_received || 0);
                    items.push({
                        id: `overdue_${j.id}`,
                        type: 'overdue_payment',
                        title: `${j.job_number} — Overdue`,
                        subtitle: `₹${due.toLocaleString('en-IN')} pending · Deadline was ${new Date(j.client_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
                        href: `/admin/jobs?highlight=${j.id}`,
                        urgency: 'high',
                    });
                });
            }

            // 2. Follow-ups due — ADMIN & MARKETING only
            if (isAdmin || isMarketing) {
                const { data: followUps } = await supabase
                    .from('follow_ups')
                    .select('id, lead_id, notes, follow_up_date, lead:leads(company, name)')
                    .lte('follow_up_date', today)
                    .limit(5);

                followUps?.forEach((f: any) => {
                    items.push({
                        id: `followup_${f.id}`,
                        type: 'follow_up_due',
                        title: `Follow-up: ${f.lead?.company || f.lead?.name || 'Lead'}`,
                        subtitle: f.notes ? f.notes.slice(0, 60) : 'Follow-up scheduled',
                        href: `/admin/marketing/follow-ups`,
                        urgency: f.follow_up_date < today ? 'high' : 'medium',
                    });
                });
            }

            // 3. Deadlines today — scoped per role
            // Marketing & CMYK don't need job deadline reminders
            if (!isMarketing && !isCmyk) {
                let todayQuery = supabase
                    .from('jobs')
                    .select('id, job_number, project_name, current_stage')
                    .eq('client_deadline', today)
                    .not('current_stage', 'in', '("delivered","cancelled")')
                    .limit(5);

                if (isDesigner) {
                    // Designers see only THEIR assigned jobs
                    todayQuery = todayQuery.eq('designer_id', userId);
                } else if (isDispatch) {
                    // Dispatch sees only QC/ready stage jobs (their responsibility)
                    todayQuery = todayQuery.in('current_stage', ['quality_check', 'ready']);
                }
                // Admin sees all jobs (no extra filter)

                const { data: todayJobs } = await todayQuery;

                todayJobs?.forEach(j => {
                    items.push({
                        id: `today_${j.id}`,
                        type: 'deadline_today',
                        title: `${j.job_number} — Due Today`,
                        subtitle: j.project_name || 'Untitled',
                        href: `/admin/jobs?highlight=${j.id}`,
                        urgency: 'high',
                    });
                });
            }

            // 4. Deadlines tomorrow — same role scoping
            if (!isMarketing && !isCmyk) {
                let tomorrowQuery = supabase
                    .from('jobs')
                    .select('id, job_number, project_name, current_stage')
                    .eq('client_deadline', tomorrow)
                    .not('current_stage', 'in', '("delivered","cancelled")')
                    .limit(3);

                if (isDesigner) {
                    tomorrowQuery = tomorrowQuery.eq('designer_id', userId);
                } else if (isDispatch) {
                    tomorrowQuery = tomorrowQuery.in('current_stage', ['quality_check', 'ready']);
                }

                const { data: tomorrowJobs } = await tomorrowQuery;

                tomorrowJobs?.forEach(j => {
                    items.push({
                        id: `tomorrow_${j.id}`,
                        type: 'deadline_tomorrow',
                        title: `${j.job_number} — Due Tomorrow`,
                        subtitle: j.project_name || 'Untitled',
                        href: `/admin/jobs?highlight=${j.id}`,
                        urgency: 'medium',
                    });
                });
            }

            setReminders(items);
        } catch (err) {
            console.error('SmartReminders error:', err);
        }
    }, [profile, isAdmin, isDesigner, isMarketing, isDispatch, isCmyk]);

    useEffect(() => {
        fetchReminders();
        const interval = setInterval(fetchReminders, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchReminders]);

    const activeReminders = reminders.filter(r => !dismissed.has(r.id));

    if (activeReminders.length === 0) return null;

    // ──────────────────────────────────────────────────────────
    // ADMIN: Compact "Needs Attention" summary bar
    // On dashboard → hidden (dashboard already has its own "Needs Attention" bar)
    // On other pages → show compact pill that links to dashboard
    // ──────────────────────────────────────────────────────────
    if (isAdmin) {
        // Don't show on dashboard — the dashboard has its own "Needs Attention" section
        if (isOnDashboard) return null;

        const overdueCount = activeReminders.filter(r => r.type === 'overdue_payment').length;
        const followUpCount = activeReminders.filter(r => r.type === 'follow_up_due').length;
        const deadlineCount = activeReminders.filter(r => r.type === 'deadline_today' || r.type === 'deadline_tomorrow').length;

        // Build summary chips
        const chips: { label: string; count: number; color: string }[] = [];
        if (overdueCount > 0) chips.push({ label: 'Overdue', count: overdueCount, color: 'bg-red-100 text-red-700' });
        if (deadlineCount > 0) chips.push({ label: 'Deadlines', count: deadlineCount, color: 'bg-amber-100 text-amber-700' });
        if (followUpCount > 0) chips.push({ label: 'Follow-ups', count: followUpCount, color: 'bg-blue-100 text-blue-700' });

        if (dismissed.has('admin_bar')) return null;

        return (
            <div className="fixed bottom-4 right-4 z-40">
                <Link
                    href="/admin/dashboard"
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full shadow-lg hover:shadow-xl hover:bg-amber-100 transition-all group"
                >
                    <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm font-semibold">Needs Attention</span>
                    <div className="flex items-center gap-1.5">
                        {chips.map(chip => (
                            <span key={chip.label} className={`text-xs font-bold px-2 py-0.5 rounded-full ${chip.color}`}>
                                {chip.count} {chip.label}
                            </span>
                        ))}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600 transition-colors flex-shrink-0" />
                </Link>
                <button
                    onClick={(e) => { e.preventDefault(); setDismissed(prev => { const next = new Set(Array.from(prev)); next.add('admin_bar'); return next; }); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                >
                    <X className="w-3 h-3 text-gray-500" />
                </button>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────
    // NON-ADMIN: Detailed floating popup (role-filtered)
    // Designers see only their own jobs; marketing sees own follow-ups
    // ──────────────────────────────────────────────────────────

    const iconMap = {
        overdue_payment: <IndianRupee className="w-4 h-4" />,
        follow_up_due: <Users className="w-4 h-4" />,
        deadline_today: <Clock className="w-4 h-4" />,
        deadline_tomorrow: <CalendarClock className="w-4 h-4" />,
    };

    const iconBgMap = {
        high: 'bg-red-100 text-red-600',
        medium: 'bg-amber-100 text-amber-600',
        low: 'bg-blue-100 text-blue-600',
    };

    return (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full">
            {collapsed ? (
                <button
                    onClick={() => setCollapsed(false)}
                    className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-all animate-pulse"
                >
                    <Bell className="w-4 h-4" />
                    <span className="font-medium text-sm">{activeReminders.length} Reminders</span>
                </button>
            ) : (
                <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-gray-600" />
                            <span className="font-bold text-sm text-gray-800">Smart Reminders</span>
                            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{activeReminders.length}</span>
                        </div>
                        <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-gray-600 p-1">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Reminder Items */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {activeReminders.map(r => (
                            <Link
                                key={r.id}
                                href={r.href}
                                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group`}
                            >
                                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconBgMap[r.urgency]}`}>
                                    {iconMap[r.type]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                                    <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 mt-1 flex-shrink-0" />
                            </Link>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 bg-gray-50 border-t">
                        <button
                            onClick={() => setDismissed(new Set(activeReminders.map(r => r.id)))}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                            Dismiss all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
