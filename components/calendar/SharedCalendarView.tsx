'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { UserCalendarEvent } from '@/types/database';
import { Filter, User, Users, Calendar } from 'lucide-react';

interface SharedCalendarViewProps {
    events: any[];  // Google Calendar events from API
    loading?: boolean;
}

export default function SharedCalendarView({ events, loading }: SharedCalendarViewProps) {
    const { profile } = useAuth();
    const [filterMode, setFilterMode] = useState<'my' | 'all' | 'user'>('my');
    const [selectedUser, setSelectedUser] = useState<string>('');

    // Extract all unique users from event titles
    const allUsers = useMemo(() => {
        const users = new Set<string>();
        events.forEach(event => {
            const match = event.summary?.match(/^\[([^\]]+)\]/);
            if (match) users.add(match[1]);
        });
        return Array.from(users).sort();
    }, [events]);

    // Filter events based on selected mode
    const filteredEvents = useMemo(() => {
        if (filterMode === 'my') {
            // Show only current user's events
            return events.filter(event =>
                event.summary?.startsWith(`[${profile?.full_name}]`)
            );
        } else if (filterMode === 'user' && selectedUser) {
            // Show specific user's events
            return events.filter(event =>
                event.summary?.startsWith(`[${selectedUser}]`)
            );
        }
        // Show all events
        return events;
    }, [events, filterMode, selectedUser, profile]);

    // Get event count per user
    const userCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allUsers.forEach(user => {
            counts[user] = events.filter(e => e.summary?.startsWith(`[${user}]`)).length;
        });
        return counts;
    }, [allUsers, events]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="text-center text-gray-500">Loading calendar...</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100">
            {/* FILTER HEADER - TOP INDEXING */}
            <div className="p-4 border-b border-gray-100 bg-gray-900">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {/* Title */}
                    <div className="flex-1">
                        <h2 className="text-section text-gray-900 flex items-center gap-2">
                            📅 Shared Calendar
                            <span className="text-label text-gray-500">
                                ({filteredEvents.length} events)
                            </span>
                        </h2>
                    </div>

                    {/* QUICK FILTERS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* My Events - Default */}
                        <button
                            onClick={() => setFilterMode('my')}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${filterMode === 'my'
                                    ? 'bg-[rgba(0,0,255,0.1)] text-white'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'
                                }`}
                        >
                            <User className="w-4 h-4" />
                            <span className="font-medium">My Events</span>
                            {filterMode === 'my' && (
                                <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                                    {filteredEvents.length}
                                </span>
                            )}
                        </button>

                        {/* All Events */}
                        <button
                            onClick={() => setFilterMode('all')}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${filterMode === 'all'
                                    ? 'bg-[rgba(0,0,255,0.1)] text-white'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            <span className="font-medium">All Events</span>
                        </button>

                        {/* User Dropdown */}
                        <select
                            value={selectedUser}
                            onChange={(e) => {
                                setSelectedUser(e.target.value);
                                if (e.target.value) setFilterMode('user');
                            }}
                            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-primary-300 cursor-pointer"
                        >
                            <option value="">Filter by User...</option>
                            {allUsers.map(user => (
                                <option key={user} value={user}>
                                    {user} ({userCounts[user]})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Active Filter Badge */}
                {filterMode !== 'all' && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                        <Filter className="w-4 h-4 text-primary" />
                        <span className="text-gray-700">
                            Showing events by:{' '}
                            <span className="font-semibold text-primary">
                                {filterMode === 'my' ? profile?.full_name : selectedUser}
                            </span>
                        </span>
                        <button
                            onClick={() => setFilterMode('all')}
                            className="text-primary hover:underline"
                        >
                            Clear filter
                        </button>
                    </div>
                )}

                {/* Quick User Stats */}
                <div className="mt-3 flex gap-2 flex-wrap">
                    {allUsers.slice(0, 5).map(user => (
                        <button
                            key={user}
                            onClick={() => {
                                setSelectedUser(user);
                                setFilterMode('user');
                            }}
                            className={`px-3 py-1 rounded-full text-xs transition-colors ${selectedUser === user && filterMode === 'user'
                                    ? 'bg-[rgba(0,0,255,0.1)] text-white'
                                    : 'bg-white hover:bg-[rgba(0,0,255,0.1)] text-gray-700'
                                }`}
                        >
                            {user}: {userCounts[user]}
                        </button>
                    ))}
                </div>
            </div>

            {/* EVENTS LIST */}
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredEvents.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <Calendar className="w-16 h-16 mx-auto mb-3 opacity-20" />
                        <p className="text-lg mb-2">No events found</p>
                        <p className="text-sm">
                            {filterMode === 'my'
                                ? "You haven't created any calendar events yet"
                                : "No events match this filter"}
                        </p>
                    </div>
                ) : (
                    filteredEvents.map((event, idx) => (
                        <EventCard key={event.id || idx} event={event} currentUser={profile?.full_name || ''} />
                    ))
                )}
            </div>
        </div>
    );
}

function EventCard({ event, currentUser }: { event: any; currentUser: string }) {
    // Extract username from title
    const match = event.summary?.match(/^\[([^\]]+)\] (.+)$/);
    const createdBy = match ? match[1] : 'Unknown';
    const eventTitle = match ? match[2] : event.summary || 'Untitled Event';
    const isMyEvent = createdBy === currentUser;

    // Extract tagged users from description
    const taggedUsers = event.description?.match(/@(\w+)/g)?.map((tag: string) => tag.slice(1)) || [];

    // Format date
    const eventDate = new Date(event.start?.dateTime || event.start?.date);
    const dateStr = eventDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className={`p-4 rounded-xl border-l-4 transition-all  ${isMyEvent
                ? 'border-l-oms-blue-500 bg-[rgba(0,0,255,0.1)]/50'
                : 'border-l-gray-300 bg-gray-50'
            }`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    {/* User Badge & Date */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-label ${isMyEvent
                                ? 'bg-[rgba(0,0,255,0.1)] text-primary'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                            {isMyEvent ? '👤 You' : `👤 ${createdBy}`}
                        </span>
                        <span className="text-xs text-gray-500">{dateStr}</span>
                        {event.start?.dateTime && (
                            <span className="text-xs text-gray-500">
                                {new Date(event.start.dateTime).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        )}
                    </div>

                    {/* Event Title */}
                    <h3 className="font-semibold text-gray-900 mb-1">{eventTitle}</h3>

                    {/* Tagged Users */}
                    {taggedUsers.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500">Tagged:</span>
                            <div className="flex gap-1">
                                {taggedUsers.map((user: string, idx: number) => (
                                    <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                        @{user}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* View Link */}
                    {event.htmlLink && (
                        <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                        >
                            View in Google Calendar →
                        </a>
                    )}
                </div>

                {/* Actions */}
                {isMyEvent && (
                    <div className="flex flex-col gap-1">
                        <button className="text-primary hover:text-primary text-xs">
                            Edit
                        </button>
                        <button className="text-red-600 hover:text-red-700 text-xs">
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
