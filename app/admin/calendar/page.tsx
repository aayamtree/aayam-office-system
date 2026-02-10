'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
import GoogleConnectionStatus from '@/components/google/GoogleConnectionStatus';
import DailyBriefingModal from '@/components/calendar/DailyBriefingModal';
import NewEventModal from '@/components/calendar/NewEventModal';
import EventCard from '@/components/calendar/EventCard';
import { Calendar, Plus } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';

export default function CalendarPage() {
    const { profile } = useAuth();
    const [showBriefing, setShowBriefing] = useState(false);
    const [showNewEvent, setShowNewEvent] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Same hook as dashboard widget — same DB, same data
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const weekEnd = addDays(weekStart, 6);

    const { events, createEvent, toggleComplete, deleteEvent, loading } = useCalendarEvents(
        format(weekStart, 'yyyy-MM-dd'),
        format(weekEnd, 'yyyy-MM-dd')
    );

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr);
        setShowNewEvent(true);
    };

    return (
        <div className="space-y-3 md:space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900">My Calendar</h1>
                    <p className="text-gray-600 mt-1">Manage your personal schedule and tasks</p>
                </div>

                <div className="flex items-center gap-3">
                    <GoogleConnectionStatus />
                    <button
                        onClick={() => setShowBriefing(true)}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md transition-colors"
                    >
                        Daily Briefing
                    </button>
                </div>
            </div>

            {/* Week Planner */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3 md:mb-1.5">
                    <h2 className="text-section text-gray-900">This Week</h2>
                    <button
                        onClick={() => {
                            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                            setShowNewEvent(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Event
                    </button>
                </div>

                {/* Week Grid */}
                <div className="grid grid-cols-7 gap-2 md:gap-4">
                    {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
                        const day = addDays(weekStart, dayOffset);
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayEvents = events.filter(e => e.start_date === dateStr);
                        const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                        return (
                            <div
                                key={dayOffset}
                                onClick={() => handleDayClick(dateStr)}
                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${isToday
                                    ? 'border-gray-400 bg-gray-100'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="text-center mb-2">
                                    <div className="text-xs text-gray-500">{format(day, 'EEE')}</div>
                                    <div className={`text-section ${isToday ? 'text-gray-900' : 'text-gray-900'}`}>
                                        {format(day, 'd')}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {dayEvents.map(event => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            onToggle={() => toggleComplete(event.id, event.status !== 'completed')}
                                            onDelete={() => deleteEvent(event.id)}
                                        />
                                    ))}
                                    {dayEvents.length === 0 && (
                                        <div className="text-xs text-gray-400 text-center py-2 group-hover:text-gray-500">
                                            No events
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* All Events List */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-section text-gray-900 mb-4">All Events</h2>
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : events.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <Calendar className="w-16 h-16 mx-auto mb-3 opacity-20" />
                        <p>No events yet. Create your first one!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {events.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                showDate
                                onToggle={() => toggleComplete(event.id, event.status !== 'completed')}
                                onDelete={() => deleteEvent(event.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Shared NewEventModal — same component used on dashboard */}
            {showNewEvent && (
                <NewEventModal
                    profile={profile}
                    defaultDate={selectedDate}
                    onClose={() => setShowNewEvent(false)}
                    onCreate={createEvent}
                />
            )}

            {/* Daily Briefing Modal */}
            {showBriefing && (
                <DailyBriefingModal onClose={() => setShowBriefing(false)} />
            )}
        </div>
    );
}

