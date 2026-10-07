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
import { ScrollList } from '@/components/ui/ScrollList';
import { Calendar, ArrowRight, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import {
    format,
    startOfWeek,
    endOfWeek,
    addDays,
    addWeeks,
    subWeeks,
    isToday,
} from 'date-fns';

// ─── Dot colors by item type ─────────────────────────────────────
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

export default function MiniCalendarWidget() {
    const { profile } = useAuth();
    const router = useRouter();
    const dayDetailRef = useRef<HTMLDivElement>(null);

    // Track the week anchor (Monday of displayed week)
    const [weekAnchor, setWeekAnchor] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    );

    const weekStart = weekAnchor;
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const startDate = format(weekStart, 'yyyy-MM-dd');
    const endDate = format(weekEnd, 'yyyy-MM-dd');

    const { events, createEvent, toggleComplete } = useCalendarEvents(startDate, endDate);
    const [businessItems, setBusinessItems] = useState<CalendarItem[]>([]);

    useEffect(() => {
        if (!profile?.id) return;
        fetchCalendarBusinessData(startDate, endDate, profile.role || 'admin', profile.id)
            .then(items => setBusinessItems(items))
            .catch(err => console.error('Calendar data fetch error:', err));
    }, [startDate, endDate, profile?.id, profile?.role]);

    const isAdmin = profile?.role === 'admin';

    // Build all items for the week
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

    // 7-day array for the current week
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }, [weekStart]);

    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [showNewEvent, setShowNewEvent] = useState(false);
    // Fold = hide the day's list entirely, leaving a compact card.
    const [folded, setFolded] = useState(false);

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr);
        setTimeout(() => {
            dayDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    };

    const selectedDayItems = useMemo(() =>
        allItems.filter(item => item.date === selectedDate),
        [allItems, selectedDate]
    );

    // Does a day have events? For the dot indicator
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

    // Week label (e.g. "3 – 9 Mar" or "28 Feb – 6 Mar")
    const weekLabel = (() => {
        const s = weekStart;
        const e = weekEnd;
        if (s.getMonth() === e.getMonth()) {
            return `${format(s, 'd')} – ${format(e, 'd MMM')}`;
        }
        return `${format(s, 'd MMM')} – ${format(e, 'd MMM')}`;
    })();

    const isThisWeek = format(weekStart, 'yyyy-MM-dd') === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4" strokeWidth={1.5} />
                            <span>{weekLabel}</span>
                        </CardTitle>
                        <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => setWeekAnchor(subWeeks(weekAnchor, 1))}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            {!isThisWeek && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs"
                                    onClick={() => {
                                        const today = new Date();
                                        setWeekAnchor(startOfWeek(today, { weekStartsOn: 1 }));
                                        setSelectedDate(format(today, 'yyyy-MM-dd'));
                                    }}>
                                    Today
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => setWeekAnchor(addWeeks(weekAnchor, 1))}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <div className="w-px h-5 bg-border mx-1" />
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                                <Link href="/admin/calendar">
                                    Month <ArrowRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="px-2 pb-3 sm:px-4">
                    {/* ── Week Grid (both mobile & desktop) ── */}
                    <div className="grid grid-cols-7 gap-px mb-1">
                        {weekDays.map(day => (
                            <div key={day.toString()} className="text-center text-[11px] font-semibold text-muted-foreground py-1.5 uppercase tracking-wide">
                                {format(day, 'EEE').slice(0, 1)}
                            </div>
                        ))}
                    </div>

                    {/* Day buttons — compact number + dots */}
                    <div className="grid grid-cols-7 gap-px mb-3">
                        {weekDays.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dots = getDayDots(dateStr);
                            const today = isToday(day);
                            const isSelected = selectedDate === dateStr;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => handleDayClick(dateStr)}
                                    className="flex flex-col items-center py-1 focus:outline-none"
                                >
                                    <span className={`
                                        w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-all
                                        ${today && isSelected ? 'bg-foreground text-background'
                                            : isSelected ? 'bg-muted text-foreground ring-1 ring-border'
                                                : today ? 'bg-foreground text-background'
                                                    : 'text-foreground hover:bg-muted'}
                                    `}>
                                        {format(day, 'd')}
                                    </span>
                                    <div className="flex items-center justify-center gap-0.5 h-2.5 mt-0.5">
                                        {dots.map((dotCls, i) => (
                                            <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                        ))}
                                        {dots.length === 0 && <span className="w-1.5 h-1.5" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Day event list (below the week row) ── */}
                    <div ref={dayDetailRef} className="border-t border-border scroll-mt-2">
                        <div className="flex items-center justify-between pt-2.5 pb-2">
                            <div>
                                <p className="text-sm font-bold text-foreground">
                                    {format(new Date(selectedDate + 'T00:00:00'), 'EEE, d MMM')}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    {selectedDayItems.length === 0
                                        ? 'Nothing scheduled'
                                        : `${selectedDayItems.length} item${selectedDayItems.length !== 1 ? 's' : ''}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                            {selectedDayItems.length > 0 && (
                                <button
                                    onClick={() => setFolded(f => !f)}
                                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg border border-border"
                                    aria-expanded={!folded}
                                >
                                    {folded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                                    {folded ? 'Show' : 'Fold'}
                                </button>
                            )}
                            <button
                                onClick={() => setShowNewEvent(true)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-foreground text-background rounded-lg"
                            >
                                <Plus size={13} /> Add
                            </button>
                            </div>
                        </div>

                        {selectedDayItems.length === 0 ? (
                            <div className="py-4 text-center text-muted-foreground">
                                <p className="text-xs">Nothing on this day</p>
                            </div>
                        ) : folded ? null : (
                            <ScrollList size="md" className="space-y-1.5 pb-1">
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
                                            className="flex items-start gap-2.5 px-3 py-2 bg-background rounded-lg border border-border active:bg-muted/50 transition-colors cursor-pointer"
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
                            </ScrollList>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-2.5 border-t border-border">
                        {[
                            ['bg-amber-400', 'Deadline'],
                            ['bg-blue-400', 'Follow-up'],
                            ['bg-green-500', 'Dispatch'],
                            ['bg-violet-500', 'Event'],
                            ['bg-rose-400', 'Invoice'],
                            ['bg-orange-400', 'Print Run'],
                            ['bg-purple-500', 'Lead'],
                        ].map(([color, label]) => (
                            <span key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                                {label}
                            </span>
                        ))}
                    </div>
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
