'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
    const dayDetailRef = useRef<HTMLDivElement>(null);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const startDate = format(calendarStart, 'yyyy-MM-dd');
    const endDate = format(calendarEnd, 'yyyy-MM-dd');

    const { events, createEvent, toggleComplete, deleteEvent, loading: eventsLoading } = useCalendarEvents(startDate, endDate);
    const [businessItems, setBusinessItems] = useState<CalendarItem[]>([]);

    useEffect(() => {
        if (!profile?.id) return;
        fetchCalendarBusinessData(startDate, endDate, profile.role || 'admin', profile.id)
            .then(items => setBusinessItems(items))
            .catch(err => console.error('Calendar data fetch error:', err));
    }, [startDate, endDate, profile?.id, profile?.role]);

    const loading = eventsLoading;
    const isAdmin = profile?.role === 'admin';

    const allItems = useMemo(() => {
        const items: CalendarItem[] = [];
        if (events && profile?.id) {
            const userEvents = isAdmin
                ? events
                : events.filter(e => e.user_id === profile.id || (e.tagged_users && e.tagged_users.includes(profile.id)));
            userEvents.forEach(e => {
                items.push({
                    id: `event-${e.id}`,
                    title: e.title,
                    date: (e.start_time || e.start_date || '').split('T')[0],
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

    const selectedDayItems = useMemo(() => {
        return allItems.filter(item => item.date === selectedDate);
    }, [allItems, selectedDate]);

    const selectedDayEvents = useMemo(() => {
        if (!events) return [];
        return events.filter(e => e.start_date === selectedDate);
    }, [events, selectedDate]);

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr);
        setTimeout(() => {
            dayDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const isMarketing = profile?.role === 'marketing';
    const legendItems = [
        ...(isAdmin || !isMarketing ? [{ color: 'bg-amber-400', label: 'Deadline' }] : []),
        { color: 'bg-blue-400', label: 'Follow-up' },
        ...(!isMarketing ? [{ color: 'bg-green-400', label: 'Dispatch' }] : []),
        { color: 'bg-violet-400', label: 'Event' },
        ...(isAdmin ? [{ color: 'bg-rose-400', label: 'Invoice' }] : []),
        ...(!isMarketing ? [{ color: 'bg-orange-400', label: 'Print Run' }] : []),
        ...(isAdmin || isMarketing ? [{ color: 'bg-purple-400', label: 'Lead' }] : []),
    ];

    // Get up to 3 unique-type colored dot classes for a date (mobile grid)
    const getDayDots = (dateStr: string) => {
        const dayItems = allItems.filter(e => e.date === dateStr);
        const seen = new Set<string>();
        const dots: string[] = [];
        for (const item of dayItems) {
            if (!seen.has(item.type) && dots.length < 3) {
                seen.add(item.type);
                // Extract first bg class from item.color
                dots.push(item.color.split(' ')[0]);
            }
        }
        return dots;
    };

    const dotSolid: Record<string, string> = {
        'bg-amber-100': 'bg-amber-400',
        'bg-blue-100': 'bg-blue-400',
        'bg-green-100': 'bg-green-500',
        'bg-violet-100': 'bg-violet-500',
        'bg-rose-100': 'bg-rose-400',
        'bg-orange-100': 'bg-orange-400',
        'bg-purple-100': 'bg-purple-500',
        'bg-muted': 'bg-gray-400',
    };

    const typeLabel = (type: string) => {
        if (type === 'printrun') return 'Print Run';
        if (type === 'followup') return 'Follow-up';
        if (type === 'invoicedue') return 'Invoice Due';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    return (
        <div className="p-4 pb-24">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">
                        {isAdmin ? 'System Calendar' : 'My Calendar'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">
                        {isAdmin ? 'All deadlines, events & business dates system-wide' : 'Your events, deadlines & assigned tasks'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <GoogleConnectionStatus />
                    <button
                        onClick={() => setShowBriefing(true)}
                        className="hidden sm:block px-3 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        Daily Briefing
                    </button>
                    <button
                        onClick={() => { setSelectedDate(format(new Date(), 'yyyy-MM-dd')); setShowNewEvent(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">New Event</span>
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════
                DESKTOP LAYOUT (lg+) — unchanged
            ══════════════════════════════════════ */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_320px] gap-4">
                {/* Month Grid */}
                <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Calendar size={18} />
                            {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentMonth(new Date())} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Today</button>
                            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"><ChevronLeft size={16} className="rotate-180" /></button>
                        </div>
                    </div>
                    <div className="px-4 py-2 border-b border-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
                        {legendItems.map(l => (
                            <span key={l.label} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${l.color}`} /> {l.label}
                            </span>
                        ))}
                    </div>
                    {loading ? (
                        <div className="text-sm text-gray-400 text-center py-20">Loading...</div>
                    ) : (
                        <div className="p-2">
                            <div className="grid grid-cols-7 mb-1">
                                {weekDays.map(day => (
                                    <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">{day}</div>
                                ))}
                            </div>
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
                                                key={`d-${weekIdx}-${dayIdx}`}
                                                onClick={() => handleDayClick(dateStr)}
                                                className={`min-h-[80px] md:min-h-[90px] p-1.5 cursor-pointer transition-colors group
                                                    ${isSelected ? 'bg-gray-50 ring-2 ring-inset ring-gray-900' : today ? 'bg-gray-50' : inCurrentMonth ? 'bg-white hover:bg-gray-50/50' : 'bg-gray-50/50'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs leading-none ${today ? 'bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold' : inCurrentMonth ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>
                                                        {format(day, 'd')}
                                                    </span>
                                                    {dayItems.length === 0 && <Plus className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                </div>
                                                <div className="space-y-0.5">
                                                    {dayItems.slice(0, 3).map(item => (
                                                        <div key={item.id} className={`px-1 py-0.5 rounded text-xs leading-tight truncate ${item.color}`} title={item.title}>
                                                            {item.title}
                                                        </div>
                                                    ))}
                                                    {dayItems.length > 3 && (
                                                        <div className="text-xs text-gray-400 text-center">+{dayItems.length - 3} more</div>
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

                {/* Desktop Day Detail */}
                <div className="bg-white rounded-md border border-gray-200 h-fit">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-900">{format(new Date(selectedDate + 'T00:00:00'), 'EEEE')}</p>
                            <p className="text-xs text-gray-500">{format(new Date(selectedDate + 'T00:00:00'), 'dd MMM yyyy')}</p>
                        </div>
                        <button onClick={() => setShowNewEvent(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors">
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
                                {selectedDayEvents.map(event => (
                                    <EventCard key={event.id} event={event} onToggle={() => toggleComplete(event.id, event.status !== 'completed')} onDelete={() => deleteEvent(event.id)} />
                                ))}
                                {selectedDayItems.filter(item => item.type !== 'event').map(item => (
                                    <div key={item.id} onClick={() => item.link && router.push(item.link)} className={`px-3 py-2 rounded-md text-xs cursor-pointer transition-colors hover:opacity-80 ${item.color}`}>
                                        <p className="font-medium">{item.title}</p>
                                        <p className="text-xs opacity-70 capitalize mt-0.5">{typeLabel(item.type)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════
                MOBILE LAYOUT (< lg)
                Compact dot grid → tap → event list
            ══════════════════════════════════════ */}
            <div className="lg:hidden space-y-4">

                {/* Compact Month Calendar */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {/* Month Nav */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <ChevronLeft size={18} className="text-gray-600" />
                        </button>
                        <div className="text-center">
                            <h2 className="text-base font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
                        </div>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <ChevronRight size={18} className="text-gray-600" />
                        </button>
                    </div>

                    {/* Day-of-week headers — single letter */}
                    <div className="grid grid-cols-7 border-b border-gray-50 px-1">
                        {weekDays.map(day => (
                            <div key={day} className="text-center text-[11px] font-semibold text-gray-400 py-2 uppercase tracking-wider">
                                {day.slice(0, 1)}
                            </div>
                        ))}
                    </div>

                    {/* Compact date cells — number + dot indicators only */}
                    {loading ? (
                        <div className="text-sm text-gray-400 text-center py-8">Loading...</div>
                    ) : (
                        <div className="px-1 pb-2">
                            <div className="grid grid-cols-7">
                                {weeks.map((week, weekIdx) =>
                                    week.map((day, dayIdx) => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const bgDots = getDayDots(dateStr);
                                        const solidDots = bgDots.map(bg => dotSolid[bg] || 'bg-gray-400');
                                        const inCurrentMonth = isSameMonth(day, currentMonth);
                                        const today = isToday(day);
                                        const isSelected = selectedDate === dateStr;

                                        return (
                                            <button
                                                key={`m-${weekIdx}-${dayIdx}`}
                                                onClick={() => handleDayClick(dateStr)}
                                                className="flex flex-col items-center py-1 focus:outline-none"
                                            >
                                                <span className={`
                                                    w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-all
                                                    ${today && isSelected
                                                        ? 'bg-gray-900 text-white'
                                                        : isSelected
                                                            ? 'bg-gray-200 text-gray-900'
                                                            : today
                                                                ? 'bg-gray-900 text-white'
                                                                : inCurrentMonth
                                                                    ? 'text-gray-800 hover:bg-gray-100'
                                                                    : 'text-gray-300'
                                                    }
                                                `}>
                                                    {format(day, 'd')}
                                                </span>
                                                {/* Up to 3 event dots */}
                                                <div className="flex items-center justify-center gap-0.5 h-2 mt-0.5">
                                                    {solidDots.map((dotCls, i) => (
                                                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend — compact horizontal */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
                    {legendItems.map(l => (
                        <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.color}`} />
                            {l.label}
                        </span>
                    ))}
                </div>

                {/* ── Selected Day Event List ── */}
                <div ref={dayDetailRef} className="scroll-mt-4">
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-base font-bold text-gray-900">
                                {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, d MMMM')}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {selectedDayItems.length === 0
                                    ? 'Nothing scheduled'
                                    : `${selectedDayItems.length} item${selectedDayItems.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowNewEvent(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>

                    {selectedDayItems.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-10 text-center">
                            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                            <p className="text-sm font-medium text-gray-400">Nothing on this day</p>
                            <p className="text-xs text-gray-300 mt-1">Tap + to add an event</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Personal calendar events */}
                            {selectedDayEvents.map(event => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    onToggle={() => toggleComplete(event.id, event.status !== 'completed')}
                                    onDelete={() => deleteEvent(event.id)}
                                />
                            ))}

                            {/* Business items — clean tappable cards */}
                            {selectedDayItems
                                .filter(item => item.type !== 'event')
                                .map(item => {
                                    const bgClass = item.color.split(' ')[0];
                                    const dotColor = dotSolid[bgClass] || 'bg-gray-400';
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => item.link && router.push(item.link)}
                                            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-start gap-3 active:bg-gray-50 transition-colors"
                                        >
                                            <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 leading-snug">{item.title}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{typeLabel(item.type)}</p>
                                            </div>
                                            {item.link && (
                                                <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-0.5" />
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showNewEvent && (
                <NewEventModal
                    profile={profile}
                    defaultDate={selectedDate}
                    onClose={() => setShowNewEvent(false)}
                    onCreate={createEvent}
                />
            )}
            {showBriefing && (
                <DailyBriefingModal onClose={() => setShowBriefing(false)} />
            )}
        </div>
    );
}
