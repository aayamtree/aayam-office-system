'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
import { X, Calendar, Clock, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';

interface DailyBriefingModalProps {
    onClose: () => void;
}

export default function DailyBriefingModal({ onClose }: DailyBriefingModalProps) {
    const { profile } = useAuth();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Query from 30 days ago to end of today to catch all pending tasks
    const startDate = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const { events, loading } = useCalendarEvents(startDate, today);

    // Filter tasks - show pending and in_progress only (not completed/cancelled)
    const pendingEvents = events.filter(e =>
        e.status === 'pending' || e.status === 'in_progress'
    );

    const todayEvents = pendingEvents.filter(e =>
        isToday(parseISO(e.start_date))
    );

    const overdueEvents = pendingEvents.filter(e =>
        isPast(parseISO(e.start_date)) &&
        !isToday(parseISO(e.start_date))
    );

    const urgentEvents = [...todayEvents, ...overdueEvents].filter(e =>
        e.priority === 'urgent' || e.priority === 'high'
    );

    const taggedEvents = pendingEvents.filter(e =>
        e.tagged_users?.includes(profile?.id || '')
    );

    const totalPending = todayEvents.length + overdueEvents.length;

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
                    <div className="text-center text-gray-500">Loading your daily briefing...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-oms-blue p-6 text-white">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold mb-1">
                                Good {getTimeOfDay()}, {profile?.full_name?.split(' ')[0] || 'User'}! 👋
                            </h2>
                            <p className="text-white/80">
                                {format(new Date(), 'EEEE, MMMM d, yyyy')}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                            <div className="text-3xl font-bold">{todayEvents.length}</div>
                            <div className="text-xs text-white/80">Tasks Today</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                            <div className="text-3xl font-bold text-orange-200">{overdueEvents.length}</div>
                            <div className="text-xs text-white/80">Overdue</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                            <div className="text-3xl font-bold text-red-200">{urgentEvents.length}</div>
                            <div className="text-xs text-white/80">Urgent</div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
                    {totalPending === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                All Caught Up! 🎉
                            </h3>
                            <p className="text-gray-600">
                                You have no pending tasks for today. Great job!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Overdue Tasks */}
                            {overdueEvents.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                        <h3 className="font-bold text-red-900">Overdue ({overdueEvents.length})</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {overdueEvents.slice(0, 5).map(event => (
                                            <TaskCard key={event.id} event={event} isOverdue />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Today's Tasks */}
                            {todayEvents.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Calendar className="w-5 h-5 text-oms-blue" />
                                        <h3 className="font-bold text-gray-900">Today&apos;s Tasks ({todayEvents.length})</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {todayEvents.map(event => (
                                            <TaskCard key={event.id} event={event} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tagged/Mentioned */}
                            {taggedEvents.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <User className="w-5 h-5 text-blue-600" />
                                        <h3 className="font-bold text-gray-900">You&apos;re Tagged ({taggedEvents.length})</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {taggedEvents.slice(0, 3).map(event => (
                                            <TaskCard key={event.id} event={event} isTagged />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 p-4 bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-600 hover:text-gray-900"
                    >
                        I&apos;ll check this later
                    </button>
                    <button
                        onClick={() => {
                            onClose();
                            window.location.href = '/admin/calendar';
                        }}
                        className="px-4 py-2 bg-[rgba(0,0,255,0.1)] text-white rounded-lg hover:bg-[rgba(0,0,255,0.1)] transition-colors"
                    >
                        View Full Calendar →
                    </button>
                </div>
            </div>
        </div>
    );
}

function TaskCard({ event, isOverdue, isTagged }: { event: any; isOverdue?: boolean; isTagged?: boolean }) {
    const priorityColors = {
        low: 'bg-gray-100 text-gray-700',
        normal: 'bg-blue-100 text-blue-700',
        high: 'bg-orange-100 text-orange-700',
        urgent: 'bg-red-100 text-red-700'
    };

    const isCompleted = event.status === 'completed';

    return (
        <div className={`p-3 rounded-lg border-l-4 ${isCompleted
            ? 'bg-green-50 border-l-green-500 opacity-75'
            : isOverdue
                ? 'bg-red-50 border-l-red-500'
                : isTagged
                    ? 'bg-blue-50 border-l-blue-500'
                    : 'bg-gray-50 border-l-oms-blue-500'
            }`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {isCompleted && (
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                        <h4 className={`font-semibold truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                            }`}>
                            {event.title}
                        </h4>
                        {!isCompleted && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${priorityColors[event.priority as keyof typeof priorityColors] || priorityColors.normal
                                }`}>
                                {event.priority}
                            </span>
                        )}
                        {isCompleted && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap bg-green-100 text-green-700">
                                ✓ Done
                            </span>
                        )}
                    </div>
                    {event.description && (
                        <p className={`text-sm line-clamp-1 ${isCompleted ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                            {event.description}
                        </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {event.start_time ? (
                            <span>{event.start_time.slice(0, 5)}</span>
                        ) : (
                            <span>All day</span>
                        )}
                        {isOverdue && !isCompleted && (
                            <span className="text-red-600 font-medium">
                                • Overdue since {format(parseISO(event.start_date), 'MMM d')}
                            </span>
                        )}
                        {isTagged && (
                            <span className="text-blue-600">• You&apos;re mentioned</span>
                        )}
                        {isCompleted && event.completed_at && (
                            <span className="text-green-600">
                                • Completed {format(parseISO(event.completed_at), 'MMM d')}
                            </span>
                        )}
                    </div>
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
