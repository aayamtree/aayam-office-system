'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
import NewEventModal from '@/components/calendar/NewEventModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar, ArrowRight, Clock, Plus } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';

export default function MiniCalendarWidget() {
    const { profile } = useAuth();

    // Same hook as full calendar page — same DB, same data
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const startDate = format(weekStart, 'yyyy-MM-dd');
    const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const { events, createEvent, toggleComplete, loading } = useCalendarEvents(startDate, endDate);

    // Filter: my events + events where I'm tagged
    const myEvents = useMemo(() => {
        if (!events || !profile?.id) return [];
        return events.filter(e =>
            e.user_id === profile.id ||
            (e.tagged_users && e.tagged_users.includes(profile.id))
        );
    }, [events, profile?.id]);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Click on day → open the SAME modal as full calendar page
    const [showNewEvent, setShowNewEvent] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(todayStr);

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr);
        setShowNewEvent(true);
    };

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4" strokeWidth={1.5} />
                            This Week
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                            <Link href="/admin/calendar">
                                Full Calendar <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-sm text-muted-foreground text-center py-6">Loading...</div>
                    ) : (
                        <>
                            {/* Week Grid — same layout as full calendar page */}
                            <div className="grid grid-cols-7 gap-1.5">
                                {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
                                    const day = addDays(weekStart, dayOffset);
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const dayEvents = myEvents.filter(e => e.start_date === dateStr);
                                    const isToday = dateStr === todayStr;

                                    return (
                                        <div
                                            key={dayOffset}
                                            onClick={() => handleDayClick(dateStr)}
                                            className={`border rounded-lg p-2 min-h-[80px] transition-colors cursor-pointer group ${isToday
                                                ? 'border-gray-400 bg-gray-100'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {/* Day Header */}
                                            <div className="text-center mb-1.5">
                                                <div className="text-[10px] text-gray-500">{format(day, 'EEE')}</div>
                                                <div className={`text-sm font-semibold ${isToday ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {format(day, 'd')}
                                                </div>
                                            </div>

                                            {/* Event indicators */}
                                            <div className="space-y-1">
                                                {dayEvents.slice(0, 2).map(event => (
                                                    <div
                                                        key={event.id}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            toggleComplete(event.id, event.status !== 'completed');
                                                        }}
                                                        className={`px-1.5 py-0.5 rounded text-[10px] leading-tight truncate border-l-2 cursor-pointer transition-colors ${event.status === 'completed'
                                                            ? 'bg-white border-l-gray-300 text-gray-400 line-through'
                                                            : 'bg-gray-50 border-l-gray-400 text-gray-700 hover:bg-gray-100'
                                                            }`}
                                                        title={event.title}
                                                    >
                                                        {event.title}
                                                    </div>
                                                ))}
                                                {dayEvents.length > 2 && (
                                                    <div className="text-[10px] text-gray-400 text-center">
                                                        +{dayEvents.length - 2} more
                                                    </div>
                                                )}
                                            </div>

                                            {/* + icon on hover for empty days */}
                                            {dayEvents.length === 0 && (
                                                <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Plus className="h-3 w-3 mx-auto text-gray-300" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Today's Summary */}
                            {(() => {
                                const todayEvents = myEvents.filter(e => e.start_date === todayStr);
                                const pending = todayEvents.filter(e => e.status !== 'completed');
                                const completed = todayEvents.filter(e => e.status === 'completed');

                                return todayEvents.length > 0 ? (
                                    <div className="mt-3 pt-2 border-t border-gray-200">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-medium text-gray-700">Today</span>
                                            <span className="text-[10px] text-gray-500">
                                                {completed.length}/{todayEvents.length} done
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            {pending.slice(0, 3).map(event => (
                                                <div key={event.id} className="flex items-center gap-2 text-xs">
                                                    <Clock className="h-3 w-3 text-gray-400 shrink-0" />
                                                    <span className="truncate text-gray-700">{event.title}</span>
                                                    {event.start_time && (
                                                        <span className="text-gray-400 shrink-0 ml-auto">
                                                            {event.start_time.slice(0, 5)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Same NewEventModal as full calendar page */}
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
