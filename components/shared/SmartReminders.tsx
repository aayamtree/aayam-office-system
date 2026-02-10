'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Clock, IndianRupee, CalendarClock, Users, X, ChevronRight } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
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
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [collapsed, setCollapsed] = useState(false);

    const fetchReminders = useCallback(async () => {
        if (!profile || !isSupabaseConfigured()) return;

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
        const items: Reminder[] = [];

        try {
            // 1. Overdue payments (jobs where payment_status != 'paid' and deadline passed)
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

            // 2. Follow-ups due today
            const { data: followUps } = await supabase
                .from('follow_ups')
                .select('id, lead_id, notes, follow_up_date, leads(company_name, contact_person)')
                .lte('follow_up_date', today)
                .eq('status', 'pending')
                .limit(5);

            followUps?.forEach((f: any) => {
                items.push({
                    id: `followup_${f.id}`,
                    type: 'follow_up_due',
                    title: `Follow-up: ${f.leads?.company_name || f.leads?.contact_person || 'Lead'}`,
                    subtitle: f.notes ? f.notes.slice(0, 60) : 'Follow-up scheduled',
                    href: `/admin/marketing/follow-ups`,
                    urgency: f.follow_up_date < today ? 'high' : 'medium',
                });
            });

            // 3. Deadlines today & tomorrow
            const { data: todayJobs } = await supabase
                .from('jobs')
                .select('id, job_number, project_name, current_stage')
                .eq('client_deadline', today)
                .not('current_stage', 'in', '("delivered","cancelled")')
                .limit(5);

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

            const { data: tomorrowJobs } = await supabase
                .from('jobs')
                .select('id, job_number, project_name, current_stage')
                .eq('client_deadline', tomorrow)
                .not('current_stage', 'in', '("delivered","cancelled")')
                .limit(3);

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

            setReminders(items);
        } catch (err) {
            console.error('SmartReminders error:', err);
        }
    }, [profile]);

    useEffect(() => {
        fetchReminders();
        // Refresh every 5 minutes
        const interval = setInterval(fetchReminders, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchReminders]);

    const activeReminders = reminders.filter(r => !dismissed.has(r.id));

    if (activeReminders.length === 0) return null;

    const iconMap = {
        overdue_payment: <IndianRupee className="w-4 h-4" />,
        follow_up_due: <Users className="w-4 h-4" />,
        deadline_today: <Clock className="w-4 h-4" />,
        deadline_tomorrow: <CalendarClock className="w-4 h-4" />,
    };

    const colorMap = {
        high: 'bg-red-50 border-red-200 text-red-800',
        medium: 'bg-amber-50 border-amber-200 text-amber-800',
        low: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    const iconBgMap = {
        high: 'bg-red-100 text-red-600',
        medium: 'bg-amber-100 text-amber-600',
        low: 'bg-blue-100 text-blue-600',
    };

    return (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full">
            {/* Toggle Button */}
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
