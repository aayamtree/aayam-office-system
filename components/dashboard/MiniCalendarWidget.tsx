'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
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
    isSameDay,
    isToday,
} from 'date-fns';

export default function MiniCalendarWidget() {
    const { profile } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Fetch events for the visible range (full month + overflow days)
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const startDate = format(calendarStart, 'yyyy-MM-dd');
    const endDate = format(calendarEnd, 'yyyy-MM-dd');

    const { events, createEvent, toggleComplete, loading } = useCalendarEvents(startDate, endDate);

    // Filter: my events + events where I'm tagged
    const myEvents = useMemo(() => {
        if (!events || !profile?.id) return [];
        return events.filter(e =>
            e.user_id === profile.id ||
            (e.tagged_users && e.tagged_users.includes(profile.id))
        );
    }, [events, profile?.id]);

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
                                        const dayEvents = myEvents.filter(e => e.start_date === dateStr);
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
                                                    {dayEvents.length === 0 && (
                                                        <Plus className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </div>

                                                {/* Events */}
                                                <div className="space-y-0.5">
                                                    {dayEvents.slice(0, 2).map(event => (
                                                        <div
                                                            key={event.id}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                toggleComplete(event.id, event.status !== 'completed');
                                                            }}
                                                            className={`px-1 py-0.5 rounded text-[10px] leading-tight truncate cursor-pointer transition-colors ${event.status === 'completed'
                                                                    ? 'bg-muted text-muted-foreground line-through'
                                                                    : 'bg-foreground/10 text-foreground hover:bg-foreground/20'
                                                                }`}
                                                            title={event.title}
                                                        >
                                                            {event.title}
                                                        </div>
                                                    ))}
                                                    {dayEvents.length > 2 && (
                                                        <div className="text-[10px] text-muted-foreground text-center">
                                                            +{dayEvents.length - 2} more
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
