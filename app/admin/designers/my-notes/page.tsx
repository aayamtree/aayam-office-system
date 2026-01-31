'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Save, StickyNote, Search, Hash } from 'lucide-react';

export default function MyNotes() {
    const { profile } = useAuth();
    const [notes, setNotes] = useState<any[]>([]);
    const [selectedNote, setSelectedNote] = useState<any | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotes();
    }, [profile?.id]);

    const fetchNotes = async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', profile.id)
            .order('updated_at', { ascending: false });
        setNotes(data || []);
        setLoading(false);
    };

    const createNote = async () => {
        try {
            const { data, error } = await supabase
                .from('notes')
                .insert({
                    user_id: profile?.id,
                    title: 'New note',
                    content: '',
                    color: 'yellow',
                    is_pinned: false
                })
                .select()
                .single();
            if (error) {
                console.error('Create note error:', error);
                alert('Error creating note: ' + error.message + '. Check if RLS is disabled on notes table.');
                return;
            }
            if (data) {
                setNotes([data, ...notes]);
                setSelectedNote(data);
                setTitle(data.title || '');
                setContent(data.content || '');
            }
        } catch (err: any) {
            console.error('Create note exception:', err);
            alert('Failed to create note: ' + err.message);
        }
    };

    const saveNote = async () => {
        if (!selectedNote) return;
        await supabase
            .from('notes')
            .update({ title, content, updated_at: new Date().toISOString() })
            .eq('id', selectedNote.id);
        fetchNotes();
    };

    const deleteNote = async (id: string) => {
        if (!confirm('Delete this note?')) return;
        await supabase.from('notes').delete().eq('id', id);
        if (selectedNote?.id === id) {
            setSelectedNote(null);
            setTitle('');
            setContent('');
        }
        fetchNotes();
    };

    // Extract hashtags from content
    const extractHashtags = (text: string): string[] => {
        const regex = /#[\w]+/g;
        return text.match(regex) || [];
    };

    // Filter notes by search query (searches title, content, and hashtags)
    const filteredNotes = notes.filter(note => {
        const query = searchQuery.toLowerCase();
        const titleMatch = note.title?.toLowerCase().includes(query);
        const contentMatch = note.content?.toLowerCase().includes(query);
        const hashtags = extractHashtags(note.content || '').map(h => h.toLowerCase());
        const hashtagMatch = hashtags.some(h => h.includes(query));
        return titleMatch || contentMatch || hashtagMatch;
    });

    // Get all unique hashtags across all notes
    const allHashtags = Array.from(
        new Set(notes.flatMap(note => extractHashtags(note.content || '')))
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oms-blue"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header - Responsive */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                    <h1 className="text-2xl md:text-page-title text-gray-900">My Notes</h1>
                    <button
                        onClick={createNote}
                        className="flex items-center gap-2 bg-oms-blue text-white px-4 py-2.5 rounded-xl hover:bg-oms-blue text-sm font-medium w-full sm:w-auto justify-center"
                    >
                        <Plus size={18} />
                        New Note
                    </button>
                </div>

                {/* Mobile: Stack layout, Desktop: Side-by-side */}
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Notes List - Full width on mobile, 1/3 on desktop */}
                    <div className="lg:col-span-1 space-y-3 order-2 lg:order-1">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search notes or #hashtags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                            />
                        </div>

                        {/* Popular Hashtags */}
                        {allHashtags.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border">
                                <div className="flex items-center gap-2 mb-2">
                                    <Hash size={16} className="text-oms-blue" />
                                    <span className="text-sm font-semibold text-gray-700">Popular Tags</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {allHashtags.slice(0, 6).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setSearchQuery(tag)}
                                            className="px-2 py-1 bg-[rgba(0,0,255,0.05)] text-oms-blue rounded text-xs hover:bg-oms-blue"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes List */}
                        <div className="space-y-2">
                            {filteredNotes.map(note => {
                                const hashtags = extractHashtags(note.content || '');
                                return (
                                    <div
                                        key={note.id}
                                        onClick={() => {
                                            setSelectedNote(note);
                                            setTitle(note.title || '');
                                            setContent(note.content || '');
                                        }}
                                        className={`p-4 rounded-lg border cursor-pointer  transition-shadow ${selectedNote?.id === note.id ? 'bg-[rgba(0,0,255,0.05)] border-purple-300' : 'bg-white'
                                            }`}
                                    >
                                        <h3 className="font-semibold text-gray-900 mb-1 text-sm">{note.title || 'Untitled'}</h3>
                                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">{note.content}</p>
                                        {hashtags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {hashtags.slice(0, 3).map((tag, idx) => (
                                                    <span key={idx} className="text-xs text-oms-blue font-medium">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-xs text-gray-500">
                                                {new Date(note.updated_at).toLocaleDateString()}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNote(note.id);
                                                }}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredNotes.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <StickyNote className="mx-auto mb-2" size={48} />
                                    <p className="text-sm">
                                        {searchQuery ? 'No notes found' : 'No notes yet'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor - Full width on mobile, 2/3 on desktop, shows first on mobile */}
                    <div className="lg:col-span-2 order-1 lg:order-2">
                        {selectedNote ? (
                            <div className="bg-white rounded-xl p-6 border h-full">
                                <div className="flex justify-between items-center mb-4">
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Note title..."
                                        className="text-lg md:text-section text-gray-900 border-b-2 border-transparent hover:border-gray-200 focus:border-oms-blue outline-none flex-1 mr-2 md:mr-4"
                                    />
                                    <button
                                        onClick={saveNote}
                                        className="flex items-center gap-1.5 md:gap-2 bg-oms-blue text-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl hover:bg-oms-blue text-sm font-medium flex-shrink-0"
                                    >
                                        <Save size={16} />
                                        <span className="hidden sm:inline">Save</span>
                                    </button>
                                </div>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full h-96 p-4 border rounded-lg resize-none text-sm"
                                    placeholder="Write your note here... Use #hashtags for quick search"
                                />
                                <div className="mt-3 text-xs text-gray-500">
                                    💡 Tip: Use #hashtags in your notes to organize and search quickly
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl p-12 border h-full flex items-center justify-center">
                                <div className="text-center text-gray-400">
                                    <StickyNote className="mx-auto mb-4" size={64} />
                                    <p className="text-lg">Select a note or create a new one</p>
                                    <p className="text-sm mt-2">Use #hashtags to organize your notes</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
