'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
    Plus, Trash2, Save, StickyNote, Search, Hash, Pin, PinOff,
    Users, CheckCircle, Link as LinkIcon, AtSign, X, Loader2, Share2, Calendar, Send
} from 'lucide-react';
import Link from 'next/link';

interface TeamMember {
    id: string;
    full_name: string;
    role: string;
}

interface NoteItem {
    id: string;
    user_id: string;
    title: string;
    content: string;
    color: string;
    is_pinned: boolean;
    shared_with: string[];
    mentioned_users: string[];
    tagged_users: string[];
    linked_job_id: string | null;
    note_date: string;
    created_at: string;
    updated_at: string;
}

interface JobOption {
    id: string;
    job_id: string;
    project_name: string;
}

const NOTE_COLORS = [
    { value: 'yellow', bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-400' },
    { value: 'red', bg: 'bg-red-50', border: 'border-red-300', dot: 'bg-red-400' },
    { value: 'blue', bg: 'bg-blue-50', border: 'border-blue-300', dot: 'bg-blue-400' },
    { value: 'green', bg: 'bg-green-50', border: 'border-green-300', dot: 'bg-green-400' },
    { value: 'purple', bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-400' },
];

type TabType = 'my_notes' | 'shared' | 'all';

export default function MyNotes() {
    const { profile, isAdmin } = useAuth();

    // Notes data
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('my_notes');

    // Editor state
    const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('yellow');
    const [isPinned, setIsPinned] = useState(false);
    const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
    const [sharedWith, setSharedWith] = useState<string[]>([]);
    const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
    const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // UI state
    const [saving, setSaving] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [showSharePicker, setShowSharePicker] = useState(false);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionCursorPos, setMentionCursorPos] = useState(0);

    // Reference data
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [jobs, setJobs] = useState<JobOption[]>([]);

    // Refs
    const contentRef = useRef<HTMLTextAreaElement>(null);
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
    const mentionDropdownRef = useRef<HTMLDivElement>(null);

    // ======== LOAD DATA ========
    useEffect(() => {
        loadTeamMembers();
        loadJobs();
    }, []);

    useEffect(() => {
        if (profile?.id) fetchNotes();
    }, [profile?.id, activeTab]);

    const loadTeamMembers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .order('full_name');
        if (data) {
            // Include all users, use email as fallback for full_name
            const members = data.map((m: any) => ({
                id: m.id,
                full_name: m.full_name || m.email?.split('@')[0] || 'User',
                role: m.role || 'team',
            }));
            setTeamMembers(members);
        }
    };

    const loadJobs = async () => {
        const { data } = await supabase
            .from('jobs')
            .select('id, job_id, project_name')
            .order('created_at', { ascending: false })
            .limit(50);
        if (data) setJobs(data as JobOption[]);
    };

    const fetchNotes = async () => {
        if (!profile?.id) return;
        setLoading(true);

        try {
            let fetchedNotes: NoteItem[] = [];

            if (activeTab === 'my_notes') {
                const { data } = await supabase
                    .from('notes')
                    .select('*')
                    .eq('user_id', profile.id)
                    .order('is_pinned', { ascending: false })
                    .order('updated_at', { ascending: false });
                fetchedNotes = (data || []) as NoteItem[];
            } else if (activeTab === 'shared') {
                // Notes shared with me (via shared_with or mentioned_users or tagged_users)
                // Some columns may not exist yet — each query handles errors gracefully
                const safeQuery = async (col: string) => {
                    const { data, error } = await supabase
                        .from('notes')
                        .select('*')
                        .contains(col, [profile.id])
                        .order('updated_at', { ascending: false });
                    if (error) return []; // Column likely doesn't exist
                    return data || [];
                };
                const [shared, mentioned, tagged] = await Promise.all([
                    safeQuery('shared_with'),
                    safeQuery('mentioned_users'),
                    safeQuery('tagged_users'),
                ]);
                const combined = [...shared, ...mentioned, ...tagged];
                // Deduplicate
                const unique = combined.filter((n: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === n.id) === i);
                unique.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                fetchedNotes = unique as NoteItem[];
            } else if (activeTab === 'all' && isAdmin) {
                const { data } = await supabase
                    .from('notes')
                    .select('*')
                    .order('updated_at', { ascending: false })
                    .limit(100);
                fetchedNotes = (data || []) as NoteItem[];
            }

            setNotes(fetchedNotes);
        } catch (e) {
            console.error('Error fetching notes:', e);
        }
        setLoading(false);
    };

    // ======== NOTE CRUD ========
    const createNote = async () => {
        if (!profile?.id) return;
        try {
            // Only insert columns that exist in the base notes table
            const insertData: Record<string, any> = {
                user_id: profile.id,
                title: 'New note',
                content: '',
                color: 'yellow',
                is_pinned: false,
            };

            const { data, error } = await supabase
                .from('notes')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Create error:', error);
                alert('Error creating note: ' + error.message);
                return;
            }
            if (data) {
                setNotes([data as NoteItem, ...notes]);
                selectNote(data as NoteItem);
            }
        } catch (err: any) {
            alert('Failed to create note: ' + err.message);
        }
    };

    const saveNote = async (showIndicator = true) => {
        if (!selectedNote) return;
        if (showIndicator) setSaving(true);
        else setAutoSaveStatus('saving');

        try {
            // Parse @mentions from content
            const parsedMentions = parseMentions(content);

            // Start with base columns that always exist
            const updates: Record<string, any> = {
                title,
                content,
                color,
                is_pinned: isPinned,
                updated_at: new Date().toISOString(),
            };

            // Try with all columns first, fallback to base columns only
            if (linkedJobId) updates.linked_job_id = linkedJobId;
            if (sharedWith.length > 0) updates.shared_with = sharedWith;
            if (parsedMentions.length > 0) updates.mentioned_users = parsedMentions;
            // Also set tagged_users for backward compatibility
            if (parsedMentions.length > 0) updates.tagged_users = parsedMentions;

            let { error } = await supabase
                .from('notes')
                .update(updates)
                .eq('id', selectedNote.id);

            // If error due to missing columns, retry with only base columns
            if (error) {
                console.warn('Save with all columns failed, retrying with base columns:', error.message);
                const baseUpdates = {
                    title,
                    content,
                    color,
                    is_pinned: isPinned,
                    updated_at: new Date().toISOString(),
                };
                const retryResult = await supabase
                    .from('notes')
                    .update(baseUpdates)
                    .eq('id', selectedNote.id);
                error = retryResult.error;
            }

            if (error) throw error;


            // Send notifications for NEW mentions
            const oldMentions = selectedNote.mentioned_users || [];
            const newMentions = parsedMentions.filter((id: string) => !oldMentions.includes(id));

            if (newMentions.length > 0) {
                await sendMentionNotifications(newMentions, title || 'Untitled Note');
            }

            // Update local state
            setSelectedNote({ ...selectedNote, ...updates, mentioned_users: parsedMentions });
            setMentionedUsers(parsedMentions);

            if (!showIndicator) {
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus('idle'), 2000);
            }

            fetchNotes();
        } catch (e: any) {
            alert('Error saving: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const deleteNote = async (id: string) => {
        if (!confirm('Delete this note?')) return;
        await supabase.from('notes').delete().eq('id', id);
        if (selectedNote?.id === id) {
            setSelectedNote(null);
            resetEditor();
        }
        fetchNotes();
    };

    const togglePin = async (note: NoteItem) => {
        await supabase
            .from('notes')
            .update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() })
            .eq('id', note.id);
        if (selectedNote?.id === note.id) setIsPinned(!note.is_pinned);
        fetchNotes();
    };

    // ======== @MENTION LOGIC ========
    const parseMentions = (text: string): string[] => {
        const regex = /@(\w+)/g;
        const matches = text.match(regex) || [];
        const mentionNames = matches.map(m => m.slice(1).toLowerCase());

        return teamMembers
            .filter(u => mentionNames.some(name =>
                u.full_name.replace(/\s+/g, '').toLowerCase().includes(name.toLowerCase())
            ))
            .map(u => u.id);
    };

    const sendMentionNotifications = async (userIds: string[], noteTitle: string) => {
        const authorName = profile?.full_name || 'Someone';
        const notifications = userIds.map(userId => ({
            message: `📝 ${authorName} mentioned you in a note: "${noteTitle}"`,
            priority: 'normal',
            target_audience: 'all', // We handle targeting via the user check
            created_by: profile?.id,
        }));

        // Insert into broadcast_notifications
        for (const notif of notifications) {
            await supabase.from('broadcast_notifications').insert(notif).select();
        }
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;
        setContent(newValue);

        // Check for @mention trigger
        const textBeforeCursor = newValue.slice(0, cursorPos);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            const afterAt = textBeforeCursor.slice(lastAt + 1);
            if (!afterAt.includes(' ') && !afterAt.includes('\n') && afterAt.length < 20) {
                setShowMentionDropdown(true);
                setMentionFilter(afterAt.toLowerCase());
                setMentionCursorPos(lastAt);
            } else {
                setShowMentionDropdown(false);
            }
        } else {
            setShowMentionDropdown(false);
        }

        // Auto-save debounce
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
            if (selectedNote) saveNote(false);
        }, 2000);
    };

    const insertMention = (member: TeamMember) => {
        const textarea = contentRef.current;
        if (!textarea) return;

        const beforeAt = content.slice(0, mentionCursorPos);
        const afterCursor = content.slice(textarea.selectionStart);
        const mentionText = `@${member.full_name.replace(/\s+/g, '')} `;
        const newContent = beforeAt + mentionText + afterCursor;

        setContent(newContent);
        setShowMentionDropdown(false);

        // Focus back
        setTimeout(() => {
            textarea.focus();
            const pos = mentionCursorPos + mentionText.length;
            textarea.setSelectionRange(pos, pos);
        }, 0);
    };

    const handleContentKeyDown = (e: React.KeyboardEvent) => {
        if (!showMentionDropdown) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            setShowMentionDropdown(false);
        }
    };

    // ======== HELPERS ========
    const selectNote = (note: NoteItem) => {
        setSelectedNote(note);
        setTitle(note.title || '');
        setContent(note.content || '');
        setColor(note.color || 'yellow');
        setIsPinned(note.is_pinned || false);
        setLinkedJobId(note.linked_job_id || null);
        setSharedWith(note.shared_with || []);
        setMentionedUsers(note.mentioned_users || []);
        setNoteDate((note as any).note_date || new Date(note.updated_at).toISOString().split('T')[0]);
        setShowMentionDropdown(false);
        setAutoSaveStatus('idle');
    };

    const resetEditor = () => {
        setTitle('');
        setContent('');
        setColor('yellow');
        setIsPinned(false);
        setLinkedJobId(null);
        setSharedWith([]);
        setMentionedUsers([]);
        setNoteDate(new Date().toISOString().split('T')[0]);
        setShowSharePicker(false);
        setAutoSaveStatus('idle');
    };

    const extractHashtags = (text: string): string[] => {
        return text.match(/#[\w]+/g) || [];
    };

    const getMemberName = (id: string) => teamMembers.find(m => m.id === id)?.full_name || 'Unknown';

    const getColorStyle = (c: string) => NOTE_COLORS.find(nc => nc.value === c) || NOTE_COLORS[0];

    const getJobName = (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        return job ? `${job.job_id} — ${job.project_name}` : '';
    };

    const filteredMentionMembers = teamMembers.filter(m =>
        m.full_name.toLowerCase().includes(mentionFilter) && m.id !== profile?.id
    );

    // ======== FILTER NOTES ========
    const filteredNotes = notes.filter(note => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const titleMatch = (note.title || '').toLowerCase().includes(q);
        const contentMatch = (note.content || '').toLowerCase().includes(q);
        const hashtagMatch = extractHashtags(note.content || '').some(h => h.toLowerCase().includes(q));
        // Check if searching for @person
        if (q.startsWith('@')) {
            const nameQuery = q.slice(1);
            const mentionMatch = (note.mentioned_users || []).some(uid =>
                getMemberName(uid).toLowerCase().includes(nameQuery)
            );
            const sharedMatch = (note.shared_with || []).some(uid =>
                getMemberName(uid).toLowerCase().includes(nameQuery)
            );
            return mentionMatch || sharedMatch || titleMatch || contentMatch;
        }
        return titleMatch || contentMatch || hashtagMatch;
    });

    // Sort: pinned first
    const sortedNotes = [...filteredNotes].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return 0;
    });

    // All unique hashtags
    const allHashtags = Array.from(
        new Set(notes.flatMap(note => extractHashtags(note.content || '')))
    );

    if (loading && notes.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                        <h1 className="text-page-title text-gray-900">Notes</h1>
                        <p className="text-sm text-gray-500 mt-0.5">@mention anyone · #hashtag to organize · search everything</p>
                    </div>
                    <button
                        onClick={createNote}
                        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 text-sm font-medium w-full sm:w-auto justify-center transition-colors"
                    >
                        <Plus size={18} />
                        New Note
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 border w-fit">
                    <button
                        onClick={() => setActiveTab('my_notes')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'my_notes' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        My Notes
                    </button>
                    <button
                        onClick={() => setActiveTab('shared')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'shared' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Users size={14} />
                        Shared With Me
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            All Notes
                        </button>
                    )}
                </div>

                {/* Main Layout */}
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
                    {/* Left Panel - Notes List */}
                    <div className="lg:col-span-1 space-y-3 order-2 lg:order-1">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search notes, #tags, @people..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-400 transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Popular Tags */}
                        {allHashtags.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border">
                                <div className="flex items-center gap-2 mb-2">
                                    <Hash size={14} className="text-gray-500" />
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {allHashtags.slice(0, 8).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setSearchQuery(tag)}
                                            className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors font-medium"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes List */}
                        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                            {sortedNotes.map(note => {
                                const style = getColorStyle(note.color);
                                const hashtags = extractHashtags(note.content || '');
                                const hasShares = (note.shared_with?.length || 0) + (note.mentioned_users?.length || 0) > 0;
                                const authorName = activeTab !== 'my_notes' ? getMemberName(note.user_id) : null;

                                return (
                                    <div
                                        key={note.id}
                                        onClick={() => selectNote(note)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${selectedNote?.id === note.id
                                            ? `${style.bg} ${style.border} border-2`
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {note.is_pinned && <Pin size={12} className="text-amber-500 flex-shrink-0" />}
                                                    <div className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
                                                    <h3 className="font-semibold text-gray-900 text-sm truncate">{note.title || 'Untitled'}</h3>
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-2 mt-1">{note.content}</p>
                                                {authorName && (
                                                    <p className="text-xs text-blue-600 mt-1 font-medium">by {authorName}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                                                className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        {/* Tags & Meta */}
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            {hashtags.slice(0, 3).map((tag, idx) => (
                                                <span key={idx} className="text-xs text-primary font-medium">{tag}</span>
                                            ))}
                                            {note.linked_job_id && (
                                                <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                                    🔗 {getJobName(note.linked_job_id).slice(0, 20)}
                                                </span>
                                            )}
                                            {hasShares && (
                                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                                    <Users size={10} />
                                                    shared
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-xs text-gray-400">
                                                {new Date(note.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {sortedNotes.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <StickyNote className="mx-auto mb-2" size={48} />
                                    <p className="text-sm">
                                        {searchQuery ? 'No notes match your search' : activeTab === 'shared' ? 'No notes shared with you yet' : 'No notes yet — create one!'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Editor */}
                    <div className="lg:col-span-2 order-1 lg:order-2">
                        {selectedNote ? (
                            <div className="bg-white rounded-lg border h-full flex flex-col">
                                {/* Editor Header */}
                                <div className="p-4 border-b flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Note title..."
                                            className="text-lg font-semibold text-gray-900 border-none outline-none flex-1 bg-transparent placeholder:text-gray-300"
                                        />
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {/* Auto-save indicator */}
                                            {autoSaveStatus === 'saving' && (
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Loader2 size={12} className="animate-spin" /> saving...
                                                </span>
                                            )}
                                            {autoSaveStatus === 'saved' && (
                                                <span className="text-xs text-green-600 flex items-center gap-1">
                                                    <CheckCircle size={12} /> saved
                                                </span>
                                            )}
                                            <button
                                                onClick={() => saveNote(true)}
                                                disabled={saving}
                                                className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-md hover:bg-gray-800 text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                Save
                                            </button>
                                        </div>
                                    </div>

                                    {/* Toolbar */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {/* Color Picker */}
                                        <div className="flex items-center gap-1.5">
                                            {NOTE_COLORS.map(c => (
                                                <button
                                                    key={c.value}
                                                    onClick={() => setColor(c.value)}
                                                    className={`w-5 h-5 rounded-full ${c.dot} transition-transform ${color === c.value ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                                                />
                                            ))}
                                        </div>

                                        <div className="w-px h-5 bg-gray-200" />

                                        {/* Pin */}
                                        <button
                                            onClick={() => setIsPinned(!isPinned)}
                                            className={`p-1.5 rounded transition-colors ${isPinned ? 'bg-amber-100 text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
                                            title={isPinned ? 'Unpin' : 'Pin to top'}
                                        >
                                            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
                                        </button>

                                        <div className="w-px h-5 bg-gray-200" />

                                        {/* Share */}
                                        <button
                                            onClick={() => setShowSharePicker(!showSharePicker)}
                                            className={`p-1.5 rounded transition-colors flex items-center gap-1 text-sm ${showSharePicker ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            <Share2 size={14} />
                                            {sharedWith.length > 0 && (
                                                <span className="text-xs font-medium">{sharedWith.length}</span>
                                            )}
                                        </button>

                                        <div className="w-px h-5 bg-gray-200" />

                                        {/* Link to Project */}
                                        <select
                                            value={linkedJobId || ''}
                                            onChange={(e) => setLinkedJobId(e.target.value || null)}
                                            className="text-xs border rounded px-2 py-1 text-gray-600 bg-white max-w-[200px]"
                                        >
                                            <option value="">🔗 Link to project...</option>
                                            {jobs.map(j => (
                                                <option key={j.id} value={j.id}>{j.job_id} — {j.project_name}</option>
                                            ))}
                                        </select>

                                        <div className="w-px h-5 bg-gray-200" />

                                        {/* Date Picker */}
                                        <div className="flex items-center gap-1">
                                            <Calendar size={14} className="text-gray-400" />
                                            <input
                                                type="date"
                                                value={noteDate}
                                                onChange={(e) => setNoteDate(e.target.value)}
                                                className="text-xs border rounded px-2 py-1 text-gray-600 bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Share Picker */}
                                    {showSharePicker && (
                                        <div className="bg-gray-50 rounded-lg p-3 border">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Share with team members</p>
                                            <div className="flex flex-wrap gap-2">
                                                {teamMembers.filter(m => m.id !== profile?.id).map(member => (
                                                    <button
                                                        key={member.id}
                                                        onClick={() => {
                                                            setSharedWith(prev =>
                                                                prev.includes(member.id)
                                                                    ? prev.filter(id => id !== member.id)
                                                                    : [...prev, member.id]
                                                            );
                                                        }}
                                                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${sharedWith.includes(member.id)
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white border text-gray-600 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        {member.full_name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Shared With Tags (visible inline) */}
                                    {sharedWith.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap bg-blue-50/50 rounded-lg px-3 py-2">
                                            <Send size={12} className="text-blue-500" />
                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Shared with:</span>
                                            {sharedWith.map(uid => {
                                                const member = teamMembers.find(m => m.id === uid);
                                                return member ? (
                                                    <span key={uid} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                        @{member.full_name}
                                                        <button onClick={() => setSharedWith(prev => prev.filter(id => id !== uid))} className="hover:text-red-500 ml-0.5">
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Content Editor with @mention */}
                                <div className="flex-1 p-4 relative">
                                    <textarea
                                        ref={contentRef}
                                        value={content}
                                        onChange={handleContentChange}
                                        onKeyDown={handleContentKeyDown}
                                        className="w-full h-full min-h-[300px] resize-none text-sm text-gray-800 leading-relaxed outline-none placeholder:text-gray-300"
                                        placeholder="Write your note here... Type @ to mention someone, # for hashtags"
                                    />

                                    {/* @Mention Dropdown */}
                                    {showMentionDropdown && filteredMentionMembers.length > 0 && (
                                        <div
                                            ref={mentionDropdownRef}
                                            className="absolute z-50 left-4 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto w-64"
                                            style={{ top: '80px' }}
                                        >
                                            {filteredMentionMembers.slice(0, 8).map(member => (
                                                <button
                                                    key={member.id}
                                                    onClick={() => insertMention(member)}
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                        {member.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-900">{member.full_name}</span>
                                                        <span className="text-xs text-gray-400 ml-1.5">{member.role}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-4 py-3 border-t bg-gray-50 rounded-b-lg">
                                    <div className="flex items-center gap-4 text-xs text-gray-400">
                                        <span className="flex items-center gap-1"><AtSign size={12} /> Type @ to mention</span>
                                        <span className="flex items-center gap-1"><Hash size={12} /> Use # for tags</span>
                                        <span>Auto-saves after 2s</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg p-12 border h-full flex items-center justify-center min-h-[400px]">
                                <div className="text-center text-gray-400">
                                    <StickyNote className="mx-auto mb-4" size={64} />
                                    <p className="text-lg font-medium text-gray-500">Select a note or create a new one</p>
                                    <p className="text-sm mt-2">Use @mentions to tag team members and #hashtags to organize</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
