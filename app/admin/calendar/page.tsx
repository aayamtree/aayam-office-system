'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
import { fetchCalendarBusinessData, CalendarItem } from '@/lib/calendar-data';
import GoogleConnectionStatus from '@/components/google/GoogleConnectionStatus';
import DailyBriefingModal from '@/components/calendar/DailyBriefingModal';
import NewEventModal from '@/components/calendar/NewEventModal';
import EventCard from '@/components/calendar/EventCard';
import { Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameMonth,
    isToday,
} from 'date-fns';

export default function CalendarPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showBriefing, setShowBriefing] = useState(false);
    const [showNewEvent, setShowNewEvent] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const startDate = format(calendarStart, 'yyyy-MM-dd');
    const endDate = format(calendarEnd, 'yyyy-MM-dd');

    const { events, createEvent, toggleComplete, deleteEvent, loading: eventsLoading } = useCalendarEvents(startDate, endDate);

    // Fetch ALL business data via shared utility (role-aware)
    const [businessItems, setBusinessItems] = useState<CalendarItem[]>([]);
    const [bizLoading, setBizLoading] = useState(true);

    useEffect(() => {
        if (!profile?.id) return;
        setBizLoading(true);
        fetchCalendarBusinessData(startDate, endDate, profile.role || 'admin', profile.id)
            .then(items => setBusinessItems(items))
            .finally(() => setBizLoading(false));
    }, [startDate, endDate, profile?.id, profile?.role]);

    const loading = eventsLoading || bizLoading;
    const isAdmin = profile?.role === 'admin';

    // Combine personal events + business items
    const allItems = useMemo(() => {
        const items: CalendarItem[] = [];

        if (events && profile?.id) {
            const userEvents = isAdmin
                ? events // Admin sees all calendar events
                : events.filter(e => e.user_id === profile.id || (e.tagged_users && e.tagged_users.includes(profile.id)));

            userEvents.forEach(e => {
                items.push({
                    id: `event-${e.id}`,
                    title: e.title,
                    date: e.start_date,
                    type: 'event',
                    status: e.status,
                    color: e.status === 'completed'
                        ? 'bg-muted text-muted-foreground line-through'
                        : 'bg-violet-100 text-violet-800',
                });
            });
        }

        items.push(...businessItems);
        return items;
    }, [events, profile?.id, isAdmin, businessItems]);

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const days = [];
        let day = calendarStart;
        while (day <= calendarEnd) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [calendarStart, calendarEnd]);

    const weeks = useMemo(() => {
        const result = [];
        for (let i = 0; i < calendarDays.length; i += 7) {
            result.push(calendarDays.slice(i, i + 7));
        }
        return result;
    }, [calendarDays]);

    // Items for the selected day
    const selectedDayItems = useMemo(() => {
        return allItems.filter(item => item.date === selectedDate);
    }, [allItems, selectedDate]);

    // Personal events for selected day
    const selectedDayEvents = useMemo(() => {
        if (!events) return [];
        return events.filter(e => e.start_date === selectedDate);
    }, [events, selectedDate]);

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr);
    };

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Legend items based on role
    const legendItems = [
        { color: 'bg-amber-400', label: 'Deadline' },
        { color: 'bg-blue-400', label: 'Follow-up' },
        { color: 'bg-green-400', label: 'Dispatch' },
        { color: 'bg-violet-400', label: 'Event' },
        { color: 'bg-rose-400', label: 'Invoice Due' },
        { color: 'bg-orange-400', label: 'Print Run' },
        { color: 'bg-purple-400', label: 'Lead' },
    ];

    return (
        <div className="p-4 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">
                        {isAdmin ? 'System Calendar' : 'My Calendar'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {isAdmin
                            ? 'All deadlines, events & business dates system-wide'
                            : 'Your events, deadlines & assigned tasks'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <GoogleConnectionStatus />
                    <button
                        onClick={() => setShowBriefing(true)}
                        className="px-3 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        Daily Briefing
                    </button>
                    <button
                        onClick={() => { setSelectedDate(format(new Date(), 'yyyy-MM-dd')); setShowNewEvent(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                    >
                        <Plus size={16} /> New Event
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                {/* Month Grid */}
                <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                    {/* Month Header */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Calendar size={18} />
                            {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setCurrentMonth(new Date())}
                                className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                Today
                            </button>
                            <button
                                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <ChevronLeft size={16} className="rotate-180" />
                            </button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="px-4 py-2 border-b border-gray-50 flex flex-wrap gap-4 text-[11px] text-gray-500">
                        {legendItems.map(l => (
                            <span key={l.label} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${l.color}`} /> {l.label}
                            </span>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    {loading ? (
                        <div className="text-sm text-gray-400 text-center py-20">Loading...</div>
                    ) : (
                        <div className="p-2">
                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 mb-1">
                                {weekDays.map(day => (
                                    <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-md overflow-hidden border border-gray-100">
                                {weeks.map((week, weekIdx) =>
                                    week.map((day, dayIdx) => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const dayItems = allItems.filter(e => e.date === dateStr);
                                        const inCurrentMonth = isSameMonth(day, currentMonth);
                                        const today = isToday(day);
                                        const isSelected = selectedDate === dateStr;

                                        return (
                                            <div
                                                key={`${weekIdx}-${dayIdx}`}
                                                onClick={() => handleDayClick(dateStr)}
                                                className={`min-h-[80px] md:min-h-[90px] p-1.5 cursor-pointer transition-colors group
                                                    ${isSelected
                                                        ? 'bg-gray-50 ring-2 ring-inset ring-gray-900'
                                                        : today
                                                            ? 'bg-gray-50'
                                                            : inCurrentMonth
                                                                ? 'bg-white hover:bg-gray-50/50'
                                                                : 'bg-gray-50/50'
                                                    }`}
                                            >
                                                {/* Day Number */}
                                                <div className="flex items-center justify-between mb-1">
                                                    <span
                                                        className={`text-xs leading-none
                                                            ${today
                                                                ? 'bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold'
                                                                : inCurrentMonth
                                                                    ? 'text-gray-900 font-medium'
                                                                    : 'text-gray-300'
                                                            }`}
                                                    >
                                                        {format(day, 'd')}
                                                    </span>
                                                    {dayItems.length === 0 && (
                                                        <Plus className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </div>

                                                {/* Items Preview */}
                                                <div className="space-y-0.5">
                                                    {dayItems.slice(0, 3).map(item => (
                                                        <div
                                                            key={item.id}
                                                            className={`px-1 py-0.5 rounded text-[10px] leading-tight truncate ${item.color}`}
                                                            title={item.title}
                                                        >
                                                            {item.title}
                                                        </div>
                                                    ))}
                                                    {dayItems.length > 3 && (
                                                        <div className="text-[10px] text-gray-400 text-center">
                                                            +{dayItems.length - 3} more
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Day Detail Panel */}
                <div className="bg-white rounded-md border border-gray-200 h-fit">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-900">
                                {format(new Date(selectedDate + 'T00:00:00'), 'EEEE')}
                            </p>
                            <p className="text-xs text-gray-500">
                                {format(new Date(selectedDate + 'T00:00:00'), 'dd MMM yyyy')}
                            </p>
                        </div>
                        <button
                            onClick={() => { setShowNewEvent(true); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                        >
                            <Plus size={13} /> Add
                        </button>
                    </div>

                    <div className="p-3">
                        {selectedDayItems.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p className="text-xs">No events on this day</p>
                                <p className="text-xs text-gray-300 mt-0.5">Click + to add one</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Personal events */}
                                {selectedDayEvents.map(event => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        onToggle={() => toggleComplete(event.id, event.status !== 'completed')}
                                        onDelete={() => deleteEvent(event.id)}
                                    />
                                ))}

                                {/* Business items */}
                                {selectedDayItems
                                    .filter(item => item.type !== 'event')
                                    .map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => item.link && router.push(item.link)}
                                            className={`px-3 py-2 rounded-md text-xs cursor-pointer transition-colors hover:opacity-80 ${item.color}`}
                                        >
                                            <p className="font-medium">{item.title}</p>
                                            <p className="text-[10px] opacity-70 capitalize mt-0.5">{item.type === 'printrun' ? 'print run' : item.type === 'followup' ? 'follow-up' : item.type}</p>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* New Event Modal */}
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
