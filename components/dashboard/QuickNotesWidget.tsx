'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDashboardNotes } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
    StickyNote, Plus, Pin, PinOff, Trash2, Send, X,
    ArrowRight, User
} from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';

interface TeamMember {
    id: string;
    full_name: string;
    role: string;
}

const NOTE_COLORS = [
    { value: 'yellow', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
    { value: 'red', bg: 'bg-red-50 border-red-200', dot: 'bg-red-400' },
    { value: 'blue', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400' },
    { value: 'green', bg: 'bg-green-50 border-green-200', dot: 'bg-green-400' },
    { value: 'purple', bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-400' },
];

export default function QuickNotesWidget() {
    const { profile } = useAuth();
    const { notes, loading, createNote, deleteNote, togglePin } = useDashboardNotes();
    const confirm = useConfirm();

    // New note form
    const [showForm, setShowForm] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newColor, setNewColor] = useState('yellow');
    const [taggedIds, setTaggedIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Team members for tagging
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [showTagPicker, setShowTagPicker] = useState(false);
    const tagPickerRef = useRef<HTMLDivElement>(null);

    // Close tag picker on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
                setShowTagPicker(false);
            }
        };
        if (showTagPicker) {
            document.addEventListener('mousedown', handleClick);
        }
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showTagPicker]);

    // Fetch team members once
    useEffect(() => {
        const fetchTeam = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .order('full_name');
            if (data) setTeamMembers(data.filter(m => m.id !== profile?.id));
        };
        if (profile?.id) fetchTeam();
    }, [profile?.id]);

    const handleCreate = async () => {
        if (!newContent.trim()) return;
        setSaving(true);
        setError('');

        try {
            const result = await createNote({
                content: newContent.trim(),
                color: newColor,
                tagged_users: taggedIds.length > 0 ? taggedIds : undefined,
            });

            if (result?.error) {
                setError(result.error);
                setSaving(false);
                return;
            }

            setNewContent('');
            setNewColor('yellow');
            setTaggedIds([]);
            setShowForm(false);
        } catch (err: any) {
            setError(err?.message || 'Failed to save note');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        const { confirmed } = await confirm({ title: 'Delete Note', message: 'Delete this note?', variant: 'danger', confirmLabel: 'Delete' });
        if (!confirmed) return;
        await deleteNote(id);
    };

    const getColorStyle = (color: string) => {
        return NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0];
    };

    const getTaggedName = (userId: string) => {
        const member = teamMembers.find(m => m.id === userId);
        return member?.full_name || 'Unknown';
    };

    const displayNotes = notes.slice(0, 6);

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <StickyNote className="h-4 w-4" strokeWidth={1.5} />
                        Quick Notes
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => { setShowForm(!showForm); setError(''); }}
                    >
                        {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {showForm ? 'Cancel' : 'Add'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* New Note Form */}
                {showForm && (
                    <div className="mb-3 p-3 rounded-md border bg-muted/30 space-y-2">
                        <textarea
                            placeholder="Write your note..."
                            value={newContent}
                            onChange={e => setNewContent(e.target.value)}
                            rows={2}
                            autoFocus
                            className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/60"
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate();
                            }}
                        />

                        {/* Error Display */}
                        {error && (
                            <div className="text-[11px] text-red-500 bg-red-50 px-2 py-1 rounded">{error}</div>
                        )}

                        {/* Color Picker + Tag + Save */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                {/* Color Dots */}
                                {NOTE_COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => setNewColor(c.value)}
                                        className={`h-4 w-4 rounded-full ${c.dot} transition-transform ${newColor === c.value ? 'ring-2 ring-offset-1 ring-foreground scale-110' : 'opacity-60 hover:opacity-100'}`}
                                    />
                                ))}

                                {/* Tag Button */}
                                <div className="relative ml-2" ref={tagPickerRef}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs gap-1 px-2"
                                        onClick={() => setShowTagPicker(!showTagPicker)}
                                    >
                                        <User className="h-3 w-3" />
                                        {taggedIds.length > 0 ? `${taggedIds.length} tagged` : 'Tag'}
                                    </Button>

                                    {/* Tag Picker Dropdown */}
                                    {showTagPicker && (
                                        <div className="absolute bottom-full left-0 mb-1 w-48 bg-popover border rounded-md shadow-sm z-50 max-h-40 overflow-y-auto">
                                            {teamMembers.length === 0 ? (
                                                <div className="p-2 text-xs text-muted-foreground">No team members found</div>
                                            ) : (
                                                teamMembers.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => {
                                                            setTaggedIds(prev =>
                                                                prev.includes(m.id)
                                                                    ? prev.filter(id => id !== m.id)
                                                                    : [...prev, m.id]
                                                            );
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
                                                    >
                                                        <div className={`h-3 w-3 rounded border flex items-center justify-center ${taggedIds.includes(m.id) ? 'bg-foreground border-foreground' : 'border-border'}`}>
                                                            {taggedIds.includes(m.id) && (
                                                                <span className="text-background text-[8px]">✓</span>
                                                            )}
                                                        </div>
                                                        <span>{m.full_name}</span>
                                                        <span className="text-muted-foreground capitalize ml-auto">{m.role}</span>
                                                    </button>
                                                ))
                                            )}
                                            <div className="border-t p-1">
                                                <button
                                                    onClick={() => setShowTagPicker(false)}
                                                    className="w-full text-center text-xs text-muted-foreground py-1 hover:text-foreground"
                                                >
                                                    Done
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={handleCreate}
                                disabled={saving || !newContent.trim()}
                            >
                                <Send className="h-3 w-3" />
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>

                        {/* Tagged Users Preview */}
                        {taggedIds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {taggedIds.map(id => (
                                    <Badge key={id} variant="secondary" className="text-[10px] gap-1 h-5">
                                        @{getTaggedName(id)}
                                        <button onClick={() => setTaggedIds(prev => prev.filter(i => i !== id))}>
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}

                        <div className="text-[10px] text-muted-foreground">⌘+Enter to save</div>
                    </div>
                )}

                {/* Notes List */}
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-2.5 rounded-md border bg-amber-50/40 border-amber-100 animate-pulse space-y-1.5">
                                <div className="h-2.5 bg-amber-100 rounded w-5/6" />
                                <div className="h-2 bg-amber-100/60 rounded w-1/3" />
                            </div>
                        ))}
                    </div>
                ) : displayNotes.length === 0 ? (
                    <div className="text-center py-6">
                        <StickyNote className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-xs text-muted-foreground">No notes yet</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Click + Add to create your first note</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {displayNotes.map(note => {
                            const colorStyle = getColorStyle(note.color);
                            const isFromOther = note.user_id !== profile?.id;
                            const timeAgo = getTimeAgo(note.updated_at || note.created_at || new Date().toISOString());

                            return (
                                <div
                                    key={note.id}
                                    className={`p-2.5 rounded-md border text-xs ${colorStyle.bg} group relative`}
                                >
                                    {/* Content */}
                                    <p className="text-foreground/80 line-clamp-2 pr-12">{note.content}</p>

                                    {/* Meta Row */}
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                        <span>{timeAgo}</span>
                                        {isFromOther && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 border-blue-200 text-blue-600">
                                                <User className="h-2 w-2" />
                                                Tagged
                                            </Badge>
                                        )}
                                        {note.is_pinned && (
                                            <Pin className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                                        )}
                                        {note.tagged_users && note.tagged_users.length > 0 && !isFromOther && (
                                            <span className="text-blue-500">→ {note.tagged_users.length} tagged</span>
                                        )}
                                    </div>

                                    {/* Actions (show on hover) */}
                                    {!isFromOther && (
                                        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => togglePin(note.id, note.is_pinned)}
                                                className="p-1 rounded hover:bg-black/5"
                                                title={note.is_pinned ? 'Unpin' : 'Pin'}
                                            >
                                                {note.is_pinned
                                                    ? <PinOff className="h-3 w-3 text-muted-foreground" />
                                                    : <Pin className="h-3 w-3 text-muted-foreground" />
                                                }
                                            </button>
                                            <button
                                                onClick={() => handleDelete(note.id)}
                                                className="p-1 rounded hover:bg-red-100"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3 w-3 text-red-400" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* View All Link */}
                {notes.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border">
                        <Button variant="ghost" size="sm" className="w-full text-xs h-7" asChild>
                            <Link href="/admin/designers/my-notes" className="flex items-center justify-center gap-1">
                                View All Notes <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function getTimeAgo(dateStr: string): string {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
