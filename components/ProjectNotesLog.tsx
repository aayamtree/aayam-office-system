'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { NoteTag, NoteSource } from '@/types/database';
import {
    MessageSquare, Send, Phone, MessageCircle, Users, FileText,
    AlertCircle, CheckCircle, Palette, RefreshCw, Loader2
} from 'lucide-react';

// Tag configuration
const TAG_CONFIG: Record<NoteTag, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    correction: { label: 'Correction', bg: 'bg-red-50', text: 'text-red-600', icon: <AlertCircle size={10} /> },
    update: { label: 'Update', bg: 'bg-blue-50', text: 'text-blue-600', icon: <RefreshCw size={10} /> },
    client_says: { label: 'Client Says', bg: 'bg-amber-50', text: 'text-amber-700', icon: <MessageCircle size={10} /> },
    approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', icon: <CheckCircle size={10} /> },
    design_note: { label: 'Design Note', bg: 'bg-purple-50', text: 'text-purple-700', icon: <Palette size={10} /> },
};

// Source configuration
const SOURCE_CONFIG: Record<NoteSource, { label: string; icon: string }> = {
    call: { label: 'Call', icon: '📞' },
    whatsapp: { label: 'WhatsApp', icon: '💬' },
    in_person: { label: 'In-Person', icon: '🤝' },
    self: { label: 'Self', icon: '📝' },
};

interface ProjectNotesLogProps {
    jobId: string;
    canWrite: boolean;
}

interface NoteWithUser {
    id: string;
    job_id: string;
    user_id: string;
    content: string;
    tag: NoteTag;
    source: NoteSource;
    created_at: string;
    user_name?: string;
    user_role?: string;
}

export default function ProjectNotesLog({ jobId, canWrite }: ProjectNotesLogProps) {
    const { profile } = useAuth();
    const [notes, setNotes] = useState<NoteWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [content, setContent] = useState('');
    const [tag, setTag] = useState<NoteTag>('design_note');
    const [source, setSource] = useState<NoteSource>('self');

    // Fetch notes with user profile data
    const fetchNotes = useCallback(async () => {
        if (!jobId) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('job_notes')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    console.warn('job_notes table not found — run CREATE_JOB_NOTES.sql');
                    return;
                }
                throw error;
            }

            if (data && data.length > 0) {
                // Fetch user names for note authors
                const userIds = Array.from(new Set(data.map((n: any) => n.user_id)));
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, role')
                    .in('id', userIds);

                const profileMap = new Map(
                    (profiles || []).map((p: any) => [p.id, { name: p.full_name, role: p.role }])
                );

                setNotes(
                    data.map((n: any) => ({
                        ...n,
                        user_name: profileMap.get(n.user_id)?.name || 'Unknown',
                        user_role: profileMap.get(n.user_id)?.role || '',
                    }))
                );
            } else {
                setNotes([]);
            }
        } catch (e) {
            console.error('Error fetching job notes:', e);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    // Initial fetch + Realtime subscription
    useEffect(() => {
        if (!jobId) return;
        fetchNotes();

        // Subscribe to realtime changes on this job's notes
        const channel = supabase
            .channel(`job-notes-${jobId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'job_notes', filter: `job_id=eq.${jobId}` },
                () => {
                    fetchNotes();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [jobId, fetchNotes]);

    // Add note
    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !profile?.id || !jobId) return;

        setSaving(true);
        try {
            const { error } = await supabase.from('job_notes').insert([{
                job_id: jobId,
                user_id: profile.id,
                content: content.trim(),
                tag,
                source,
            }]);

            if (error) throw error;

            setContent('');
            setTag('design_note');
            setSource('self');
            // Realtime will auto-refetch, but also fetch immediately for responsiveness
            await fetchNotes();
        } catch (e: any) {
            alert('Error adding note: ' + (e.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    // Delete note
    const handleDelete = async (noteId: string) => {
        if (!confirm('Delete this note?')) return;
        try {
            await supabase.from('job_notes').delete().eq('id', noteId);
            await fetchNotes();
        } catch (e: any) {
            alert('Error deleting: ' + e.message);
        }
    };

    // Role badge
    const getRoleBadge = (role?: string) => {
        if (role === 'admin') return <span className="text-[9px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded">Admin</span>;
        if (role === 'manager') return <span className="text-[9px] font-bold bg-gray-700 text-white px-1.5 py-0.5 rounded">Manager</span>;
        return null;
    };

    // Time formatting
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    return (
        <section className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} className="text-orange-500" /> Project Notes & Feedback
                </h4>
                {notes.length > 0 && (
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                    </span>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden h-[320px]">
                {/* Notes Timeline */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-gray-400" size={20} />
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <MessageSquare size={24} className="mb-2 opacity-50" />
                            <p className="text-xs">No notes yet.</p>
                            {canWrite && <p className="text-[10px] mt-1">Add the first note below.</p>}
                        </div>
                    ) : (
                        notes.map((note) => {
                            const tagConf = TAG_CONFIG[note.tag];
                            const sourceConf = SOURCE_CONFIG[note.source];
                            const isOwnNote = note.user_id === profile?.id;
                            const isAdminNote = note.user_role === 'admin' || note.user_role === 'manager';

                            return (
                                <div
                                    key={note.id}
                                    className={`rounded-lg border p-3 transition-all ${isAdminNote
                                        ? 'bg-white border-orange-200 border-l-[3px] border-l-orange-400'
                                        : 'bg-white border-gray-100'
                                        }`}
                                >
                                    {/* Header row */}
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Author */}
                                            <span className="text-xs font-bold text-gray-800">
                                                {isOwnNote ? 'You' : note.user_name}
                                            </span>
                                            {getRoleBadge(note.user_role)}

                                            {/* Tag badge */}
                                            <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${tagConf.bg} ${tagConf.text}`}>
                                                {tagConf.icon} {tagConf.label}
                                            </span>

                                            {/* Source */}
                                            <span className="text-[9px] text-gray-400 font-medium">
                                                {sourceConf.icon} {sourceConf.label}
                                            </span>
                                        </div>

                                        {/* Timestamp + delete */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-gray-400">{formatTime(note.created_at)}</span>
                                            {isOwnNote && (
                                                <button
                                                    onClick={() => handleDelete(note.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                                    title="Delete"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Add Note Form — Only if canWrite */}
                {canWrite ? (
                    <form onSubmit={handleAddNote} className="p-3 border-t bg-white space-y-2">
                        {/* Tag & Source selectors */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Tag chips */}
                            {(Object.entries(TAG_CONFIG) as [NoteTag, typeof TAG_CONFIG[NoteTag]][]).map(([key, conf]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTag(key)}
                                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${tag === key
                                        ? `${conf.bg} ${conf.text} border-current`
                                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    {conf.icon} {conf.label}
                                </button>
                            ))}

                            {/* Source dropdown */}
                            <select
                                value={source}
                                onChange={(e) => setSource(e.target.value as NoteSource)}
                                className="ml-auto text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none"
                            >
                                {(Object.entries(SOURCE_CONFIG) as [NoteSource, typeof SOURCE_CONFIG[NoteSource]][]).map(([key, conf]) => (
                                    <option key={key} value={key}>{conf.icon} {conf.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Input + Submit */}
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Add a note..."
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!content.trim() || saving}
                                className="p-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-40"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="p-3 border-t bg-gray-50 text-center">
                        <p className="text-[10px] text-gray-400">Read-only — only assigned designer or admin can add notes</p>
                    </div>
                )}
            </div>
        </section>
    );
}
