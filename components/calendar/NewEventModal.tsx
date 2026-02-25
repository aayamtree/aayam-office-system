'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import MentionInput from '@/components/calendar/MentionInput';
import { UserCalendarEvent } from '@/types/database';

interface NewEventModalProps {
    profile: any;
    defaultDate?: string;
    onClose: () => void;
    onCreate: (event: Partial<UserCalendarEvent>) => Promise<any>;
}

export default function NewEventModal({ profile, defaultDate, onClose, onCreate }: NewEventModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [date, setDate] = useState(defaultDate || format(new Date(), 'yyyy-MM-dd'));
    const [time, setTime] = useState('');
    const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
    const [allDay, setAllDay] = useState(true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!profile?.id) {
            toast.info('User not authenticated');
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
            toast.error('Failed to create event');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-section text-gray-900">New Event</h2>
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
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            required
                            autoFocus
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
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date *
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
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
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            >
                                <option value="low">Low</option>
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
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
                                className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            />
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md"
                        >
                            Create Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
