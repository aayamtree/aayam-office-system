'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Save, StickyNote } from 'lucide-react';

export default function MyNotes() {
    const { profile } = useAuth();
    const [notes, setNotes] = useState<any[]>([]);
    const [selectedNote, setSelectedNote] = useState<any | null>(null);
    const [content, setContent] = useState('');
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
                .insert({ user_id: profile?.id, content: 'New note...', color: 'yellow', is_pinned: false })
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
                setContent(data.content);
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
            .update({ content, updated_at: new Date().toISOString() })
            .eq('id', selectedNote.id);
        fetchNotes();
    };

    const deleteNote = async (id: string) => {
        if (!confirm('Delete this note?')) return;
        await supabase.from('notes').delete().eq('id', id);
        if (selectedNote?.id === id) {
            setSelectedNote(null);
            setContent('');
        }
        fetchNotes();
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">My Notes</h1>

                <div className="grid grid-cols-3 gap-6">
                    {/* Notes List */}
                    <div className="col-span-1 space-y-3">
                        <button
                            onClick={createNote}
                            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700"
                        >
                            <Plus size={20} />
                            New Note
                        </button>

                        <div className="space-y-2">
                            {notes.map(note => (
                                <div
                                    key={note.id}
                                    onClick={() => {
                                        setSelectedNote(note);
                                        setContent(note.content);
                                    }}
                                    className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${selectedNote?.id === note.id ? 'bg-purple-50 border-purple-300' : 'bg-white'
                                        }`}
                                >
                                    <p className="text-sm text-gray-900 line-clamp-3">{note.content}</p>
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
                            ))}

                            {notes.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <StickyNote className="mx-auto mb-2" size={48} />
                                    <p>No notes yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor */}
                    <div className="col-span-2">
                        {selectedNote ? (
                            <div className="bg-white rounded-xl p-6 border h-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-gray-900">Edit Note</h2>
                                    <button
                                        onClick={saveNote}
                                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                                    >
                                        <Save size={18} />
                                        Save
                                    </button>
                                </div>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full h-96 p-4 border rounded-lg resize-none"
                                    placeholder="Write your note here..."
                                />
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl p-12 border h-full flex items-center justify-center">
                                <div className="text-center text-gray-400">
                                    <StickyNote className="mx-auto mb-4" size={64} />
                                    <p className="text-lg">Select a note or create a new one</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
