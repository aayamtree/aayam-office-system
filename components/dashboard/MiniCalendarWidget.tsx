'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
    const dayDetailRef = useRef<HTMLDivElement>(null);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const startDate = format(calendarStart, 'yyyy-MM-dd');
    const endDate = format(calendarEnd, 'yyyy-MM-dd');

    const { events, createEvent, toggleComplete, loading: eventsLoading } = useCalendarEvents(startDate, endDate);
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

    const todayDate = new Date();

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

    const [showNewEvent, setShowNewEvent] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(format(todayDate, 'yyyy-MM-dd'));

    // Desktop: clicking opens new event modal
    // Mobile: clicking selects date and shows event list below
    const handleDayClick = (dateStr: string, isMobile: boolean) => {
        setSelectedDate(dateStr);
        if (isMobile) {
            setTimeout(() => {
                dayDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        } else {
            setShowNewEvent(true);
        }
    };

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Color dot map: bg-light → solid dot
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

    // Get up to 3 unique-type dot classes for a date (mobile)
    const getDayDots = (dateStr: string) => {
        const dayItems = allItems.filter(e => e.date === dateStr);
        const seen = new Set<string>();
        const dots: string[] = [];
        for (const item of dayItems) {
            if (!seen.has(item.type) && dots.length < 3) {
                seen.add(item.type);
                const bg = item.color.split(' ')[0];
                dots.push(dotSolid[bg] || 'bg-gray-400');
            }
        }
        return dots;
    };

    const selectedDayItems = useMemo(() =>
        allItems.filter(item => item.date === selectedDate),
        [allItems, selectedDate]
    );

    const selectedDayEvents = useMemo(() => {
        if (!events) return [];
        return events.filter(e => e.start_date === selectedDate);
    }, [events, selectedDate]);

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
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCurrentMonth(new Date())}>
                                Today
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
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

                <CardContent className="px-2 pb-2 sm:px-6 sm:pb-6">
                    {loading ? (
                        <div className="space-y-1">
                            <div className="grid grid-cols-7 mb-1">
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                    <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-px">
                                {Array.from({ length: 35 }).map((_, i) => (
                                    <div key={i} className="min-h-[72px] md:min-h-[80px] bg-muted/30 animate-pulse rounded-sm" />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ══════════════════════════════
                                DESKTOP GRID (sm+): with text labels
                            ══════════════════════════════ */}
                            <div className="hidden sm:block w-full">
                                <div className="grid grid-cols-7 mb-1">
                                    {weekDays.map(day => (
                                        <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border border-border">
                                    {weeks.map((week, weekIdx) =>
                                        week.map((day, dayIdx) => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const dayItems = allItems.filter(e => e.date === dateStr);
                                            const inCurrentMonth = isSameMonth(day, currentMonth);
                                            const today = isToday(day);
                                            return (
                                                <div
                                                    key={`d-${weekIdx}-${dayIdx}`}
                                                    onClick={() => handleDayClick(dateStr, false)}
                                                    className={`min-h-[72px] md:min-h-[80px] p-1.5 cursor-pointer transition-colors group
                                                        ${today ? 'bg-gray-100' : inCurrentMonth ? 'bg-background hover:bg-muted/50' : 'bg-muted/30'}`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-xs leading-none ${today ? 'bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center font-bold' : inCurrentMonth ? 'text-foreground font-medium' : 'text-muted-foreground/50'}`}>
                                                            {format(day, 'd')}
                                                        </span>
                                                        {dayItems.length === 0 && <Plus className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                    </div>
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
                                                            <div className="text-[10px] text-muted-foreground text-center">+{dayItems.length - 2} more</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* ══════════════════════════════
                                MOBILE GRID (< sm): compact dots only
                            ══════════════════════════════ */}
                            <div className="sm:hidden">
                                {/* Day headers — single letter */}
                                <div className="grid grid-cols-7 mb-0.5">
                                    {weekDays.map(day => (
                                        <div key={day} className="text-center text-[11px] font-semibold text-muted-foreground py-1.5 uppercase">
                                            {day.slice(0, 1)}
                                        </div>
                                    ))}
                                </div>

                                {/* Compact date cells */}
                                <div className="grid grid-cols-7">
                                    {weeks.map((week, weekIdx) =>
                                        week.map((day, dayIdx) => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const dots = getDayDots(dateStr);
                                            const inCurrentMonth = isSameMonth(day, currentMonth);
                                            const today = isToday(day);
                                            const isSelected = selectedDate === dateStr;
                                            return (
                                                <button
                                                    key={`m-${weekIdx}-${dayIdx}`}
                                                    onClick={() => handleDayClick(dateStr, true)}
                                                    className="flex flex-col items-center py-1 focus:outline-none"
                                                >
                                                    <span className={`
                                                        w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-all
                                                        ${today && isSelected ? 'bg-foreground text-background'
                                                            : isSelected ? 'bg-muted text-foreground'
                                                                : today ? 'bg-foreground text-background'
                                                                    : inCurrentMonth ? 'text-foreground hover:bg-muted'
                                                                        : 'text-muted-foreground/40'}
                                                    `}>
                                                        {format(day, 'd')}
                                                    </span>
                                                    <div className="flex items-center justify-center gap-0.5 h-2 mt-0.5">
                                                        {dots.map((dotCls, i) => (
                                                            <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                                        ))}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* ── Selected Day Event List (mobile only) ── */}
                                <div ref={dayDetailRef} className="mt-3 pt-3 border-t border-border scroll-mt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">
                                                {format(new Date(selectedDate + 'T00:00:00'), 'EEE, d MMM')}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {selectedDayItems.length === 0 ? 'Nothing scheduled' : `${selectedDayItems.length} item${selectedDayItems.length !== 1 ? 's' : ''}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowNewEvent(true)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-foreground text-background rounded-lg"
                                        >
                                            <Plus size={13} /> Add
                                        </button>
                                    </div>

                                    {selectedDayItems.length === 0 ? (
                                        <div className="py-5 text-center text-muted-foreground">
                                            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                            <p className="text-xs">Nothing on this day</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedDayItems.map(item => {
                                                const bgClass = item.color.split(' ')[0];
                                                const dotColor = dotSolid[bgClass] || 'bg-gray-400';
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            if (item.type === 'event') {
                                                                const eventId = item.id.replace('event-', '');
                                                                toggleComplete(eventId, item.status !== 'completed');
                                                            } else if (item.link) {
                                                                router.push(item.link);
                                                            }
                                                        }}
                                                        className="flex items-start gap-2.5 px-3 py-2.5 bg-background rounded-lg border border-border active:bg-muted/50 transition-colors"
                                                    >
                                                        <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-foreground leading-snug truncate">{item.title}</p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">{typeLabel(item.type)}</p>
                                                        </div>
                                                        {item.link && <ChevronRight size={14} className="text-muted-foreground/40 flex-shrink-0 mt-0.5" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

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
