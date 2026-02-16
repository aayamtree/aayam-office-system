'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
import { fetchCalendarBusinessData, CalendarItem } from '@/lib/calendar-data';
import NewEventModal from '@/components/calendar/NewEventModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar, ArrowRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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

export default function MiniCalendarWidget() {
    const { profile } = useAuth();
    const router = useRouter();
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Fetch events for the visible range (full month + overflow days)
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const startDate = format(calendarStart, 'yyyy-MM-dd');
    const endDate = format(calendarEnd, 'yyyy-MM-dd');

    const { events, createEvent, toggleComplete, loading: eventsLoading } = useCalendarEvents(startDate, endDate);

    // Fetch ALL business data via shared utility (role-aware)
    const [businessItems, setBusinessItems] = useState<CalendarItem[]>([]);

    useEffect(() => {
        if (!profile?.id) return;
        fetchCalendarBusinessData(startDate, endDate, profile.role || 'admin', profile.id)
            .then(items => setBusinessItems(items))
            .catch(err => console.error('Calendar data fetch error:', err));
    }, [startDate, endDate, profile?.id, profile?.role]);

    const loading = eventsLoading;

    // Combine personal events + business items
    const isAdmin = profile?.role === 'admin';
    const allItems = useMemo(() => {
        const items: CalendarItem[] = [];

        // Personal calendar events (admin sees all, others see own + tagged)
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

        // Business items
        items.push(...businessItems);

        return items;
    }, [events, profile?.id, isAdmin, businessItems]);

    const todayDate = new Date();

    // Build calendar grid (weeks × 7 days)
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

    // New event modal
    const [showNewEvent, setShowNewEvent] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(format(todayDate, 'yyyy-MM-dd'));

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr);
        setShowNewEvent(true);
    };

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4" strokeWidth={1.5} />
                            {format(currentMonth, 'MMMM yyyy')}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setCurrentMonth(new Date())}
                            >
                                Today
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <div className="w-px h-5 bg-border mx-1" />
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                                <Link href="/admin/calendar">
                                    Full Calendar <ArrowRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Deadline</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Follow-up</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Dispatch</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Event</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Invoice</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Print Run</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Lead</span>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
                    ) : (
                        <div className="w-full">
                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 mb-1">
                                {weekDays.map(day => (
                                    <div
                                        key={day}
                                        className="text-center text-xs font-medium text-muted-foreground py-2"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border border-border">
                                {weeks.map((week, weekIdx) =>
                                    week.map((day, dayIdx) => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const dayItems = allItems.filter(e => e.date === dateStr);
                                        const inCurrentMonth = isSameMonth(day, currentMonth);
                                        const today = isToday(day);

                                        return (
                                            <div
                                                key={`${weekIdx}-${dayIdx}`}
                                                onClick={() => handleDayClick(dateStr)}
                                                className={`min-h-[72px] md:min-h-[80px] p-1.5 cursor-pointer transition-colors group ${today
                                                    ? 'bg-gray-100'
                                                    : inCurrentMonth
                                                        ? 'bg-background hover:bg-muted/50'
                                                        : 'bg-muted/30'
                                                    }`}
                                            >
                                                {/* Day Number */}
                                                <div className="flex items-center justify-between mb-1">
                                                    <span
                                                        className={`text-xs leading-none ${today
                                                            ? 'bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center font-bold'
                                                            : inCurrentMonth
                                                                ? 'text-foreground font-medium'
                                                                : 'text-muted-foreground/50'
                                                            }`}
                                                    >
                                                        {format(day, 'd')}
                                                    </span>
                                                    {dayItems.length === 0 && (
                                                        <Plus className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </div>

                                                {/* Items */}
                                                <div className="space-y-0.5">
                                                    {dayItems.slice(0, 2).map(item => (
                                                        <div
                                                            key={item.id}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                if (item.type === 'event') {
                                                                    const eventId = item.id.replace('event-', '');
                                                                    toggleComplete(eventId, item.status !== 'completed');
                                                                } else if (item.link) {
                                                                    router.push(item.link);
                                                                }
                                                            }}
                                                            className={`px-1 py-0.5 rounded text-[10px] leading-tight truncate cursor-pointer transition-colors hover:opacity-80 ${item.color}`}
                                                            title={item.title}
                                                        >
                                                            {item.title}
                                                        </div>
                                                    ))}
                                                    {dayItems.length > 2 && (
                                                        <div className="text-[10px] text-muted-foreground text-center">
                                                            +{dayItems.length - 2} more
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
                </CardContent>
            </Card>

            {/* New Event Modal */}
            {showNewEvent && (
                <NewEventModal
                    profile={profile}
                    defaultDate={selectedDate}
                    onClose={() => setShowNewEvent(false)}
                    onCreate={createEvent}
                />
            )}
        </>
    );
}
