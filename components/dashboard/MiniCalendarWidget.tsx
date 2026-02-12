'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
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

interface CalendarItem {
    id: string;
    title: string;
    date: string; // yyyy-MM-dd
    type: 'event' | 'deadline' | 'followup' | 'dispatch';
    status?: string;
    color: string; // tailwind color class
}

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

    const { events, createEvent, toggleComplete, loading: eventsLoading } = useCalendarEvents(startDate, endDate);

    // Auto-fetch business data from DB
    const [businessItems, setBusinessItems] = useState<CalendarItem[]>([]);
    const [bizLoading, setBizLoading] = useState(true);

    useEffect(() => {
        const fetchBusinessData = async () => {
            setBizLoading(true);
            try {
                const [jobsRes, followUpsRes, dispatchRes] = await Promise.all([
                    // Job deadlines in this date range
                    supabase.from('jobs')
                        .select('id, job_number, project_name, client_deadline, current_stage')
                        .gte('client_deadline', startDate)
                        .lte('client_deadline', endDate)
                        .neq('current_stage', 'cancelled'),
                    // Follow-ups due in this range
                    supabase.from('follow_ups')
                        .select('id, title, follow_up_date, status')
                        .gte('follow_up_date', startDate)
                        .lte('follow_up_date', endDate),
                    // Dispatches scheduled in this range
                    supabase.from('dispatches')
                        .select('id, dispatch_date, status, job_id')
                        .gte('dispatch_date', startDate)
                        .lte('dispatch_date', endDate),
                ]);

                const items: CalendarItem[] = [];

                // Job deadlines
                jobsRes.data?.forEach(j => {
                    if (j.client_deadline) {
                        const dateStr = j.client_deadline.split('T')[0];
                        items.push({
                            id: `job-${j.id}`,
                            title: `📦 ${j.job_number}: ${j.project_name || 'Job'}`,
                            date: dateStr,
                            type: 'deadline',
                            status: j.current_stage,
                            color: 'bg-amber-100 text-amber-800',
                        });
                    }
                });

                // Follow-ups
                followUpsRes.data?.forEach(f => {
                    if (f.follow_up_date) {
                        items.push({
                            id: `followup-${f.id}`,
                            title: `📞 ${f.title || 'Follow-up'}`,
                            date: f.follow_up_date,
                            type: 'followup',
                            status: f.status,
                            color: 'bg-blue-100 text-blue-800',
                        });
                    }
                });

                // Dispatches
                dispatchRes.data?.forEach(d => {
                    if (d.dispatch_date) {
                        items.push({
                            id: `dispatch-${d.id}`,
                            title: `🚚 Dispatch`,
                            date: d.dispatch_date.split('T')[0],
                            type: 'dispatch',
                            status: d.status,
                            color: 'bg-green-100 text-green-800',
                        });
                    }
                });

                setBusinessItems(items);
            } catch (err) {
                console.error('Error fetching calendar business data:', err);
            } finally {
                setBizLoading(false);
            }
        };

        fetchBusinessData();
    }, [startDate, endDate]);

    const loading = eventsLoading || bizLoading;

    // Combine personal events + business items
    const allItems = useMemo(() => {
        const items: CalendarItem[] = [];

        // Personal calendar events
        if (events && profile?.id) {
            events
                .filter(e => e.user_id === profile.id || (e.tagged_users && e.tagged_users.includes(profile.id)))
                .forEach(e => {
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

        // Business items
        items.push(...businessItems);

        return items;
    }, [events, profile?.id, businessItems]);

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
                                                                }
                                                            }}
                                                            className={`px-1 py-0.5 rounded text-[10px] leading-tight truncate cursor-pointer transition-colors ${item.color}`}
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
