'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Filter, User, Users, Calendar, Tag } from 'lucide-react';

// Which job stages belong to which role
const ROLE_STAGES: Record<string, string[]> = {
    designer: ['awaiting_admin', 'designing', 'approval'],
    dispatch: ['printing', 'finishing', 'ready', 'packed', 'dispatched', 'delivered'],
    marketing: ['lead', 'follow_up', 'quotation'],
    finance: ['payment', 'invoice'],
    admin: [], // admin sees all — handled separately
};

// Keyword patterns to match events to roles (for Google Calendar events with [Name] prefix)
const ROLE_KEYWORDS: Record<string, RegExp[]> = {
    designer: [/design/i, /artwork/i, /brand/i, /label/i, /logo/i, /print.*ready/i, /revision/i],
    dispatch: [/dispatch/i, /delivery/i, /courier/i, /packed/i, /ready.*dispatch/i, /shipping/i],
    marketing: [/lead/i, /follow.?up/i, /client.*meeting/i, /quotation/i, /quote/i, /presentation/i],
    finance: [/payment/i, /invoice/i, /billing/i, /account/i, /gst/i, /receipt/i],
};

type FilterMode = 'my' | 'tagged' | 'department' | 'all';

interface SharedCalendarViewProps {
    events: any[];
    loading?: boolean;
}

export default function SharedCalendarView({ events, loading }: SharedCalendarViewProps) {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

    // Non-admins default to 'my' — admins default to 'all'
    const [filterMode, setFilterMode] = useState<FilterMode>(isAdmin ? 'all' : 'my');
    const [selectedUser, setSelectedUser] = useState<string>('');

    const myName = profile?.full_name || '';
    const myRole = profile?.role || '';

    // Extract all unique users from event summaries ([Name] Title format)
    const allUsers = useMemo(() => {
        const users = new Set<string>();
        events.forEach(event => {
            const match = event.summary?.match(/^\[([^\]]+)\]/);
            if (match) users.add(match[1]);
        });
        return Array.from(users).sort();
    }, [events]);

    // Check if an event is tagged with the current user
    const isTaggedWithMe = (event: any): boolean => {
        const desc = event.description || '';
        // Match @FirstName or @FullName patterns
        const tags = desc.match(/@[\w\s]+/g) || [];
        return tags.some((tag: string) => {
            const tagName = tag.replace('@', '').trim().toLowerCase();
            return myName.toLowerCase().includes(tagName) ||
                tagName.includes(myName.toLowerCase().split(' ')[0]);
        });
    };

    // Check if an event matches the current user's role by keywords
    const matchesMyRole = (event: any): boolean => {
        if (myRole === 'admin') return true;
        const patterns = ROLE_KEYWORDS[myRole] || [];
        const text = `${event.summary || ''} ${event.description || ''}`;
        return patterns.some(p => p.test(text));
    };

    // Master filter logic
    const filteredEvents = useMemo(() => {
        if (filterMode === 'all') return events; // admin only

        if (filterMode === 'my') {
            // My own events + events where I am @tagged
            return events.filter(event =>
                event.summary?.startsWith(`[${myName}]`) || isTaggedWithMe(event)
            );
        }

        if (filterMode === 'tagged') {
            // Only events where I'm explicitly @tagged by others
            return events.filter(event =>
                !event.summary?.startsWith(`[${myName}]`) && isTaggedWithMe(event)
            );
        }

        if (filterMode === 'department') {
            // Events from my department based on keywords OR same-name pattern
            return events.filter(event =>
                event.summary?.startsWith(`[${myName}]`) ||
                isTaggedWithMe(event) ||
                matchesMyRole(event)
            );
        }

        // Specific user filter (admin sub-mode)
        if (selectedUser) {
            return events.filter(event => event.summary?.startsWith(`[${selectedUser}]`));
        }

        return events;
    }, [events, filterMode, selectedUser, myName, myRole]);

    const taggedEventsCount = useMemo(() =>
        events.filter(e => isTaggedWithMe(e) && !e.summary?.startsWith(`[${myName}]`)).length,
        [events, myName]
    );

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-gray-100 p-6">
                <div className="text-center text-gray-500">Loading calendar...</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-100">
            {/* FILTER HEADER */}
            <div className="p-4 border-b border-gray-100 bg-muted/50">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                        <h2 className="text-section text-gray-900 flex items-center gap-2">
                            📅 Calendar
                            <span className="text-label text-gray-500">
                                ({filteredEvents.length} events)
                            </span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {filterMode === 'my' && 'Showing your events + events shared with you'}
                            {filterMode === 'tagged' && 'Events others have shared with you via @tag'}
                            {filterMode === 'department' && `Showing ${myRole} department events`}
                            {filterMode === 'all' && 'Admin view — all team events'}
                        </p>
                    </div>

                    {/* FILTER TABS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* My Events — always visible */}
                        <button
                            onClick={() => { setFilterMode('my'); setSelectedUser(''); }}
                            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm transition-all ${filterMode === 'my'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <User className="w-3.5 h-3.5" />
                            My Events
                            {filterMode === 'my' && (
                                <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">{filteredEvents.length}</span>
                            )}
                        </button>

                        {/* Tagged with me — show count badge */}
                        <button
                            onClick={() => { setFilterMode('tagged'); setSelectedUser(''); }}
                            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm transition-all ${filterMode === 'tagged'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <Tag className="w-3.5 h-3.5" />
                            Shared with me
                            {taggedEventsCount > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${filterMode === 'tagged' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                    {taggedEventsCount}
                                </span>
                            )}
                        </button>

                        {/* Department — non-admins only */}
                        {!isAdmin && (
                            <button
                                onClick={() => { setFilterMode('department'); setSelectedUser(''); }}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm transition-all capitalize ${filterMode === 'department'
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                {myRole || 'My'} Team
                            </button>
                        )}

                        {/* All Events — ADMIN ONLY */}
                        {isAdmin && (
                            <>
                                <button
                                    onClick={() => { setFilterMode('all'); setSelectedUser(''); }}
                                    className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm transition-all ${filterMode === 'all'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    All Events
                                </button>

                                {/* Filter by specific user — admin only */}
                                {filterMode === 'all' && allUsers.length > 0 && (
                                    <select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 text-sm hover:border-gray-300 cursor-pointer"
                                    >
                                        <option value="">All users...</option>
                                        {allUsers.map(user => (
                                            <option key={user} value={user}>{user}</option>
                                        ))}
                                    </select>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Active filter info */}
                {filterMode !== 'all' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Filter className="w-3.5 h-3.5 text-primary" />
                        <span>
                            {filterMode === 'my' && `Showing events by ${myName} + events shared with you`}
                            {filterMode === 'tagged' && `Events where @${myName.split(' ')[0]} was tagged`}
                            {filterMode === 'department' && `${myRole} department events`}
                        </span>
                    </div>
                )}
            </div>

            {/* EVENTS LIST */}
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredEvents.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <Calendar className="w-16 h-16 mx-auto mb-3 opacity-20" />
                        <p className="text-lg mb-2">No events found</p>
                        <p className="text-sm">
                            {filterMode === 'my'
                                ? "You haven't created any events yet. Create one with + New Event."
                                : filterMode === 'tagged'
                                    ? "No one has shared any events with you yet."
                                    : "No department events found."}
                        </p>
                    </div>
                ) : (
                    filteredEvents.map((event, idx) => (
                        <EventCard key={event.id || idx} event={event} currentUser={myName} />
                    ))
                )}
            </div>
        </div>
    );
}

function EventCard({ event, currentUser }: { event: any; currentUser: string }) {
    const match = event.summary?.match(/^\[([^\]]+)\] (.+)$/);
    const createdBy = match ? match[1] : 'Unknown';
    const eventTitle = match ? match[2] : event.summary || 'Untitled Event';
    const isMyEvent = createdBy === currentUser;

    // Extract @tagged users from description
    const taggedUsers = event.description?.match(/@[\w]+/g)?.map((tag: string) => tag.slice(1)) || [];
    const isTaggedHere = taggedUsers.some((u: string) =>
        currentUser.toLowerCase().includes(u.toLowerCase()) ||
        u.toLowerCase().includes(currentUser.toLowerCase().split(' ')[0])
    );

    const eventDate = new Date(event.start?.dateTime || event.start?.date);
    const dateStr = eventDate.toLocaleDateString('en-IN', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    const borderColor = isMyEvent
        ? 'border-l-primary bg-primary/5'
        : isTaggedHere
            ? 'border-l-blue-500 bg-blue-50'
            : 'border-l-gray-300 bg-gray-50';

    return (
        <div className={`p-4 rounded-lg border-l-4 transition-all ${borderColor}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* User Badge + Date */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${isMyEvent ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-700'}`}>
                            {isMyEvent ? '👤 You' : `👤 ${createdBy}`}
                        </span>
                        {isTaggedHere && !isMyEvent && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                📌 Shared with you
                            </span>
                        )}
                        <span className="text-xs text-gray-500">{dateStr}</span>
                        {event.start?.dateTime && (
                            <span className="text-xs text-gray-500">
                                {new Date(event.start.dateTime).toLocaleTimeString('en-IN', {
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-gray-900 mb-1">{eventTitle}</h3>

                    {/* Description (non-tag part) */}
                    {event.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{event.description}</p>
                    )}

                    {/* Tagged users chips */}
                    {taggedUsers.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-gray-400">Tagged:</span>
                            {taggedUsers.map((user: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                    @{user}
                                </span>
                            ))}
                        </div>
                    )}

                    {event.htmlLink && (
                        <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 inline-block"
                        >
                            Open in Google Calendar →
                        </a>
                    )}
                </div>

                {/* Edit/Delete — own events only */}
                {isMyEvent && (
                    <div className="flex flex-col gap-1 shrink-0">
                        <button className="text-primary hover:text-primary text-xs">Edit</button>
                        <button className="text-red-600 hover:text-red-700 text-xs">Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
}
