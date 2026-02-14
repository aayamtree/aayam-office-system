'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { NoteTag, NoteSource } from '@/types/database';
import {
    MessageSquare, Send, FileText,
    AlertCircle, CheckCircle, Palette, RefreshCw, Loader2, MessageCircle, RotateCcw
} from 'lucide-react';

// Tag configuration
const TAG_CONFIG: Record<NoteTag, { label: string; bg: string; text: string; icon: React.ReactNode; special?: boolean }> = {
    correction: { label: 'Correction', bg: 'bg-red-50', text: 'text-red-600', icon: <AlertCircle size={10} /> },
    update: { label: 'Update', bg: 'bg-blue-50', text: 'text-blue-600', icon: <RefreshCw size={10} /> },
    client_says: { label: 'Client Says', bg: 'bg-amber-50', text: 'text-amber-700', icon: <MessageCircle size={10} /> },
    approved: { label: 'Approved ✅', bg: 'bg-green-50', text: 'text-green-700', icon: <CheckCircle size={10} />, special: true },
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
    onStageChange?: () => void; // callback to refetch parent data after stage change
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

export default function ProjectNotesLog({ jobId, canWrite, onStageChange }: ProjectNotesLogProps) {
    const { profile } = useAuth();
    const [notes, setNotes] = useState<NoteWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [content, setContent] = useState('');
    const [tag, setTag] = useState<NoteTag>('design_note');
    const [source, setSource] = useState<NoteSource>('self');

    // Computed: approval & revision stats
    const { isApproved, revisionCount, approvedDate } = useMemo(() => {
        if (notes.length === 0) return { isApproved: false, revisionCount: 0, approvedDate: '' };

        // Notes are sorted desc (newest first), reverse for chronological processing
        const chronological = [...notes].reverse();

        let approved = false;
        let revisions = 0;
        let lastApprovedDate = '';

        for (const note of chronological) {
            if (note.tag === 'approved') {
                approved = true;
                lastApprovedDate = note.created_at;
            } else if (note.tag === 'correction' && approved) {
                // Correction AFTER approval = revision
                revisions++;
                approved = false; // Reset — needs re-approval
            }
        }

        return { isApproved: approved, revisionCount: revisions, approvedDate: lastApprovedDate };
    }, [notes]);

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

        const channel = supabase
            .channel(`job-notes-${jobId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'job_notes', filter: `job_id=eq.${jobId}` },
                () => { fetchNotes(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [jobId, fetchNotes]);

    // Add note — with special handling for "approved" and "correction" tags
    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !profile?.id || !jobId) return;

        // Require content for approved/correction
        if (tag === 'approved' && !content.trim()) {
            alert('Please type what the client said (required for accountability)');
            return;
        }

        setSaving(true);
        try {
            // 1. Insert the note
            const { error } = await supabase.from('job_notes').insert([{
                job_id: jobId,
                user_id: profile.id,
                content: content.trim(),
                tag,
                source,
            }]);
            if (error) throw error;

            // 2. Special actions based on tag
            if (tag === 'approved') {
                // Move job to printing stage + set approval fields
                const userName = profile.full_name || profile.email || 'Unknown';
                const noteText = `✅ Client Approved — recorded by ${userName}. Client said: "${content.trim()}"`;

                await supabase.from('jobs').update({
                    approval_status: 'approved',
                    client_approval: true,
                    approval_date: new Date().toISOString(),
                    approval_by: profile.id,
                    approval_remark: content.trim(),
                    current_stage: 'printing',
                }).eq('id', jobId);

                // Log stage history
                await supabase.from('job_stage_history').insert([{
                    job_id: jobId,
                    from_stage: 'approval',
                    to_stage: 'printing',
                    notes: noteText,
                }]);

                if (onStageChange) onStageChange();

            } else if (tag === 'correction' && isApproved) {
                // Correction after approval = revision, move back to designing
                const userName = profile.full_name || profile.email || 'Unknown';
                const noteText = `🔄 Revision ${revisionCount + 1} — recorded by ${userName}. Change: "${content.trim()}"`;

                await supabase.from('jobs').update({
                    approval_status: 'changes_requested',
                    client_approval: false,
                    current_stage: 'designing',
                }).eq('id', jobId);

                await supabase.from('job_stage_history').insert([{
                    job_id: jobId,
                    from_stage: 'printing',
                    to_stage: 'designing',
                    notes: noteText,
                }]);

                if (onStageChange) onStageChange();
            }

            setContent('');
            setTag('design_note');
            setSource('self');
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
            {/* Header with status badges */}
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} className="text-orange-500" /> Project Notes & Feedback
                </h4>
                <div className="flex items-center gap-2">
                    {/* Revision count badge */}
                    {revisionCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                            <RotateCcw size={10} /> {revisionCount} {revisionCount === 1 ? 'Revision' : 'Revisions'}
                        </span>
                    )}
                    {/* Approval badge */}
                    {isApproved && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle size={10} /> Approved
                        </span>
                    )}
                    {/* Note count */}
                    {notes.length > 0 && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            {notes.length}
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden h-[380px]">
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
                            const isApprovalNote = note.tag === 'approved';
                            const isCorrectionNote = note.tag === 'correction';

                            return (
                                <div
                                    key={note.id}
                                    className={`rounded-lg border p-3 transition-all ${isApprovalNote
                                            ? 'bg-green-50/50 border-green-200 border-l-[3px] border-l-green-500'
                                            : isCorrectionNote
                                                ? 'bg-red-50/30 border-red-200 border-l-[3px] border-l-red-400'
                                                : isAdminNote
                                                    ? 'bg-white border-orange-200 border-l-[3px] border-l-orange-400'
                                                    : 'bg-white border-gray-100'
                                        }`}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-gray-800">
                                                {isOwnNote ? 'You' : note.user_name}
                                            </span>
                                            {getRoleBadge(note.user_role)}
                                            <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${tagConf.bg} ${tagConf.text}`}>
                                                {tagConf.icon} {tagConf.label}
                                            </span>
                                            <span className="text-[9px] text-gray-400 font-medium">
                                                {sourceConf.icon} {sourceConf.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-gray-400">{formatTime(note.created_at)}</span>
                                            {isOwnNote && (
                                                <button onClick={() => handleDelete(note.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete">×</button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Add Note Form */}
                {canWrite ? (
                    <form onSubmit={handleAddNote} className="p-3 border-t bg-white space-y-2">
                        {/* Warning if selecting "Approved" */}
                        {tag === 'approved' && (
                            <div className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5 flex items-center gap-1.5">
                                <CheckCircle size={12} /> This will mark the project as APPROVED and move it to print queue
                            </div>
                        )}
                        {tag === 'correction' && isApproved && (
                            <div className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 flex items-center gap-1.5">
                                <RotateCcw size={12} /> This will count as Revision {revisionCount + 1} and move project back to Designing
                            </div>
                        )}

                        {/* Tag & Source selectors */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {(Object.entries(TAG_CONFIG) as [NoteTag, typeof TAG_CONFIG[NoteTag]][]).map(([key, conf]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTag(key)}
                                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${tag === key
                                            ? `${conf.bg} ${conf.text} border-current ring-1 ring-current/20`
                                            : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    {conf.icon} {conf.label}
                                </button>
                            ))}
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
                                placeholder={tag === 'approved' ? 'What did the client say? (required)...' : tag === 'correction' ? 'Describe the correction needed...' : 'Add a note...'}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!content.trim() || saving}
                                className={`p-2 rounded-md transition-colors disabled:opacity-40 ${tag === 'approved' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-900 text-white hover:bg-gray-800'
                                    }`}
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
