'use client';

/**
 * EOD Nudge — Shows a persistent banner at 5:30pm if EOD not yet submitted.
 * Renders inside the admin layout so it appears on every page.
 * Clicking the banner takes the user directly to the EOD submit page.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { ClipboardList, X, Zap } from 'lucide-react';

// Roles that need to submit EOD (not admin — they review instead)
const EOD_ROLES = ['designer', 'marketing', 'dispatch', 'finance', 'cmyk'];

export default function EODNudge() {
    const { profile } = useAuth();
    const router = useRouter();
    const [show, setShow] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [workLogCount, setWorkLogCount] = useState(0);

    useEffect(() => {
        if (!profile?.id || !EOD_ROLES.includes(profile.role || '')) return;

        const check = async () => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            // Show from 17:30 (5:30pm) onwards
            if (hour < 17 || (hour === 17 && minute < 30)) return;

            const today = now.toISOString().split('T')[0];

            // Check if EOD already submitted today
            const { data: report } = await supabase
                .from('daily_reports')
                .select('id')
                .eq('user_id', profile.id)
                .eq('report_date', today)
                .maybeSingle();

            if (report) return; // Already submitted — don't show

            // Count today's auto-logged activities
            const { count } = await supabase
                .from('work_logs')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', profile.id)
                .eq('log_date', today);

            setWorkLogCount(count || 0);
            setShow(true);
        };

        check();
        // Re-check every 30 minutes in case they submitted during the session
        const interval = setInterval(check, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [profile?.id, profile?.role]);

    if (!show || dismissed) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-gray-900 text-white rounded-md shadow-xl border border-gray-700 overflow-hidden">
                {/* Top accent bar */}
                <div className="h-1 bg-gradient-to-r from-yellow-400 to-orange-400" />

                <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 bg-yellow-400/20 rounded-md flex items-center justify-center flex-shrink-0">
                                <ClipboardList className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">Time to submit your EOD! 🌅</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {workLogCount > 0
                                        ? `Your report is pre-filled with ${workLogCount} activity log${workLogCount !== 1 ? 's' : ''} from today`
                                        : 'Quick 30-second summary of your day'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-1 hover:bg-white/10 rounded-md flex-shrink-0 transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>

                    <button
                        onClick={() => { router.push('/admin/eod-report'); setDismissed(true); }}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-md text-sm font-bold transition-colors"
                    >
                        <Zap className="w-4 h-4" />
                        Submit My EOD Report
                    </button>
                </div>
            </div>
        </div>
    );
}
