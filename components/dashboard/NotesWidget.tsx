'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useNotes } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Plus, X, Pin, Trash2, Check, Loader2, Link as LinkIcon } from 'lucide-react';
import { Note } from '@/types/database';

const colors = [
    { name: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-200' },
    { name: 'green', bg: 'bg-green-100', border: 'border-green-200' },
    { name: 'blue', bg: 'bg-blue-100', border: 'border-blue-200' },
    { name: 'pink', bg: 'bg-pink-100', border: 'border-pink-200' },
    { name: 'purple', bg: 'bg-purple-100', border: 'border-purple-200' },
];

export default function NotesWidget() {
    const { notes, loading, createNote, deleteNote, updateNote } = useNotes();
    const [isAdding, setIsAdding] = useState(false);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [jobNumber, setJobNumber] = useState('');
    const [selectedColor, setSelectedColor] = useState('yellow');
    const [saving, setSaving] = useState(false);

    const handleAdd = async () => {
        if (!newNoteContent.trim()) return;
        setSaving(true);

        let linkedJobId = undefined;
        if (jobNumber.trim()) {
            const searchNum = jobNumber.trim();
            // Try exact match first
            let { data: job } = await supabase.from('jobs').select('id, job_number').eq('job_number', searchNum).single();

            // If not found and is numeric, try searching with JB- prefix
            if (!job && /^\d+$/.test(searchNum)) {
                const { data: jobPrefix } = await supabase.from('jobs').select('id, job_number').eq('job_number', `JB-${searchNum}`).single();
                job = jobPrefix;
            }

            // Also try searching with # prefix removal if user typed #1045
            if (!job && searchNum.startsWith('#')) {
                const cleanNum = searchNum.replace('#', '');
                const { data: jobHash } = await supabase.from('jobs').select('id, job_number').eq('job_number', cleanNum).single();
                if (!jobHash && /^\d+$/.test(cleanNum)) {
                    const { data: jobHashPrefix } = await supabase.from('jobs').select('id, job_number').eq('job_number', `JB-${cleanNum}`).single();
                    job = jobHashPrefix;
                } else {
                    job = jobHash;
                }
            }

            if (job) linkedJobId = job.id;
        }

        await createNote({
            content: newNoteContent,
            color: selectedColor,
            is_pinned: false,
            linked_job_id: linkedJobId
        });
        setNewNoteContent('');
        setJobNumber('');
        setIsAdding(false);
        setSaving(false);
    };

    const togglePin = async (note: Note) => {
        await updateNote(note.id, { is_pinned: !note.is_pinned });
    };

    const getStyle = (colorName: string) => {
        return colors.find(c => c.name === colorName) || colors[0];
    };

    if (loading) return <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl"><Loader2 className="animate-spin text-gray-400" /></div>;

    // Sort: Pinned first, then by date
    const sortedNotes = [...notes].sort((a, b) => {
        if (a.is_pinned === b.is_pinned) return 0;
        return a.is_pinned ? -1 : 1;
    });

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Notes</h3>
                <button
                    onClick={() => setIsAdding(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {isAdding && (
                    <div className={`p-4 rounded-xl border-2 border-dashed border-gray-200 animate-in fade-in slide-in-from-top-2 bg-gray-50`}>
                        <textarea
                            autoFocus
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            placeholder="Type your note..."
                            className="w-full bg-transparent border-none focus:ring-0 resize-none text-sm mb-2 min-h-[80px]"
                        />

                        <div className="flex items-center gap-2 mb-3 px-1">
                            <LinkIcon size={14} className="text-gray-400" />
                            <input
                                type="text"
                                value={jobNumber}
                                onChange={(e) => setJobNumber(e.target.value)}
                                placeholder="Link Job # (Optional)"
                                className="bg-transparent border-b border-gray-200 text-xs w-full focus:outline-none focus:border-gray-400 pb-1"
                            />
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <div className="flex gap-1.5">
                                {colors.map(c => (
                                    <button
                                        key={c.name}
                                        onClick={() => setSelectedColor(c.name)}
                                        className={`w-5 h-5 rounded-full ${c.bg} border ${c.border} ${selectedColor === c.name ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500"
                                >
                                    <X size={16} />
                                </button>
                                <button
                                    disabled={saving}
                                    onClick={handleAdd}
                                    className="p-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {sortedNotes.length === 0 && !isAdding && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        No notes yet. Click + to add one.
                    </div>
                )}

                {sortedNotes.map(note => {
                    const style = getStyle(note.color);
                    return (
                        <div key={note.id} className={`group relative p-4 rounded-xl ${style.bg} border ${style.border} transition-all hover:shadow-md`}>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>

                            {note.job && (
                                <Link
                                    href={`/admin/jobs?search=${note.job.job_number}`}
                                    className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 bg-white/50 rounded-lg text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-white transition-colors"
                                >
                                    <LinkIcon size={10} />
                                    Job #{note.job.job_number}
                                </Link>
                            )}

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button
                                    onClick={() => togglePin(note)}
                                    className={`p-1.5 rounded-md ${note.is_pinned ? 'bg-black/10 text-black' : 'hover:bg-black/5 text-gray-500'}`}
                                >
                                    <Pin size={14} className={note.is_pinned ? 'fill-current' : ''} />
                                </button>
                                <button
                                    onClick={() => deleteNote(note.id)}
                                    className="p-1.5 hover:bg-red-500/10 hover:text-red-600 rounded-md text-gray-500"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            {note.is_pinned && (
                                <div className="absolute -top-2 -left-2">
                                    <span className="bg-white shadow-sm border p-1 rounded-full block">
                                        <Pin size={10} className="fill-current text-gray-900" />
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
