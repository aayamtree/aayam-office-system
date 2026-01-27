'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCalendarEvents } from '@/lib/hooks';
import GoogleConnectionStatus from '@/components/google/GoogleConnectionStatus';
import DailyBriefingModal from '@/components/calendar/DailyBriefingModal';
import MentionInput from '@/components/calendar/MentionInput';
import { Calendar, Plus, X, CheckCircle, Clock } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { UserCalendarEvent } from '@/types/database';

export default function CalendarPage() {
    const { profile } = useAuth();
    const [showBriefing, setShowBriefing] = useState(false);
    const [showNewEvent, setShowNewEvent] = useState(false);

    // Get events for current week
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const weekEnd = addDays(weekStart, 6);

    const { events, createEvent, toggleComplete, deleteEvent, loading } = useCalendarEvents(
        format(weekStart, 'yyyy-MM-dd'),
        format(weekEnd, 'yyyy-MM-dd')
    );

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">📅 My Calendar</h1>
                    <p className="text-gray-600 mt-1">Manage your personal schedule and tasks</p>
                </div>

                <div className="flex items-center gap-3">
                    <GoogleConnectionStatus />
                    <button
                        onClick={() => setShowBriefing(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        📋 Daily Briefing
                    </button>
                </div>
            </div>

            {/* Week Planner */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">This Week</h2>
                    <button
                        onClick={() => setShowNewEvent(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Event
                    </button>
                </div>

                {/* Week Grid */}
                <div className="grid grid-cols-7 gap-4">
                    {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
                        const day = addDays(weekStart, dayOffset);
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayEvents = events.filter(e => e.start_date === dateStr);
                        const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                        return (
                            <div
                                key={dayOffset}
                                className={`border rounded-lg p-3 ${isToday ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                                    }`}
                            >
                                <div className="text-center mb-2">
                                    <div className="text-xs text-gray-500">{format(day, 'EEE')}</div>
                                    <div className={`text-lg font-bold ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
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
                                        <div className="text-xs text-gray-400 text-center py-2">No events</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* All Events List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">All Events</h2>
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

            {/* New Event Modal */}
            {showNewEvent && (
                <NewEventModal
                    profile={profile}
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

function EventCard({ event, showDate, onToggle, onDelete }: {
    event: UserCalendarEvent;
    showDate?: boolean;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const isCompleted = event.status === 'completed';
    const priorityColors = {
        low: 'bg-gray-100 text-gray-700',
        normal: 'bg-blue-100 text-blue-700',
        high: 'bg-orange-100 text-orange-700',
        urgent: 'bg-red-100 text-red-700'
    };

    return (
        <div className={`p-3 rounded-lg border-l-4 ${isCompleted ? 'bg-green-50 border-l-green-500 opacity-60' : 'bg-gray-50 border-l-indigo-500'
            }`}>
            <div className="flex items-start gap-2">
                <button
                    onClick={onToggle}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${isCompleted
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 hover:border-indigo-500'
                        }`}
                >
                    {isCompleted && <CheckCircle className="w-4 h-4 text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold text-sm truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                            }`}>
                            {event.title}
                        </h3>
                        {!isCompleted && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${priorityColors[event.priority]
                                }`}>
                                {event.priority}
                            </span>
                        )}
                    </div>

                    {event.description && (
                        <p className="text-xs text-gray-600 line-clamp-1">{event.description}</p>
                    )}

                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {event.start_time ? event.start_time.slice(0, 5) : 'All day'}
                        {showDate && <span>• {format(new Date(event.start_date), 'MMM d')}</span>}
                    </div>
                </div>

                <button
                    onClick={onDelete}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function NewEventModal({ profile, onClose, onCreate }: {
    profile: any;
    onClose: () => void;
    onCreate: (event: Partial<UserCalendarEvent>) => Promise<any>;
}) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [time, setTime] = useState('');
    const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
    const [allDay, setAllDay] = useState(true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!profile?.id) {
            alert('User not authenticated');
            return;
        }

        try {
            await onCreate({
                user_id: profile.id,
                title,
                description,
                start_date: date,
                start_time: allDay ? undefined : time,
                all_day: allDay,
                priority,
                status: 'pending',
                event_type: 'task',
                tagged_users: taggedUsers,
                color: '#3b82f6'
            });

            onClose();
        } catch (error) {
            console.error('Failed to create event:', error);
            alert('Failed to create event');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">New Event</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description (use @ to tag team members)
                        </label>
                        <MentionInput
                            value={description}
                            onChange={(val, users) => {
                                setDescription(val);
                                setTaggedUsers(users);
                            }}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date *
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priority
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as any)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="low">Low</option>
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={allDay}
                                onChange={(e) => setAllDay(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm text-gray-700">All day event</span>
                        </label>

                        {!allDay && (
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Create Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
