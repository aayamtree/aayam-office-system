'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Mail, Phone, CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';

export default function ProfileSettingsPage() {
    const { profile, refreshProfile } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        full_name: profile?.full_name || '',
        email: profile?.email || '',
        phone: profile?.phone || '',
        avatar_url: profile?.avatar_url || ''
    });

    const [saving, setSaving] = useState(false);
    const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const telegramLinked = !!(profile as any)?.telegram_chat_id;
    const telegramUsername = (profile as any)?.telegram_username;
    const telegramLink = profile?.id ? `https://t.me/aayam_notify_bot?start=staff_${profile.id}` : null;

    const handleUnlinkTelegram = async () => {
        if (!confirm('Unlink your Telegram account?')) return;
        setUnlinkingTelegram(true);
        const { error } = await supabase
            .from('profiles')
            .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
            .eq('id', profile?.id);
        if (error) {
            toast.error('Failed to unlink: ' + error.message);
        } else {
            await refreshProfile();
            toast.success('Telegram unlinked!');
        }
        setUnlinkingTelegram(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    phone: formData.phone,
                    avatar_url: formData.avatar_url
                })
                .eq('id', profile?.id);

            if (error) throw error;

            // Refresh profile in auth context
            await refreshProfile();

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error: any) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 pb-16 md:pb-20 max-w-2xl">
            {/* Header */}
            <div className="flex items-center gap-2 md:gap-4">
                <Link
                    href="/admin/dashboard"
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-page-title text-gray-900">Profile Settings</h1>
                    <p className="text-gray-500 text-sm">Manage your personal information</p>
                </div>
            </div>

            {/* Messages */}
            {message && (
                <div className={`rounded-md p-3 ${message.type === 'success'
                    ? 'bg-white border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    <p className="font-medium">{message.text}</p>
                </div>
            )}

            {/* Main Form */}
            <div className="bg-white rounded-md border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-section text-gray-900">Personal Information</h2>
                    <p className="text-sm text-gray-500 mt-1">Update your personal details</p>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-6">
                    {/* Avatar Section */}
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-page-title overflow-hidden">
                            {formData.avatar_url ? (
                                <img src={formData.avatar_url} alt="Profile Avatar" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                                profile?.full_name?.charAt(0) || 'A'
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 mb-2">Profile Picture (Google Drive)</p>
                            <input
                                type="url"
                                value={formData.avatar_url}
                                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                                placeholder="Paste Google Drive shareable link..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-1">Upload photo to Google Drive, make it shareable, paste link here</p>
                        </div>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Full Name
                            </div>
                        </label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
                            required
                        />
                    </div>

                    {/* Email (Read-only) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email
                            </div>
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            disabled
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact admin if needed.</p>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                Phone Number
                            </div>
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
                            placeholder="+91 98765 43210"
                        />
                    </div>

                    {/* Telegram */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Telegram Notifications
                        </label>
                        {telegramLinked ? (
                            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-center gap-2 text-green-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-sm font-medium">Linked{telegramUsername ? ` (@${telegramUsername})` : ''}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleUnlinkTelegram}
                                    disabled={unlinkingTelegram}
                                    className="text-xs text-red-600 hover:text-red-700 underline disabled:opacity-50"
                                >
                                    {unlinkingTelegram ? 'Unlinking...' : 'Unlink'}
                                </button>
                            </div>
                        ) : (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-3">
                                <p className="text-sm text-blue-700 font-medium">
                                    📱 Easiest way: scan this QR code with your phone camera — it opens Telegram with your personal link code. Then press <b>Start</b>.
                                </p>
                                {telegramLink && (
                                    <div className="flex items-start gap-4 flex-wrap">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(telegramLink)}`}
                                            alt="Scan with your phone to link Telegram"
                                            width={160}
                                            height={160}
                                            className="rounded-md border border-blue-200 bg-white p-1 flex-shrink-0"
                                        />
                                        <div className="space-y-2 min-w-[200px] flex-1">
                                            <p className="text-xs text-blue-600">
                                                Or, if Telegram is installed on this device, use the button:
                                            </p>
                                            <a
                                                href={telegramLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Link Telegram
                                            </a>
                                            <p className="text-xs text-blue-500">
                                                The button only works where the Telegram app is installed — on office PCs use the QR instead.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-blue-500">After pressing Start in Telegram, come back and refresh this page.</p>
                            </div>
                        )}
                    </div>

                    {/* Role (Read-only) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Role
                        </label>
                        <input
                            type="text"
                            value={profile?.role || ''}
                            disabled
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed capitalize text-sm"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            <Save className="w-4 h-4 md:w-4.5 md:h-4.5" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
