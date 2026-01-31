'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, Trash2, Save, X, Edit2, Check, AlertCircle } from 'lucide-react';

type ChecklistCategory = 'design' | 'dispatch';

export default function ProductionSettings() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [loading, setLoading] = useState(true);
    const [checklists, setChecklists] = useState<any[]>([]);

    // Category State (Design vs Dispatch)
    const [activeCategory, setActiveCategory] = useState<ChecklistCategory>('design');

    // New Checklist State
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newJobType, setNewJobType] = useState('');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editItems, setEditItems] = useState<string[]>([]);

    // Define fetchChecklists with useCallback to avoid dependency warnings
    const fetchChecklists = useCallback(async () => {
        setLoading(true);
        // Fetch ALL checklists, then we filter in UI or Fetch by category.
        // Better to fetch by category to avoid over-fetching if list grows.
        const { data, error } = await supabase
            .from('job_checklists')
            .select('*')
            .eq('category', activeCategory)
            .order('job_type');

        if (error) {
            console.error('Error fetching checklists:', error);
        }

        if (data) {
            const parsed = data.map(d => ({
                ...d,
                items: typeof d.items === 'string' ? JSON.parse(d.items) : d.items
            }));
            setChecklists(parsed);
        }
        setLoading(false);
    }, [activeCategory, supabase]); // Add dependencies

    useEffect(() => {
        fetchChecklists();
    }, [fetchChecklists]);


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
            .update({ items: cleanItems })
            .eq('id', editingId);

        if (error) {
            alert('Error updating checklist: ' + error.message);
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

        // Normalize text (Title Case or Uppercase preferred for consistency)
        // Let's use simple Trim for now, maybe Title Case formatted
        const formattedType = newJobType.trim();

        const defaultItems = activeCategory === 'design'
            ? ['Bleed Check', 'Colors (CMYK)', 'Dimensions']
            : ['Print Quality', 'Quantity Check', 'Packaging'];

        const { error } = await supabase.from('job_checklists').insert({
            job_type: formattedType,
            category: activeCategory, // Explicitly set category!
            items: defaultItems
        } as any);

        if (error) {
            alert('Error creating checklist. Ensure this Job Type doesn\'t already exist for this category.\n\nDetails: ' + error.message);
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
        else alert('Error deleting: ' + error.message);
    }

    return (
        <div className="p-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-section text-gray-900">Production Checklists</h2>
                        <p className="text-gray-500 text-sm mt-1">Configure standard quality checks for different job types.</p>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveCategory('design')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeCategory === 'design'
                                ? 'bg-white text-oms-blue shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Pre-Print (Design)
                        </button>
                        <button
                            onClick={() => setActiveCategory('dispatch')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeCategory === 'dispatch'
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                QC & Dispatch
                            </span>
                        </button>
                    </div>

                    <button
                        onClick={() => setIsAddingNew(true)}
                        className={`text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeCategory === 'design' ? 'bg-oms-blue hover:bg-oms-blue' : 'bg-orange-600 hover:bg-orange-700'
                            }`}
                    >
                        <Plus size={18} /> Add {activeCategory === 'design' ? 'Design' : 'QC'} Checklist
                    </button>
                </div>

                {isAddingNew && (
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 animate-in fade-in slide-in-from-top-2">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Plus size={18} className={activeCategory === 'design' ? 'text-oms-blue' : 'text-orange-600'} />
                            Add New {activeCategory === 'design' ? 'Pre-Print' : 'Dispatch QC'} Logic
                        </h3>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="e.g. Wedding Card, Acrylic Board..."
                                    value={newJobType}
                                    onChange={e => setNewJobType(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-oms-blue/20 focus:border-indigo-500"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500 mt-2 ml-1">
                                    Enter the generic Job Type name. You will define the checklist items next.
                                </p>
                            </div>
                            <div className="flex gap-2 items-start">
                                <button
                                    onClick={createNewChecklist}
                                    disabled={!newJobType.trim()}
                                    className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => setIsAddingNew(false)}
                                    className="text-gray-500 hover:text-gray-700 px-4 py-2.5 font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                        <div className="w-8 h-8 border-4 border-[rgba(0,0,255,0.2)] border-t-indigo-600 rounded-full animate-spin"></div>
                        <p>Loading configurations...</p>
                    </div>
                ) : checklists.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Checklists Found</h3>
                        <p className="text-gray-500">No checklist templates defined for {activeCategory} yet.</p>
                        <button
                            onClick={() => setIsAddingNew(true)}
                            className="mt-4 text-oms-blue font-bold hover:underline"
                        >
                            Create your first one
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {checklists.map(checklist => (
                            <div key={checklist.id} className={`bg-white rounded-xl border transition-all ${editingId === checklist.id ? 'border-indigo-500 ring-4 ring-oms-blue/10 shadow-lg relative z-10' : 'border-gray-200 hover:shadow-md hover:border-[rgba(0,0,255,0.2)]'}`}>

                                {/* Header */}
                                <div className={`p-4 border-b flex justify-between items-center rounded-t-xl ${editingId === checklist.id ? 'bg-[rgba(0,0,255,0.05)]/50' : 'bg-gray-50/50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${activeCategory === 'design' ? 'bg-[rgba(0,0,255,0.1)] text-oms-blue' : 'bg-orange-100 text-orange-600'}`}>
                                            <Check size={16} strokeWidth={3} />
                                        </div>
                                        <h3 className="font-bold text-gray-800">{checklist.job_type}</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        {editingId === checklist.id ? (
                                            <>
                                                <button onClick={handleSaveEdit} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-sm" title="Save Changes"><Save size={18} /></button>
                                                <button onClick={() => setEditingId(null)} className="p-2 bg-white border text-gray-600 rounded-lg hover:bg-gray-50" title="Cancel Edit"><X size={18} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleStartEdit(checklist)} className="p-2 bg-white border hover:bg-[rgba(0,0,255,0.05)] text-gray-600 hover:text-oms-blue rounded-lg transition-colors" title="Edit Items"><Edit2 size={16} /></button>
                                                <button onClick={() => deleteChecklist(checklist.id)} className="p-2 bg-white border hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors" title="Delete Checklist"><Trash2 size={16} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="p-5">
                                    {editingId === checklist.id ? (
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Checklist Items</p>
                                            {editItems.map((item, idx) => (
                                                <div key={idx} className="flex gap-2">
                                                    <div className="flex-1 relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">{idx + 1}.</span>
                                                        <input
                                                            type="text"
                                                            value={item}
                                                            onChange={e => updateEditItem(idx, e.target.value)}
                                                            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-oms-blue/20 focus:border-indigo-500"
                                                            autoFocus={idx === editItems.length - 1} // Auto focus new item
                                                            placeholder="e.g. Check spelling..."
                                                        />
                                                    </div>
                                                    <button onClick={() => removeEditItem(idx)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg"><X size={16} /></button>
                                                </div>
                                            ))}
                                            <button onClick={addItemToEdit} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm font-bold text-gray-500 hover:border-indigo-300 hover:text-oms-blue hover:bg-[rgba(0,0,255,0.05)] flex items-center justify-center gap-2 transition-all mt-4">
                                                <Plus size={16} /> Add Another Item
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{checklist.items?.length || 0} Checks defined</p>
                                            <ul className="space-y-2.5">
                                                {checklist.items && checklist.items.length > 0 ? checklist.items.map((item: string, idx: number) => (
                                                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-600 group">
                                                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 group-hover:scale-125 transition-transform ${activeCategory === 'design' ? 'bg-[rgba(0,0,255,0.1)]' : 'bg-orange-400'}`}></div>
                                                        <span className="leading-tight">{item}</span>
                                                    </li>
                                                )) : (
                                                    <li className="text-sm text-gray-400 italic flex items-center gap-2">
                                                        <AlertCircle size={14} />
                                                        No checklist items configured.
                                                    </li>
                                                )}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
