'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { NoteTag, NoteSource } from '@/types/database';
import { useConfirm } from '@/components/ConfirmModal';
import {
    MessageSquare, Send, FileText, Lock,
    AlertCircle, CheckCircle, Palette, RefreshCw, Loader2, MessageCircle, RotateCcw, Cloud, AtSign
} from 'lucide-react';
import {
    enqueueNote, dequeueNote, markFailed, getPendingNotes,
    SYNC_INTERVAL_MS
} from '@/lib/note-queue';

interface TeamMember { id: string; full_name: string; role?: string; }

// Highlight @mentions in blue inside note text
function renderWithMentions(text: string) {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
        /^@\w+$/.test(part)
            ? <span key={i} className="text-blue-600 font-semibold bg-blue-50 px-0.5 rounded">{part}</span>
            : <span key={i}>{part}</span>
    );
}

// Stages that are "locked" — past the design phase
const LOCKED_STAGES = ['printing', 'finishing', 'quality_check', 'ready', 'delivered'];

// Tag configuration
const TAG_CONFIG: Record<NoteTag, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    correction: { label: 'Correction', bg: 'bg-red-50', text: 'text-red-600', icon: <AlertCircle size={10} /> },
    update: { label: 'Update', bg: 'bg-blue-50', text: 'text-blue-600', icon: <RefreshCw size={10} /> },
    client_says: { label: 'Client Says', bg: 'bg-amber-50', text: 'text-amber-700', icon: <MessageCircle size={10} /> },
    approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-600', icon: <CheckCircle size={10} /> },
    approved_closed: { label: 'Approved & Closed', bg: 'bg-green-100', text: 'text-green-800', icon: <Lock size={10} /> },
    design_note: { label: 'Design Note', bg: 'bg-purple-50', text: 'text-purple-700', icon: <Palette size={10} /> },
};

interface ProjectNotesLogProps {
    jobId: string;
    canWrite: boolean;
    isAdmin: boolean;
    currentStage: string;
    onStageChange?: () => void;
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

export default function ProjectNotesLog({ jobId, canWrite, isAdmin, currentStage, onStageChange }: ProjectNotesLogProps) {
    const { profile } = useAuth();
    const confirmDialog = useConfirm();
    const [notes, setNotes] = useState<NoteWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // Track local-only notes that are queued but not yet confirmed by DB
    const [pendingLocalIds, setPendingLocalIds] = useState<Set<string>>(new Set());
    const syncingRef = useRef(false);

    const [content, setContent] = useState('');
    const [tag, setTag] = useState<NoteTag>('design_note');
    const [source, setSource] = useState<NoteSource>('self');
    // @mention state
    const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [showMentionDrop, setShowMentionDrop] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionCursorAt, setMentionCursorAt] = useState(-1); // position of '@' in content
    const inputRef = useRef<HTMLInputElement>(null);


    // Is this job locked? (past design phase)
    const isLocked = LOCKED_STAGES.includes(currentStage);

    // Who can write in locked mode? Only admin (to add correction/pull back)
    const canWriteNow = isLocked ? (canWrite && isAdmin) : canWrite;

    // Computed: approval & revision stats
    const { isApproved, isClosed, revisionCount } = useMemo(() => {
        if (notes.length === 0) return { isApproved: false, isClosed: false, revisionCount: 0 };
        const chronological = [...notes].reverse();
        let approved = false;
        let closed = false;
        let revisions = 0;
        for (const note of chronological) {
            if (note.tag === 'approved') {
                approved = true;
            } else if (note.tag === 'approved_closed') {
                approved = true;
                closed = true;
            } else if (note.tag === 'correction' && (approved || closed)) {
                revisions++;
                closed = false;
            }
        }
        return { isApproved: approved, isClosed: closed, revisionCount: revisions };
    }, [notes]);

    // Load team members for @mention dropdown once
    useEffect(() => {
        supabase.from('profiles').select('id, full_name, role')
            .not('full_name', 'is', null).order('full_name')
            .then(({ data }) => { if (data) setTeamMembers(data as TeamMember[]); });
    }, []);

    // Handle input change — detect @typing for mention dropdown
    const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart ?? val.length;
        const before = val.slice(0, cursor);
        const atIdx = before.lastIndexOf('@');
        if (atIdx !== -1 && !before.slice(atIdx).includes(' ')) {
            const q = before.slice(atIdx + 1);
            setMentionQuery(q);
            setMentionCursorAt(atIdx);
            setShowMentionDrop(true);
        } else {
            setShowMentionDrop(false);
        }
        // Extract all @mentions and update mentionedUserIds
        const mentioned = (val.match(/@(\S+)/g) || []).map(m => m.slice(1).toLowerCase());
        const ids = teamMembers.filter(t => mentioned.some(m => t.full_name.replace(/\s/g, '').toLowerCase().startsWith(m))).map(t => t.id);
        setMentionedUserIds(ids);
        setContent(val);
    };

    // Insert selected member into text at the @cursor
    const insertMention = (member: TeamMember) => {
        const slug = member.full_name.replace(/\s+/g, '');
        const before = content.slice(0, mentionCursorAt);
        const after = content.slice(mentionCursorAt + 1 + mentionQuery.length);
        const newVal = `${before}@${slug} ${after}`;
        setContent(newVal);
        setShowMentionDrop(false);
        setMentionedUserIds(prev => Array.from(new Set([...prev, member.id])));
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // Fire @mention notifications (after note saves successfully)
    const sendMentionNotifications = useCallback(async (
        ids: string[], noteContent: string, jobRef: string
    ) => {
        if (ids.length === 0) return;
        const senderName = profile?.full_name || profile?.email || 'Someone';
        const preview = noteContent.length > 80 ? noteContent.slice(0, 80) + '…' : noteContent;
        const inserts = ids.map(uid => ({
            message: `💬 ${senderName} mentioned you in ${jobRef}: "${preview}"`,
            target_user_id: uid,
            target_audience: 'direct',
            created_by: profile?.id,
            priority: 'normal',
        }));
        // Fire and forget — no error shown, not critical path
        await supabase.from('broadcast_notifications').insert(inserts).then();
    }, [profile]);


    // Fetch notes
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
                if (error.code === '42P01') { console.warn('job_notes table not found'); return; }
                throw error;
            }

            if (data && data.length > 0) {
                const userIds = Array.from(new Set(data.map((n: any) => n.user_id)));
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').in('id', userIds);
                const profileMap = new Map((profiles || []).map((p: any) => [p.id, { name: p.full_name, role: p.role }]));
                setNotes(data.map((n: any) => ({
                    ...n,
                    user_name: profileMap.get(n.user_id)?.name || 'Unknown',
                    user_role: profileMap.get(n.user_id)?.role || '',
                })));
            } else {
                setNotes([]);
            }
        } catch (e) {
            console.error('Error fetching job notes:', e);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        if (!jobId) return;
        // Reset form state when switching projects
        setContent('');
        setTag('design_note');
        setSource('self');
        fetchNotes();
        const channel = supabase
            .channel(`job-notes-${jobId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'job_notes', filter: `job_id=eq.${jobId}` }, () => { fetchNotes(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [jobId, fetchNotes]);

    // ─── Background queue flush ──────────────────────────────────────────────
    const flushQueue = useCallback(async () => {
        if (syncingRef.current) return;
        const pending = getPendingNotes().filter(n => n.jobId === jobId);
        if (pending.length === 0) return;

        syncingRef.current = true;
        const synced: string[] = [];

        for (const qn of pending) {
            try {
                const { error } = await supabase.from('job_notes').insert([{
                    job_id: qn.jobId,
                    user_id: qn.userId,
                    content: qn.content,
                    tag: qn.tag,
                    source: qn.source,
                }]);
                if (error) throw error;

                // Side-effects for special tags
                if (qn.tag === 'approved') {
                    await Promise.allSettled([
                        Promise.resolve(supabase.from('jobs').update({
                            approval_status: 'approved', client_approval: true,
                            approval_date: qn.createdAt, approval_by: qn.userId,
                            approval_remark: qn.content,
                        }).eq('id', qn.jobId))
                    ]);
                } else if (qn.tag === 'approved_closed') {
                    await Promise.allSettled([
                        Promise.resolve(supabase.from('jobs').update({
                            approval_status: 'approved', client_approval: true,
                            approval_date: qn.createdAt, approval_by: qn.userId,
                            approval_remark: qn.content, current_stage: 'printing',
                        }).eq('id', qn.jobId)),
                        Promise.resolve(supabase.from('job_stage_history').insert([{
                            job_id: qn.jobId, from_stage: currentStage, to_stage: 'printing',
                            notes: `🔒 Approved & Closed — "${qn.content}"`,
                        }]))
                    ]);
                } else if (qn.tag === 'correction' && isAdmin) {
                    await Promise.allSettled([
                        Promise.resolve(supabase.from('jobs').update({
                            approval_status: 'changes_requested', client_approval: false,
                            current_stage: 'designing',
                        }).eq('id', qn.jobId)),
                        Promise.resolve(supabase.from('job_stage_history').insert([{
                            job_id: qn.jobId, from_stage: currentStage, to_stage: 'designing',
                            notes: `🔄 Admin pullback — "${qn.content}"`,
                        }]))
                    ]);
                    if (onStageChange) onStageChange();
                }

                dequeueNote(qn.localId);
                synced.push(qn.localId);
            } catch (e: any) {
                markFailed(qn.localId, e.message || 'Unknown');
            }
        }

        if (synced.length > 0) {
            setPendingLocalIds(prev => {
                const next = new Set(prev);
                synced.forEach(id => next.delete(id));
                return next;
            });
            fetchNotes(); // Refresh from DB to get real IDs
        }
        syncingRef.current = false;
    }, [jobId, currentStage, isAdmin, onStageChange, fetchNotes]);

    // ─── 30-second sync interval ─────────────────────────────────────────────
    useEffect(() => {
        // Flush immediately on mount (in case there are unsent notes from prev session)
        flushQueue();
        const interval = setInterval(flushQueue, SYNC_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [flushQueue]);

    // Restore any pending local notes for this job from queue into UI
    useEffect(() => {
        const pending = getPendingNotes().filter(n => n.jobId === jobId);
        if (pending.length === 0) return;
        const ids = new Set(pending.map(n => n.localId));
        setPendingLocalIds(ids);
        // Prepend to local display
        const localNotes: NoteWithUser[] = pending.map(qn => ({
            id: qn.localId,
            job_id: qn.jobId,
            user_id: qn.userId,
            content: qn.content,
            tag: qn.tag as NoteTag,
            source: qn.source as NoteSource,
            created_at: qn.createdAt,
            user_name: 'You',
            user_role: profile?.role || '',
        }));
        setNotes(prev => {
            // Only add local notes not already in list
            const existingIds = new Set(prev.map(n => n.id));
            const toAdd = localNotes.filter(n => !existingIds.has(n.id));
            return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId]);

    // Add note — OFFLINE FIRST: save to localStorage → show in UI → sync in background
    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !profile?.id || !jobId) return;

        const trimmed = content.trim();
        const userName = profile.full_name || profile.email || 'Unknown';

        // 1. Save to localStorage queue immediately
        const queued = enqueueNote({
            jobId,
            userId: profile.id,
            content: trimmed,
            tag,
            source,
        });

        // 2. Show in UI instantly (optimistic)
        const optimisticNote: NoteWithUser = {
            id: queued.localId,
            job_id: jobId,
            user_id: profile.id,
            content: trimmed,
            tag,
            source,
            created_at: queued.createdAt,
            user_name: userName,
            user_role: profile.role || '',
        };
        setNotes(prev => [optimisticNote, ...prev]);
        setPendingLocalIds(prev => new Set(Array.from(prev).concat(queued.localId)));


        // 3. Clear form immediately
        setContent('');
        setTag('design_note');
        setSource('self');
        setMentionedUserIds([]);
        setShowMentionDrop(false);

        // 4. Try to sync right away (fire-and-forget)
        setSaving(true);
        try {
            const { error: insertError } = await supabase.from('job_notes').insert([{
                job_id: jobId,
                user_id: profile.id,
                content: trimmed,
                tag,
                source,
            }]);
            if (insertError) throw insertError;

            // Side-effects for special tags
            const sideEffects: Promise<any>[] = [];
            if (tag === 'approved') {
                sideEffects.push(Promise.resolve(supabase.from('jobs').update({
                    approval_status: 'approved', client_approval: true,
                    approval_date: new Date().toISOString(), approval_by: profile.id,
                    approval_remark: trimmed,
                }).eq('id', jobId)));
            } else if (tag === 'approved_closed') {
                sideEffects.push(
                    Promise.resolve(supabase.from('jobs').update({
                        approval_status: 'approved', client_approval: true,
                        approval_date: new Date().toISOString(), approval_by: profile.id,
                        approval_remark: trimmed, current_stage: 'printing',
                    }).eq('id', jobId)),
                    Promise.resolve(supabase.from('job_stage_history').insert([{
                        job_id: jobId, from_stage: currentStage, to_stage: 'printing',
                        notes: `🔒 Approved & Closed — by ${userName}. "${trimmed}"`,
                    }]))
                );
            } else if (tag === 'correction' && isLocked && isAdmin) {
                sideEffects.push(
                    Promise.resolve(supabase.from('jobs').update({
                        approval_status: 'changes_requested', client_approval: false,
                        current_stage: 'designing',
                    }).eq('id', jobId)),
                    Promise.resolve(supabase.from('job_stage_history').insert([{
                        job_id: jobId, from_stage: currentStage, to_stage: 'designing',
                        notes: `🔄 Revision (Admin pullback) — by ${userName}. "${trimmed}"`,
                    }]))
                );
            }
            if (sideEffects.length > 0) {
                await Promise.allSettled(sideEffects);
                if (tag === 'approved_closed' || tag === 'correction') onStageChange?.();
            }

            // Sync succeeded — remove from queue, clear pending indicator
            dequeueNote(queued.localId);
            setPendingLocalIds(prev => { const n = new Set(prev); n.delete(queued.localId); return n; });
            // Fire @mention notifications (fire-and-forget, non-blocking)
            if (mentionedUserIds.length > 0) {
                sendMentionNotifications(mentionedUserIds, trimmed, `Job ${jobId.slice(0, 8).toUpperCase()}`);
            }
        } catch {
            // Sync failed — note stays in localStorage, will retry in 30s
            // No error shown — user already sees the note, it will silently retry
            markFailed(queued.localId, 'Initial sync failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (noteId: string) => {
        const { confirmed } = await confirmDialog({ title: 'Delete Note', message: 'Are you sure you want to delete this note?', variant: 'danger', confirmLabel: 'Delete' });
        if (!confirmed) return;
        try {
            await supabase.from('job_notes').delete().eq('id', noteId);
            await fetchNotes();
        } catch (e: any) { toast.error(String('Error: ' + e.message)); }
    };

    const getRoleBadge = (role?: string) => {
        if (role === 'admin') return <span className="text-[9px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded">Admin</span>;
        if (role === 'manager') return <span className="text-[9px] font-bold bg-gray-700 text-white px-1.5 py-0.5 rounded">Manager</span>;
        return null;
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const diffMs = Date.now() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    // In locked mode, only "correction" tag is available for admin
    const availableTags = isLocked && isAdmin
        ? (['correction'] as NoteTag[])
        : (Object.keys(TAG_CONFIG) as NoteTag[]);

    return (
        <section className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} className="text-orange-500" /> Project Notes & Feedback
                </h4>
                <div className="flex items-center gap-2">
                    {revisionCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-md">
                            <RotateCcw size={10} /> {revisionCount} {revisionCount === 1 ? 'Revision' : 'Revisions'}
                        </span>
                    )}
                    {isLocked && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded-md">
                            <Lock size={10} /> Sent to Print
                        </span>
                    )}
                    {!isLocked && isClosed && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-md">
                            <Lock size={10} /> Closed → Print
                        </span>
                    )}
                    {!isLocked && isApproved && !isClosed && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-md">
                            <CheckCircle size={10} /> Approved
                        </span>
                    )}
                    {notes.length > 0 && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{notes.length}</span>
                    )}
                </div>
            </div>

            {/* Locked banner for designers */}
            {isLocked && !isAdmin && (
                <div className="mb-2 px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-md flex items-center gap-2">
                    <Lock size={14} /> This project is locked — sent to print. Only admin can make changes.
                </div>
            )}

            {/* Admin pullback banner */}
            {isLocked && isAdmin && (
                <div className="mb-2 px-3 py-2 bg-amber-50 text-amber-800 text-xs font-bold rounded-md border border-amber-200 flex items-center gap-2">
                    <AlertCircle size={14} /> Admin mode — you can add a Correction note to pull this back to designer.
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
                {/* Notes Timeline — compact, scrolls internally so the pre-print checklist stays visible */}
                <div className="overflow-y-auto p-3 space-y-2 bg-gray-50/30 max-h-[220px]">
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" size={18} /></div>
                    ) : notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                            <MessageSquare size={20} className="mb-1.5 opacity-50" />
                            <p className="text-xs">No notes yet.</p>
                            {canWriteNow && <p className="text-[10px] mt-0.5">Type below to add the first note.</p>}
                        </div>
                    ) : (
                        notes.map((note) => {
                            const tagConf = TAG_CONFIG[note.tag];
                            const isOwnNote = note.user_id === profile?.id;
                            const isAdminNote = note.user_role === 'admin' || note.user_role === 'manager';

                            return (
                                <div
                                    key={note.id}
                                    className={`rounded-lg border p-3 transition-all ${note.tag === 'approved_closed'
                                        ? 'bg-green-50/50 border-green-300 border-l-[3px] border-l-green-600'
                                        : note.tag === 'approved'
                                            ? 'bg-green-50/30 border-green-200 border-l-[3px] border-l-green-400'
                                            : note.tag === 'correction'
                                                ? 'bg-red-50/30 border-red-200 border-l-[3px] border-l-red-400'
                                                : isAdminNote
                                                    ? 'bg-white border-orange-200 border-l-[3px] border-l-orange-400'
                                                    : 'bg-white border-gray-100'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-gray-800">{isOwnNote ? 'You' : note.user_name}</span>
                                            {getRoleBadge(note.user_role)}
                                            <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${tagConf.bg} ${tagConf.text}`}>
                                                {tagConf.icon} {tagConf.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {pendingLocalIds.has(note.id) && (
                                                <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded animate-pulse">
                                                    <Cloud size={9} /> Saving...
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-400">{formatTime(note.created_at)}</span>
                                            {isOwnNote && !isLocked && (
                                                <button onClick={() => handleDelete(note.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete">×</button>
                                            )}
                                        </div>

                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{renderWithMentions(note.content)}</p>

                                </div>
                            );
                        })
                    )}
                </div>

                {/* Add Note Form */}
                {canWriteNow ? (
                    <form onSubmit={handleAddNote} className="p-3 border-t bg-white space-y-2">
                        {/* Context banners */}
                        {tag === 'approved' && (
                            <div className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1.5 flex items-center gap-1.5">
                                <CheckCircle size={12} /> Marks design as approved — job stays with you for any last-minute changes
                            </div>
                        )}
                        {tag === 'approved_closed' && (
                            <div className="text-[10px] font-bold text-green-800 bg-green-100 border border-green-300 rounded px-2 py-1.5 flex items-center gap-1.5">
                                <Lock size={12} /> FINAL sign-off — job moves to Print Queue and gets LOCKED. No more changes.
                            </div>
                        )}
                        {tag === 'correction' && isLocked && isAdmin && (
                            <div className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 flex items-center gap-1.5">
                                <RotateCcw size={12} /> This will PULL BACK the job from print queue → Revision {revisionCount + 1} → back to designer
                            </div>
                        )}

                        {/* Compact input row: note field first, small type dropdown, send.
                            Default type is "Design Note" — just type and hit send. */}
                        <div className="flex gap-2 items-center relative">
                            <div className="flex-1 relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={content}
                                    onChange={handleContentChange}
                                    onKeyDown={(e) => {
                                        if (showMentionDrop && e.key === 'Escape') setShowMentionDrop(false);
                                    }}
                                    placeholder={
                                        isLocked && isAdmin ? 'Describe why... (type @ to mention)' :
                                            tag === 'approved' ? 'What did the client say? (type @ to mention)...' :
                                                tag === 'approved_closed' ? 'Final remark...' :
                                                    tag === 'correction' ? 'Describe the correction... (type @ to alert someone)' :
                                                        'Add a note... type @ to mention someone'
                                    }
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none"
                                />
                                {/* @mention dropdown */}
                                {showMentionDrop && (
                                    <div className="absolute bottom-full mb-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-56 max-h-40 overflow-y-auto">
                                        {teamMembers
                                            .filter(m => m.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
                                            .slice(0, 8)
                                            .map(member => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                    <span className="font-bold text-blue-600">@</span>
                                                    <span className="font-medium text-gray-800">{member.full_name}</span>
                                                    {member.role && <span className="text-gray-400 text-[9px] ml-auto">{member.role}</span>}
                                                </button>
                                            ))
                                        }
                                        {teamMembers.filter(m => m.full_name.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                                            <p className="px-3 py-2 text-xs text-gray-400">No match for @{mentionQuery}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Small note-type selector — defaults to Design Note.
                                Only Correction is offered when a job is locked (admin pullback). */}
                            <select
                                value={tag}
                                onChange={(e) => setTag(e.target.value as NoteTag)}
                                title="Note type"
                                className={`shrink-0 text-[11px] font-bold rounded-lg border px-2 py-2 outline-none cursor-pointer ${TAG_CONFIG[tag].bg} ${TAG_CONFIG[tag].text} border-gray-200`}
                            >
                                {availableTags.map((key) => (
                                    <option key={key} value={key}>{TAG_CONFIG[key].label}</option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={!content.trim() || saving}
                                className={`p-2 rounded-md transition-colors disabled:opacity-40 ${isLocked && isAdmin ? 'bg-red-600 text-white hover:bg-red-700' :
                                    tag === 'approved_closed' ? 'bg-green-700 text-white hover:bg-green-800' :
                                        tag === 'approved' ? 'bg-green-600 text-white hover:bg-green-700' :
                                            'bg-gray-900 text-white hover:bg-gray-800'
                                    }`}
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="p-3 border-t bg-gray-50 text-center">
                        <p className="text-[10px] text-gray-400">
                            {isLocked ? '🔒 Locked — sent to print. Only admin can pull back.' : 'Read-only — only assigned designer or admin can add notes'}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
