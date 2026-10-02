'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { CLOSED_STATUS_FILTER } from '@/lib/lead-status';

type ActiveForm = null | 'lead' | 'followup' | 'eod';

interface Props {
    onClose: () => void;
}

// ── Relative date helper ──────────────────────────────────────
function relativeDate(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── New Lead Form ─────────────────────────────────────────────
function AddLeadForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
    const { profile, user } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [company, setCompany] = useState('');
    const [source, setSource] = useState<string>('walk_in');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone) { toast.error('Name and phone are required'); return; }
        setSubmitting(true);

        try {
            const userId = profile?.id || user?.id;
            if (!userId) throw new Error('Not authenticated');

            const { error } = await supabase.from('leads').insert({
                name,
                phone: phone.replace(/\D/g, ''),
                company: company || undefined,
                source,
                status: 'fresh_lead',
                created_by: userId,
                assigned_to: userId,
            });

            if (error) throw error;
            toast.success(`Lead "${name}" added!`);
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Failed to add lead');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="font-semibold text-gray-900">New Lead</h3>
            </div>

            <input
                required
                placeholder="Name *"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B] transition-colors"
            />
            <input
                required
                placeholder="Phone *"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B] transition-colors font-mono"
            />
            <input
                placeholder="Company (optional)"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B] transition-colors"
            />
            <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B] transition-colors bg-white"
            >
                <option value="walk_in">Walk-in</option>
                <option value="referral">Referral</option>
                <option value="website">Website</option>
                <option value="social_media">Social Media</option>
                <option value="cold_call">Cold Call</option>
                <option value="other">Other</option>
            </select>

            <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#B8860B] text-white rounded-lg py-3 font-semibold mt-1 flex items-center justify-center gap-2 disabled:opacity-60"
            >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Adding...' : 'Add Lead'}
            </button>
        </form>
    );
}

// ── Follow-up Note Form ───────────────────────────────────────
function AddFollowUpForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
    const { profile, user } = useAuth();
    const [leadsData, setLeadsData] = useState<{ id: string; name: string; company?: string }[]>([]);
    const [leadsLoading, setLeadsLoading] = useState(true);
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [note, setNote] = useState('');
    const [followUpDate, setFollowUpDate] = useState(() => {
        const d = new Date();
        // Default to tomorrow
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });
    const [submitting, setSubmitting] = useState(false);

    // Load active leads on mount
    useEffect(() => {
        const userId = profile?.id || user?.id;
        if (!userId) return;
        supabase
            .from('leads')
            .select('id, name, company')
            .eq('assigned_to', userId) // Filter by assigned_to
            .not('status', 'in', CLOSED_STATUS_FILTER)
            .order('created_at', { ascending: false })
            .limit(100)
            .then(({ data }) => {
                setLeadsData(data || []);
                setLeadsLoading(false);
            });
    }, [profile?.id, user?.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLeadId) { toast.error('Please select a lead'); return; }
        if (!note.trim()) { toast.error('Please enter a note'); return; }
        setSubmitting(true);

        try {
            const userId = profile?.id || user?.id;
            if (!userId) throw new Error('Not authenticated');

            const { error } = await supabase.from('follow_ups').insert({
                lead_id: selectedLeadId,
                follow_up_date: followUpDate ? new Date(followUpDate).toISOString() : new Date().toISOString(),
                notes: `[Quick Note] ${note.trim()}`,
                done_by: userId,
                status: 'pending',
            });

            if (error) throw error;
            toast.success('Follow-up note saved!');
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save note');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="font-semibold text-gray-900">Follow-up Note</h3>
            </div>

            {/* Lead Picker */}
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Lead *</label>
                {leadsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading leads...
                    </div>
                ) : (
                    <select
                        required
                        value={selectedLeadId}
                        onChange={e => setSelectedLeadId(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B] transition-colors bg-white"
                    >
                        <option value="">Select lead...</option>
                        {leadsData.map(lead => (
                            <option key={lead.id} value={lead.id}>
                                {lead.name}{lead.company ? ` (${lead.company})` : ''}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Date */}
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Date</label>
                <input
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B] transition-colors"
                />
            </div>

            {/* Note */}
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Note *</label>
                <textarea
                    required
                    rows={3}
                    placeholder="What happened? What's the plan?"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B] transition-colors resize-none"
                />
            </div>

            <button
                type="submit"
                disabled={submitting || leadsLoading}
                className="w-full bg-[#B8860B] text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Saving...' : 'Save Note'}
            </button>
        </form>
    );
}


// ── EOD Redirect ──────────────────────────────────────────────
function EODRedirect({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
    const router = useRouter();
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="font-semibold text-gray-900">Submit EOD</h3>
            </div>
            <p className="text-sm text-gray-500">Ready to wrap up for the day? Submit your end-of-day report.</p>
            <button
                onClick={() => { router.push('/admin/eod-report'); onClose(); }}
                className="w-full bg-[#B8860B] text-white rounded-lg py-3 font-semibold mt-2"
            >
                ✅ Go to EOD Report
            </button>
        </div>
    );
}

// ── Main Sheet ────────────────────────────────────────────────
export default function QuickAddSheet({ onClose }: Props) {
    const [activeForm, setActiveForm] = useState<ActiveForm>(null);

    const menuItems = [
        { icon: '👤', label: 'New Lead', form: 'lead' as const },
        { icon: '📋', label: 'Follow-up Note', form: 'followup' as const },
        { icon: '✅', label: 'Submit EOD', form: 'eod' as const },
    ];

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-5 pb-10 animate-slide-up">
                {/* Drag handle */}
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

                {/* Menu */}
                {!activeForm && (
                    <>
                        <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Add</h2>
                        <div className="grid grid-cols-3 gap-3">
                            {menuItems.map(item => (
                                <button
                                    key={item.form}
                                    onClick={() => setActiveForm(item.form)}
                                    className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl min-h-[80px] hover:bg-gray-100 active:scale-95 transition-all"
                                >
                                    <span className="text-2xl">{item.icon}</span>
                                    <span className="text-xs font-medium text-gray-700 text-center leading-tight">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Sub-forms */}
                {activeForm === 'lead' && (
                    <AddLeadForm onBack={() => setActiveForm(null)} onClose={onClose} />
                )}
                {activeForm === 'followup' && (
                    <AddFollowUpForm onBack={() => setActiveForm(null)} onClose={onClose} />
                )}
                {activeForm === 'eod' && (
                    <EODRedirect onBack={() => setActiveForm(null)} onClose={onClose} />
                )}
            </div>

            <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
        </>
    );
}
