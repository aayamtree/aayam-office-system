'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Mail, Phone, Upload } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/dashboard"
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-page-title text-gray-900">Profile Settings</h1>
                    <p className="text-gray-500 text-sm">Manage your personal information</p>
                </div>
            </div>

            {/* Messages */}
            {message && (
                <div className={`rounded-xl p-4 ${message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    <p className="font-medium">{message.text}</p>
                </div>
            )}

            {/* Main Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
                    <p className="text-sm text-gray-500 mt-1">Update your personal details</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Avatar Section */}
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-oms-blue rounded-full flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
                            {formData.avatar_url ? (
                                <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-1">Upload photo to Google Drive, make it shareable, paste link here</p>
                        </div>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <div className="flex items-center gap-2">
                                <User size={16} />
                                Full Name
                            </div>
                        </label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                            required
                        />
                    </div>

                    {/* Email (Read-only) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <div className="flex items-center gap-2">
                                <Mail size={16} />
                                Email
                            </div>
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            disabled
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact admin if needed.</p>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <div className="flex items-center gap-2">
                                <Phone size={16} />
                                Phone Number
                            </div>
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                            placeholder="+91 98765 43210"
                        />
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
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed capitalize"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-oms-blue text-white font-semibold rounded-xl hover:bg-oms-blue transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
