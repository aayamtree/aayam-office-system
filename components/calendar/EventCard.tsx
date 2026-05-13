'use client';

import { CheckCircle, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { UserCalendarEvent } from '@/types/database';

interface EventCardProps {
    event: UserCalendarEvent;
    showDate?: boolean;
    onToggle: () => void;
    onDelete: () => void;
}

export default function EventCard({ event, showDate, onToggle, onDelete }: EventCardProps) {
    const isCompleted = event.status === 'completed';
    const priorityColors = {
        low: 'bg-gray-100 text-gray-700',
        normal: 'bg-gray-200 text-gray-800',
        high: 'bg-gray-300 text-gray-900',
        urgent: 'bg-gray-400 text-gray-900'
    };

    return (
        <div className={`p-3 rounded-lg border-l-4 ${isCompleted ? 'bg-white border-l-gray-400 opacity-60' : 'bg-gray-50 border-l-gray-300'
            }`}>
            <div className="flex items-start gap-2">
                <button
                    onClick={onToggle}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${isCompleted
                        ? 'bg-gray-200 border-gray-400'
                        : 'border-gray-300 hover:border-gray-400'
                        }`}
                >
                    {isCompleted && <CheckCircle className="w-4 h-4 text-gray-600" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold text-sm truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                            }`}>
                            {event.title}
                        </h3>
                        {!isCompleted && (
                            <span className={`px-2 py-0.5 rounded text-label whitespace-nowrap ${priorityColors[event.priority]
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
