'use client';

import { useState, useEffect } from 'react';
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Save, X, Edit2, Check, AlertCircle, RefreshCcw } from 'lucide-react';

export default function ProductionSettings() {
    // const supabase = createClientComponentClient(); 
    // Use global client instead
    const [loading, setLoading] = useState(true);
    const [checklists, setChecklists] = useState<any[]>([]);

    // New Checklist State
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newJobType, setNewJobType] = useState('');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editItems, setEditItems] = useState<string[]>([]);

    useEffect(() => {
        fetchChecklists();
    }, []);

    const fetchChecklists = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('job_checklists')
            .select('*')
            .order('job_type');

        if (data) {
            // Parse JSON items if string
            const parsed = data.map(d => ({
                ...d,
                items: typeof d.items === 'string' ? JSON.parse(d.items) : d.items
            }));
            setChecklists(parsed);
        }
        setLoading(false);
    };

    const handleStartEdit = (checklist: any) => {
        setEditingId(checklist.id);
        setEditItems([...checklist.items]);
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;

        // Filter empty
        const cleanItems = editItems.filter(i => i.trim().length > 0);

        const { error } = await supabase
            .from('job_checklists')
            .update({ items: cleanItems }) // DB will handle it as jsonb
            .eq('id', editingId);

        if (error) {
            alert('Error updating checklist' + error.message);
        } else {
            setEditingId(null);
            fetchChecklists();
        }
    };

    const addItemToEdit = () => {
        setEditItems([...editItems, '']);
    };

    const updateEditItem = (index: number, val: string) => {
        const copy = [...editItems];
        copy[index] = val;
        setEditItems(copy);
    };

    const removeEditItem = (index: number) => {
        const copy = [...editItems];
        copy.splice(index, 1);
        setEditItems(copy);
    };

    const createNewChecklist = async () => {
        if (!newJobType.trim()) return;

        const { error } = await supabase.from('job_checklists').insert({
            job_type: newJobType,
            items: ['Bleed', 'Colors'] // default
        } as any);

        if (error) {
            alert('Error creating: ' + error.message);
        } else {
            setIsAddingNew(false);
            setNewJobType('');
            fetchChecklists();
        }
    };

    const deleteChecklist = async (id: string) => {
        if (!confirm('Are you sure? This will remove the checklist for this Job Type.')) return;

        const { error } = await supabase.from('job_checklists').delete().eq('id', id);
        if (!error) fetchChecklists();
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pre-Print Checklists</h1>
                    <p className="text-gray-500">Configure mandatory checks for different job types (Box, Label, etc.)</p>
                </div>
                <button
                    onClick={() => setIsAddingNew(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={18} /> Add Job Type
                </button>
            </div>

            {isAddingNew && (
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-lg animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4">Add New Job Type Logic</h3>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="e.g. Visiting Card"
                            value={newJobType}
                            onChange={e => setNewJobType(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                        />
                        <button onClick={createNewChecklist} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Create</button>
                        <button onClick={() => setIsAddingNew(false)} className="text-gray-500 hover:text-gray-700 px-4">Cancel</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400">Loading configurations...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {checklists.map(checklist => (
                        <div key={checklist.id} className={`bg-white rounded-2xl border transition-all ${editingId === checklist.id ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg scale-[1.02]' : 'border-gray-200 hover:shadow-md'}`}>

                            {/* Header */}
                            <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center rounded-t-2xl">
                                <h3 className="font-bold text-lg text-gray-800">{checklist.job_type}</h3>
                                <div className="flex gap-2">
                                    {editingId === checklist.id ? (
                                        <>
                                            <button onClick={handleSaveEdit} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Check size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><X size={18} /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleStartEdit(checklist)} className="p-2 bg-white border hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg"><Edit2 size={16} /></button>
                                            <button onClick={() => deleteChecklist(checklist.id)} className="p-2 bg-white border hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            <div className="p-5 space-y-3">
                                {editingId === checklist.id ? (
                                    <div className="space-y-3">
                                        {editItems.map((item, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={item}
                                                    onChange={e => updateEditItem(idx, e.target.value)}
                                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-500/20 scroll-m-2"
                                                    autoFocus={idx === editItems.length - 1} // Auto focus new item
                                                />
                                                <button onClick={() => removeEditItem(idx)} className="text-red-400 hover:text-red-600 p-2"><X size={16} /></button>
                                            </div>
                                        ))}
                                        <button onClick={addItemToEdit} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm font-bold text-gray-400 hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors">
                                            <Plus size={16} /> Add Inspection Item
                                        </button>
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {checklist.items && checklist.items.length > 0 ? checklist.items.map((item: string, idx: number) => (
                                            <li key={idx} className="flex items-center gap-3 text-sm text-gray-600">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                {item}
                                            </li>
                                        )) : (
                                            <li className="text-sm text-gray-400 italic">No checklist items configured.</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
