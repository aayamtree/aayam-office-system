'use client';

import { useEffect, useState } from 'react';
import { X, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useRealtime } from '@/lib/realtime-context';

interface Notification {
    id: string;
    message: string;
    priority: 'normal' | 'urgent';
    target_audience: string;
    created_at: string;
    link?: string | null;
}

export function NotificationPopup() {
    const { profile } = useAuth();
    const router = useRouter();
    const { lastBroadcast } = useRealtime();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    // Initial load of existing undismissed notifications.
    useEffect(() => {
        if (!profile) return;
        loadNotifications();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    // React to new broadcast notifications delivered by the shared realtime channel.
    // The subscription itself lives once in RealtimeProvider — this component no longer
    // opens its own channel.
    useEffect(() => {
        if (!profile || !lastBroadcast) return;

        const newNotification = lastBroadcast as any;

        // Skip if already dismissed (e.g. re-render with same payload)
        if (dismissedIds.has(newNotification.id)) return;

        // Show if targeted at this user specifically, their role, or all
        if (
            newNotification.target_audience === 'all' ||
            newNotification.target_audience === profile.role ||
            newNotification.target_audience === `user_${profile.id}`
        ) {
            setNotifications((prev) =>
                prev.some((n) => n.id === newNotification.id)
                    ? prev
                    : [newNotification, ...prev]
            );
        }

        // Trigger push notification — only if THIS user created the notification.
        // This prevents duplicate pushes when multiple users have the app open.
        if (newNotification.created_by === profile.id) {
            (async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.access_token) {
                        fetch('/api/push/send', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({
                                title: newNotification.priority === 'urgent' ? '🚨 Urgent — Aayam' : '📢 Aayam Office',
                                message: newNotification.message,
                                targetAudience: newNotification.target_audience,
                                url: newNotification.link || '/admin/dashboard',
                            }),
                        }).catch(() => { /* silent — push is best-effort */ });
                    }
                } catch { /* ignore push errors */ }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastBroadcast, profile]);

    const loadNotifications = async () => {
        if (!profile) return;

        // Get all active notifications for this user
        const { data: notifs } = await supabase
            .from('broadcast_notifications')
            .select('*')
            .or(`target_audience.eq.all,target_audience.eq.${profile.role},target_audience.eq.user_${profile.id}`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (notifs) {
            // Get dismissed notification IDs
            const { data: dismissals } = await supabase
                .from('notification_dismissals')
                .select('notification_id')
                .eq('user_id', profile.id);

            const dismissed = new Set(dismissals?.map((d) => d.notification_id) || []);
            setDismissedIds(dismissed);

            // Only show undismissed notifications
            const undismissed = notifs.filter((n) => !dismissed.has(n.id));
            setNotifications(undismissed);
        }
    };

    const handleDismiss = async (notificationId: string) => {
        if (!profile) return;

        // Mark as dismissed in database
        await supabase.from('notification_dismissals').insert({
            notification_id: notificationId,
            user_id: profile.id,
        });

        // Remove from UI
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        setDismissedIds((prev) => new Set(Array.from(prev).concat(notificationId)));
    };

    // Tap the card -> jump straight to the concerned page, and dismiss it.
    const handleOpen = (notification: Notification) => {
        if (!notification.link) return;
        handleDismiss(notification.id);
        router.push(notification.link);
    };

    // Don't render if no notifications
    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-20 right-4 z-50 space-y-3 max-w-md">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    onClick={() => handleOpen(notification)}
                    role={notification.link ? 'button' : undefined}
                    tabIndex={notification.link ? 0 : undefined}
                    onKeyDown={(e) => { if (notification.link && (e.key === 'Enter' || e.key === ' ')) handleOpen(notification); }}
                    className={`
            rounded-lg  p-4 animate-slide-in-right transition-shadow
            ${notification.link ? 'cursor-pointer hover:shadow-md' : ''}
            ${notification.priority === 'urgent'
                            ? 'bg-red-50 border-2 border-red-500'
                            : 'bg-blue-50 border-2 border-blue-500'
                        }
          `}
                >
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                            className={`
              flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
              ${notification.priority === 'urgent'
                                    ? 'bg-red-100'
                                    : 'bg-blue-100'
                                }
            `}
                        >
                            {notification.priority === 'urgent' ? (
                                <AlertCircle className="text-red-600" size={24} />
                            ) : (
                                <Info className="text-blue-600" size={24} />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3
                                className={`
                font-bold text-sm mb-1
                ${notification.priority === 'urgent'
                                        ? 'text-red-900'
                                        : 'text-blue-900'
                                    }
              `}
                            >
                                {notification.priority === 'urgent'
                                    ? '🚨 Urgent Announcement'
                                    : '📢 Announcement'}
                            </h3>
                            <p
                                className={`
                text-sm whitespace-pre-wrap
                ${notification.priority === 'urgent'
                                        ? 'text-red-800'
                                        : 'text-blue-800'
                                    }
              `}
                            >
                                {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2 gap-2">
                                <p className="text-xs text-gray-500">
                                    {new Date(notification.created_at).toLocaleString()}
                                </p>
                                {notification.link && (
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${notification.priority === 'urgent' ? 'text-red-700' : 'text-blue-700'}`}>
                                        Open <ArrowRight className="w-3 h-3" />
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Dismiss Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDismiss(notification.id); }}
                            className={`
                flex-shrink-0 p-1 rounded-lg transition-colors
                ${notification.priority === 'urgent'
                                    ? 'hover:bg-red-200'
                                    : 'hover:bg-blue-200'
                                }
              `}
                            aria-label="Dismiss notification"
                        >
                            <X
                                size={20}
                                className={
                                    notification.priority === 'urgent'
                                        ? 'text-red-600'
                                        : 'text-blue-600'
                                }
                            />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
