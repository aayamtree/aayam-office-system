'use client';

import { useState } from 'react';
import { useReminders } from '@/lib/hooks';
import { Plus, CheckCircle2, Circle, Trash2, Calendar, Loader2 } from 'lucide-react';
import { Reminder } from '@/types/database';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

export default function RemindersWidget() {
    const { reminders, loading, createReminder, updateReminder, deleteReminder } = useReminders();
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState(''); // Empty by default (optional)
    const [saving, setSaving] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        setSaving(true);
        await createReminder({
            title: newTitle,
            due_date: newDate ? new Date(newDate).toISOString() : null, // Send null if empty
            is_completed: false,
            priority: 'normal'
        });
        setNewTitle('');
        setNewDate('');
        setIsAdding(false);
        setSaving(false);
    };

    const toggleComplete = async (reminder: Reminder) => {
        await updateReminder(reminder.id, { is_completed: !reminder.is_completed });
    };

    const getDateLabel = (dateStr?: string | null) => {
        if (!dateStr) return 'No Date';
        const date = new Date(dateStr);
        if (isToday(date)) return 'Today';
        if (isTomorrow(date)) return 'Tomorrow';
        return format(date, 'MMM d');
    };

    const getDateColor = (dateStr?: string | null, completed?: boolean) => {
        if (completed) return 'text-gray-400';
        if (!dateStr) return 'text-gray-400';
        const date = new Date(dateStr);
        if (isPast(date) && !isToday(date)) return 'text-red-500 font-medium';
        if (isToday(date)) return 'text-orange-500 font-medium';
        return 'text-gray-500';
    };

    if (loading) return <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl"><Loader2 className="animate-spin text-gray-400" /></div>;

    const activeReminders = reminders.filter(r => !r.is_completed);
    const completedReminders = reminders.filter(r => r.is_completed);

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Reminders</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className={`p-2 rounded-lg transition-colors ${isAdding ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                    <Plus size={20} className={isAdding ? 'rotate-45 transition-transform' : 'transition-transform'} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {isAdding && (
                    <form onSubmit={handleAdd} className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                        <input
                            autoFocus
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium placeholder-gray-400 mb-2"
                        />
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Due:</span>
                                <input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="bg-transparent border-none text-xs text-gray-500 focus:ring-0 p-0"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-3 py-1 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-50"
                            >
                                {saving ? 'Adding...' : 'Add'}
                            </button>
                        </div>
                    </form>
                )}

                {reminders.length === 0 && !isAdding && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        No reminders
                    </div>
                )}

                <div className="space-y-2">
                    {activeReminders.map(reminder => (
                        <div key={reminder.id} className="group flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                            <button
                                onClick={() => toggleComplete(reminder)}
                                className="text-gray-400 hover:text-indigo-600 transition-colors"
                            >
                                <Circle size={18} />
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">{reminder.title}</p>
                                {reminder.due_date && (
                                    <p className={`text-xs ${getDateColor(reminder.due_date, false)} flex items-center gap-1`}>
                                        <Calendar size={10} />
                                        {getDateLabel(reminder.due_date)}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => deleteReminder(reminder.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-opacity"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}

                    {completedReminders.length > 0 && (
                        <div className="pt-4 border-t border-dashed mt-4">
                            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Completed</p>
                            <div className="space-y-1 opacity-60">
                                {completedReminders.map(reminder => (
                                    <div key={reminder.id} className="group flex items-center gap-3 p-2 rounded-lg">
                                        <button
                                            onClick={() => toggleComplete(reminder)}
                                            className="text-gray-400 hover:text-indigo-600 transition-colors"
                                        >
                                            <CheckCircle2 size={18} className="text-green-500" />
                                        </button>
                                        <span className="text-sm text-gray-500 line-through flex-1 truncate">{reminder.title}</span>
                                        <button
                                            onClick={() => deleteReminder(reminder.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
