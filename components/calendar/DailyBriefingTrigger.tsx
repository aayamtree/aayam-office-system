'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import DailyBriefingModal from '@/components/calendar/DailyBriefingModal';

/**
 * Hook to manage daily briefing modal display
 * Shows modal once per day on login
 */
export function useDailyBriefing() {
    const { user } = useAuth();
    const [showBriefing, setShowBriefing] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Check if briefing was already shown today
        const lastShown = localStorage.getItem('daily_briefing_last_shown');
        const today = new Date().toDateString();

        if (lastShown !== today) {
            // Show briefing after a short delay
            const timer = setTimeout(() => {
                setShowBriefing(true);
                localStorage.setItem('daily_briefing_last_shown', today);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [user]);

    return {
        showBriefing,
        closeBriefing: () => setShowBriefing(false)
    };
}

/**
 * Component that automatically shows daily briefing on login
 * Add this to your main layout or dashboard
 */
export default function DailyBriefingTrigger() {
    const { showBriefing, closeBriefing } = useDailyBriefing();

    if (!showBriefing) return null;

    return <DailyBriefingModal onClose={closeBriefing} />;
}
