'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
    Megaphone, Send, AlertCircle, Users, Clock, Loader2,
    Bell, ChevronDown, ChevronRight, Zap, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BroadcastNotification {
    id: string;
    message: string;
    priority: string;
    target_audience: string;
    created_at: string;
    created_by: string;
}

const audiences = [
    { value: 'all', label: 'All Members', icon: '👥' },
    { value: 'admin', label: 'Admin', icon: '🛡️' },
    { value: 'finance', label: 'Finance / Accounts', icon: '💰' },
    { value: 'designer', label: 'Designers', icon: '🎨' },
    { value: 'marketing', label: 'Marketing', icon: '📣' },
    { value: 'dispatch', label: 'Dispatch', icon: '🚚' },
    { value: 'cmyk', label: 'CMYK Print', icon: '🖨️' },
];

export default function NotificationsPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
    const [targetAudience, setTargetAudience] = useState('all');
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState<BroadcastNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    // Check permission
    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'finance') {
            router.push('/admin/dashboard');
        }
    }, [profile, router]);

    // Load history
    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const { data } = await supabase
            .from('broadcast_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);

        if (data) setHistory(data);
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
            const audienceLabel = audiences.find(a => a.value === targetAudience)?.label || targetAudience;
            setSuccessMessage(`Message sent to ${audienceLabel}! It will popup on their screens instantly.`);
            setTimeout(() => setSuccessMessage(''), 4000);
        } else {
            alert('Error sending: ' + error.message);
        }

        setSending(false);
    };

    if (profile?.role !== 'admin' && profile?.role !== 'finance') {
        return null;
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-xl lg:text-page-title text-gray-900 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 lg:w-6 lg:h-6" />
                    Instant Broadcast
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Send instant popup messages to all members or specific departments
                </p>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                        <Zap className="w-4 h-4 text-green-600" />
                        {successMessage}
                    </div>
                    <button onClick={() => setSuccessMessage('')}>
                        <X className="w-4 h-4 text-green-600" />
                    </button>
                </div>
            )}

            {/* Main Layout: Send Form (left) + History (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* LEFT: Send Form — 3 columns */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-md border border-gray-200 p-4">
                        <h2 className="text-section text-gray-900 mb-3 flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            New Broadcast
                        </h2>

                        <form onSubmit={handleSend} className="space-y-4">
                            {/* Message */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                                    rows={4}
                                    placeholder="Type your message here... This will popup on members' screens instantly."
                                    maxLength={500}
                                    required
                                />
                                <p className="text-xs text-gray-400 mt-1 text-right">
                                    {message.length}/500
                                </p>
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">Priority</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPriority('normal')}
                                        className={`px-3 py-2.5 rounded-md font-medium text-sm transition-all border ${priority === 'normal'
                                                ? 'bg-gray-900 border-gray-900 text-white'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        📢 Normal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPriority('urgent')}
                                        className={`px-3 py-2.5 rounded-md font-medium text-sm transition-all border ${priority === 'urgent'
                                                ? 'bg-red-600 border-red-600 text-white'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        🚨 Urgent
                                    </button>
                                </div>
                            </div>

                            {/* Target Audience */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                    <Users className="w-3 h-3 inline mr-1" />
                                    Send To
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {audiences.map((aud) => (
                                        <button
                                            key={aud.value}
                                            type="button"
                                            onClick={() => setTargetAudience(aud.value)}
                                            className={`px-3 py-2 rounded-md text-sm transition-all border text-left ${targetAudience === aud.value
                                                    ? 'bg-gray-900 border-gray-900 text-white'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="mr-1">{aud.icon}</span> {aud.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            {message.trim() && (
                                <div className="border border-dashed border-gray-300 rounded-md p-3">
                                    <p className="text-xs uppercase font-medium text-gray-400 mb-2">Preview</p>
                                    <div className={`rounded-md p-3 ${priority === 'urgent' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {priority === 'urgent'
                                                ? <AlertCircle className="w-4 h-4 text-red-600" />
                                                : <Bell className="w-4 h-4 text-gray-600" />
                                            }
                                            <span className={`text-xs font-bold ${priority === 'urgent' ? 'text-red-800' : 'text-gray-800'}`}>
                                                {priority === 'urgent' ? '🚨 Urgent Announcement' : '📢 Announcement'}
                                            </span>
                                        </div>
                                        <p className={`text-sm ${priority === 'urgent' ? 'text-red-700' : 'text-gray-700'}`}>
                                            {message}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            → {audiences.find(a => a.value === targetAudience)?.label}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Send Button */}
                            <button
                                type="submit"
                                disabled={sending || !message.trim()}
                                className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-md font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Megaphone className="w-4 h-4" />
                                        Send Broadcast
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* RIGHT: Broadcast History — 2 columns */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-md border border-gray-200 sticky top-4">
                        <div className="flex items-center justify-between p-3 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-semibold text-gray-900">Recent Broadcasts</span>
                            </div>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                                {history.length} sent
                            </span>
                        </div>

                        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    <Megaphone className="w-5 h-5 mx-auto mb-2" />
                                    <p>No broadcasts sent yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {history.map((notif) => {
                                        const audienceInfo = audiences.find(a => a.value === notif.target_audience);
                                        return (
                                            <div key={notif.id}>
                                                <button
                                                    onClick={() => setExpandedId(expandedId === notif.id ? null : notif.id)}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${notif.priority === 'urgent' ? 'bg-red-500' : 'bg-gray-400'
                                                            }`} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm text-gray-900 truncate">
                                                                {notif.message.length > 50
                                                                    ? notif.message.substring(0, 50) + '...'
                                                                    : notif.message}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs text-gray-500">
                                                                    {audienceInfo?.icon} {audienceInfo?.label || notif.target_audience}
                                                                </span>
                                                                <span className="text-xs text-gray-400">•</span>
                                                                <span className="text-xs text-gray-400">
                                                                    {new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        {notif.priority === 'urgent' && (
                                                            <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                                                URGENT
                                                            </span>
                                                        )}
                                                        {expandedId === notif.id
                                                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                                        }
                                                    </div>
                                                </button>

                                                {expandedId === notif.id && (
                                                    <div className="px-3 pb-3">
                                                        <div className={`rounded-md p-3 ${notif.priority === 'urgent' ? 'bg-red-50' : 'bg-gray-50'
                                                            }`}>
                                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{notif.message}</p>
                                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                                <span>📅 {new Date(notif.created_at).toLocaleString()}</span>
                                                                <span>→ {audienceInfo?.label}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
