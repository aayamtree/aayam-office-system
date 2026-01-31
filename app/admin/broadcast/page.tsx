'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Bell, Send, AlertCircle, Users, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BroadcastNotification {
    id: string;
    message: string;
    priority: string;
    target_audience: string;
    created_at: string;
    created_by: string;
}

export default function BroadcastPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
    const [targetAudience, setTargetAudience] = useState('all');
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState<BroadcastNotification[]>([]);
    const [loading, setLoading] = useState(true);

    // Check permission
    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'finance') {
            router.push('/admin/dashboard');
        }
    }, [profile, router]);

    // Load notification history
    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const { data } = await supabase
            .from('broadcast_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            setHistory(data);
        }
        setLoading(false);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !profile) return;

        setSending(true);

        const { error } = await supabase.from('broadcast_notifications').insert({
            message: message.trim(),
            priority,
            target_audience: targetAudience,
            created_by: profile.id,
        });

        if (!error) {
            setMessage('');
            setPriority('normal');
            setTargetAudience('all');
            loadHistory();
            alert('Broadcast sent successfully! 📢');
        } else {
            alert('Error sending broadcast: ' + error.message);
        }

        setSending(false);
    };

    if (profile?.role !== 'admin' && profile?.role !== 'finance') {
        return null;
    }

    const audiences = [
        { value: 'all', label: 'All Users' },
        { value: 'admin', label: 'Admins Only' },
        { value: 'finance', label: 'Finance/Accounts' },
        { value: 'designer', label: 'Designers' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'dispatch', label: 'Dispatch' },
        { value: 'cmyk', label: 'CMYK Print' },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-page-title text-gray-900 flex items-center gap-3">
                    <Bell className="text-oms-blue" size={32} />
                    Broadcast Notifications
                </h1>
                <p className="text-gray-600 mt-2">
                    Send instant popup notifications to all users or specific roles
                </p>
            </div>

            {/* Send Form */}
            <div className="bg-white rounded-xl p-6 mb-8">
                <h2 className="text-page-title text-gray-900 mb-4">Send Broadcast</h2>

                <form onSubmit={handleSend} className="space-y-4">
                    {/* Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Message
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-oms-blue focus:border-oms-blue"
                            rows={4}
                            placeholder="Type your announcement here..."
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {message.length}/500 characters
                        </p>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPriority('normal')}
                                className={`
                  px-4 py-3 rounded-xl font-medium transition-all
                  ${priority === 'normal'
                                        ? 'bg-blue-100 border-2 border-blue-500 text-blue-900'
                                        : 'bg-gray-100 border-2 border-gray-300 text-gray-700'
                                    }
                `}
                            >
                                📢 Normal
                            </button>
                            <button
                                type="button"
                                onClick={() => setPriority('urgent')}
                                className={`
                  px-4 py-3 rounded-xl font-medium transition-all
                  ${priority === 'urgent'
                                        ? 'bg-red-100 border-2 border-red-500 text-red-900'
                                        : 'bg-gray-100 border-2 border-gray-300 text-gray-700'
                                    }
                `}
                            >
                                🚨 Urgent
                            </button>
                        </div>
                    </div>

                    {/* Target Audience */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Users size={16} className="inline mr-1" />
                            Target Audience
                        </label>
                        <select
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-oms-blue focus:border-oms-blue"
                        >
                            {audiences.map((aud) => (
                                <option key={aud.value} value={aud.value}>
                                    {aud.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Send Button */}
                    <button
                        type="submit"
                        disabled={sending || !message.trim()}
                        className="w-full px-6 py-3 bg-oms-blue text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        <Send size={20} />
                        {sending ? 'Sending...' : 'Send Broadcast'}
                    </button>
                </form>
            </div>

            {/* Notification History */}
            <div className="bg-white rounded-xl p-6">
                <h2 className="text-page-title text-gray-900 mb-4 flex items-center gap-2">
                    <Clock size={20} />
                    Recent Broadcasts
                </h2>

                {loading ? (
                    <p className="text-gray-500 text-center py-8">Loading...</p>
                ) : history.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                        No broadcasts sent yet
                    </p>
                ) : (
                    <div className="space-y-3">
                        {history.map((notif) => (
                            <div
                                key={notif.id}
                                className={`
                  p-4 rounded-lg border-l-4
                  ${notif.priority === 'urgent'
                                        ? 'border-red-500 bg-red-50'
                                        : 'border-blue-500 bg-blue-50'
                                    }
                `}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {notif.priority === 'urgent' ? (
                                                <AlertCircle size={16} className="text-red-600" />
                                            ) : (
                                                <Bell size={16} className="text-blue-600" />
                                            )}
                                            <span
                                                className={`
                        text-xs font-bold uppercase
                        ${notif.priority === 'urgent'
                                                        ? 'text-red-900'
                                                        : 'text-blue-900'
                                                    }
                      `}
                                            >
                                                {notif.priority}
                                            </span>
                                            <span className="text-xs text-gray-500">•</span>
                                            <span className="text-xs text-gray-600">
                                                {audiences.find((a) => a.value === notif.target_audience)
                                                    ?.label || notif.target_audience}
                                            </span>
                                        </div>
                                        <p className="text-gray-800">{notif.message}</p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {new Date(notif.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
