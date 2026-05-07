'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { createBrowserClient } from '@supabase/ssr';
import {
    Plus, Trash2, Save, X, Edit2, Check, AlertCircle,
    ChevronDown, ToggleLeft, Type, Hash, AlignLeft, List
} from 'lucide-react';
import { useConfirm } from '@/components/ConfirmModal';

type ChecklistCategory = 'design' | 'dispatch';

// ── Item types ──────────────────────────────────────────────────────────────
export type ChecklistItemType = 'checkbox' | 'short_text' | 'number' | 'long_text' | 'dropdown';

export interface ChecklistItem {
    label: string;
    type: ChecklistItemType;
    placeholder?: string;
    required?: boolean;
    options?: string[]; // for dropdown
}

const ITEM_TYPES: { id: ChecklistItemType; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'checkbox', label: 'Checkbox', icon: <ToggleLeft size={14} />, desc: 'Simple tick / done' },
    { id: 'short_text', label: 'Short Text', icon: <Type size={14} />, desc: 'One-line text answer' },
    { id: 'number', label: 'Number', icon: <Hash size={14} />, desc: 'Numeric value (mm, dpi…)' },
    { id: 'long_text', label: 'Long Text', icon: <AlignLeft size={14} />, desc: 'Multi-line notes' },
    { id: 'dropdown', label: 'Dropdown', icon: <List size={14} />, desc: 'Select from options' },
];

// Normalise legacy string[] → ChecklistItem[]
function normalizeItems(raw: any[]): ChecklistItem[] {
    return raw.map(i =>
        typeof i === 'string'
            ? { label: i, type: 'checkbox' as ChecklistItemType, required: false }
            : i
    );
}

const blankItem = (): ChecklistItem => ({ label: '', type: 'checkbox', required: false, placeholder: '', options: [] });

export default function ProductionSettings() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [loading, setLoading] = useState(true);
    const [checklists, setChecklists] = useState<any[]>([]);
    const confirm = useConfirm();

    const [activeCategory, setActiveCategory] = useState<ChecklistCategory>('design');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newJobType, setNewJobType] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editItems, setEditItems] = useState<ChecklistItem[]>([]);
    const [expandedType, setExpandedType] = useState<number | null>(null); // which item's type picker is open

    const fetchChecklists = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('job_checklists')
            .select('*')
            .eq('category', activeCategory)
            .order('job_type');
        if (error) console.error('Error fetching checklists:', error);
        if (data) {
            const parsed = data.map(d => ({
                ...d,
                items: normalizeItems(typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []))
            }));
            setChecklists(parsed);
        }
        setLoading(false);
    }, [activeCategory, supabase]);

    useEffect(() => { fetchChecklists(); }, [fetchChecklists]);

    // ── Editing helpers ──
    const handleStartEdit = (checklist: any) => {
        setEditingId(checklist.id);
        setEditItems(normalizeItems(checklist.items || []));
        setExpandedType(null);
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        const cleanItems = editItems
            .filter(i => i.label.trim())
            .map(i => ({ ...i, options: i.options?.filter(o => o.trim()) }));
        const { error } = await supabase
            .from('job_checklists')
            .update({ items: cleanItems })
            .eq('id', editingId);
        if (error) {
            toast.error('Error updating checklist: ' + error.message);
        } else {
            setEditingId(null);
            fetchChecklists();
            toast.success('Checklist saved!');
        }
    };

    const addItem = () => {
        setEditItems(prev => [...prev, blankItem()]);
        setExpandedType(editItems.length); // open type picker for new item
    };

    const updateItem = (idx: number, patch: Partial<ChecklistItem>) => {
        setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
    };

    const removeItem = (idx: number) => {
        setEditItems(prev => prev.filter((_, i) => i !== idx));
        setExpandedType(null);
    };

    const updateOption = (itemIdx: number, optIdx: number, val: string) => {
        setEditItems(prev => prev.map((it, i) => {
            if (i !== itemIdx) return it;
            const opts = [...(it.options || [])];
            opts[optIdx] = val;
            return { ...it, options: opts };
        }));
    };

    const addOption = (itemIdx: number) => {
        setEditItems(prev => prev.map((it, i) =>
            i === itemIdx ? { ...it, options: [...(it.options || []), ''] } : it
        ));
    };

    const removeOption = (itemIdx: number, optIdx: number) => {
        setEditItems(prev => prev.map((it, i) =>
            i === itemIdx ? { ...it, options: (it.options || []).filter((_, oi) => oi !== optIdx) } : it
        ));
    };

    // ── Create new checklist ──
    const createNewChecklist = async () => {
        if (!newJobType.trim()) return;
        const defaultItems: ChecklistItem[] = activeCategory === 'design'
            ? [
                { label: 'Bleed Check', type: 'checkbox', required: true },
                { label: 'Colors (CMYK)', type: 'checkbox', required: true },
                { label: 'Dimensions Check', type: 'short_text', placeholder: 'e.g. 150mm × 220mm', required: true },
            ]
            : [
                { label: 'Print Quality', type: 'checkbox', required: true },
                { label: 'Quantity Check', type: 'number', placeholder: 'e.g. 500', required: true },
                { label: 'Packaging', type: 'checkbox', required: false },
            ];

        const { error } = await supabase.from('job_checklists').insert({
            job_type: newJobType.trim(),
            category: activeCategory,
            items: defaultItems
        } as any);

        if (error) {
            toast.error('Error creating checklist: ' + error.message);
        } else {
            setIsAddingNew(false);
            setNewJobType('');
            fetchChecklists();
        }
    };

    const deleteChecklist = async (id: string) => {
        const { confirmed } = await confirm({ title: 'Delete Checklist', message: 'This will remove the checklist for this Job Type.', variant: 'danger', confirmLabel: 'Delete' });
        if (!confirmed) return;
        const { error } = await supabase.from('job_checklists').delete().eq('id', id);
        if (!error) fetchChecklists();
        else toast.error('Error deleting: ' + error.message);
    };

    // ── Type icon/label lookup ──
    const typeInfo = (type: ChecklistItemType) => ITEM_TYPES.find(t => t.id === type) || ITEM_TYPES[0];

    return (
        <div className="p-1 space-y-6">
            <div className="bg-white p-4 rounded-md border border-gray-100">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 mb-4">
                    <div>
                        <h2 className="text-section text-gray-900">Production Checklists</h2>
                        <p className="text-gray-500 text-sm mt-1">Configure quality checks per job type. Each item can be a checkbox, text input, number, or dropdown.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                            <button onClick={() => setActiveCategory('design')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeCategory === 'design' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
                                Pre-Print (Design)
                            </button>
                            <button onClick={() => setActiveCategory('dispatch')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeCategory === 'dispatch' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>
                                QC &amp; Dispatch
                            </button>
                        </div>
                        <button onClick={() => setIsAddingNew(true)}
                            className={`text-white px-4 py-2 rounded-md font-bold flex items-center gap-2 ${activeCategory === 'design' ? 'bg-gray-900 hover:bg-gray-800' : 'bg-orange-600 hover:bg-orange-700'}`}>
                            <Plus size={16} /> Add Checklist
                        </button>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {ITEM_TYPES.map(t => (
                        <span key={t.id} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
                            {t.icon} {t.label}
                        </span>
                    ))}
                    <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-md font-medium">* = Required</span>
                </div>

                {/* Create new */}
                {isAddingNew && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mb-4">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Plus size={16} className="text-primary" /> New {activeCategory === 'design' ? 'Pre-Print' : 'Dispatch QC'} Checklist
                        </h3>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Job type name (e.g. Pouch, Wedding Card…)"
                                value={newJobType} onChange={e => setNewJobType(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-400/20"
                                autoFocus />
                            <button onClick={createNewChecklist} disabled={!newJobType.trim()}
                                className="bg-gray-900 text-white px-4 py-2.5 rounded-md font-bold hover:bg-gray-800 disabled:opacity-50 text-sm">Create</button>
                            <button onClick={() => setIsAddingNew(false)} className="text-gray-500 px-4 py-2.5 text-sm">Cancel</button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
                        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
                    </div>
                ) : checklists.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-md border border-dashed border-gray-300">
                        <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Checklists Found</h3>
                        <button onClick={() => setIsAddingNew(true)} className="mt-4 text-primary font-bold hover:underline">Create your first one</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {checklists.map(checklist => (
                            <div key={checklist.id}
                                className={`bg-white rounded-md border transition-all ${editingId === checklist.id ? 'border-primary ring-4 ring-primary/10 z-10 relative md:col-span-2 lg:col-span-3' : 'border-gray-200'}`}>

                                {/* Card header */}
                                <div className={`px-4 py-3 border-b flex justify-between items-center rounded-t-md ${editingId === checklist.id ? 'bg-muted/40' : 'bg-gray-50'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-md ${activeCategory === 'design' ? 'bg-gray-900 text-white' : 'bg-orange-100 text-orange-600'}`}>
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                        <h3 className="font-bold text-gray-800">{checklist.job_type}</h3>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {editingId === checklist.id ? (
                                            <>
                                                <button onClick={handleSaveEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-bold hover:bg-gray-800">
                                                    <Save size={13} /> Save
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="p-1.5 border rounded-md text-gray-500 hover:bg-gray-50"><X size={14} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleStartEdit(checklist)} className="p-1.5 border hover:bg-muted rounded-md text-gray-500"><Edit2 size={14} /></button>
                                                <button onClick={() => deleteChecklist(checklist.id)} className="p-1.5 border hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md"><Trash2 size={14} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Card body */}
                                <div className="p-4">
                                    {editingId === checklist.id ? (
                                        /* ── EDIT MODE ── */
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Checklist Items</p>
                                            {editItems.map((item, idx) => (
                                                <div key={idx} className="border border-gray-200 rounded-md overflow-hidden">
                                                    {/* Item header row */}
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-xs font-mono text-gray-400 w-5">{idx + 1}.</span>

                                                        {/* Label */}
                                                        <input
                                                            type="text"
                                                            value={item.label}
                                                            onChange={e => updateItem(idx, { label: e.target.value })}
                                                            placeholder="Item label…"
                                                            className="flex-1 text-sm border-0 bg-transparent outline-none font-medium text-gray-800 placeholder-gray-400"
                                                        />

                                                        {/* Type picker toggle */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedType(expandedType === idx ? null : idx)}
                                                            className="flex items-center gap-1 text-xs px-2 py-1 bg-white border border-gray-200 rounded-md hover:border-gray-400 text-gray-600 transition-all whitespace-nowrap"
                                                        >
                                                            {typeInfo(item.type).icon}
                                                            <span className="hidden sm:inline">{typeInfo(item.type).label}</span>
                                                            <ChevronDown size={11} />
                                                        </button>

                                                        {/* Required toggle */}
                                                        <button
                                                            type="button"
                                                            onClick={() => updateItem(idx, { required: !item.required })}
                                                            title={item.required ? 'Required — click to make optional' : 'Optional — click to make required'}
                                                            className={`text-xs px-2 py-1 rounded-md font-bold border transition-all ${item.required ? 'bg-red-50 text-red-600 border-red-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-red-200'}`}
                                                        >
                                                            {item.required ? '* Req' : 'Opt'}
                                                        </button>

                                                        <button onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
                                                    </div>

                                                    {/* Type selector dropdown */}
                                                    {expandedType === idx && (
                                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-2 bg-white border-b border-gray-100">
                                                            {ITEM_TYPES.map(t => (
                                                                <button key={t.id} type="button"
                                                                    onClick={() => { updateItem(idx, { type: t.id }); setExpandedType(null); }}
                                                                    className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-all ${item.type === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                                                                    {t.icon}
                                                                    <span className="font-medium">{t.label}</span>
                                                                    <span className={`text-[10px] leading-tight text-center ${item.type === t.id ? 'text-white/80' : 'text-gray-400'}`}>{t.desc}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Extra config for non-checkbox types */}
                                                    {item.type !== 'checkbox' && (
                                                        <div className="px-3 py-2 space-y-2">
                                                            {(item.type === 'short_text' || item.type === 'number' || item.type === 'long_text') && (
                                                                <input
                                                                    type="text"
                                                                    value={item.placeholder || ''}
                                                                    onChange={e => updateItem(idx, { placeholder: e.target.value })}
                                                                    placeholder="Hint / placeholder shown to designer (optional)"
                                                                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 placeholder-gray-400"
                                                                />
                                                            )}
                                                            {item.type === 'dropdown' && (
                                                                <div className="space-y-1">
                                                                    <p className="text-xs text-gray-500 font-medium">Dropdown options:</p>
                                                                    {(item.options || []).map((opt, oi) => (
                                                                        <div key={oi} className="flex gap-1">
                                                                            <input type="text" value={opt}
                                                                                onChange={e => updateOption(idx, oi, e.target.value)}
                                                                                placeholder={`Option ${oi + 1}`}
                                                                                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700"
                                                                            />
                                                                            <button onClick={() => removeOption(idx, oi)} className="p-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                                                                        </div>
                                                                    ))}
                                                                    <button onClick={() => addOption(idx)} className="text-xs text-primary hover:underline flex items-center gap-1">
                                                                        <Plus size={11} /> Add option
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            <button onClick={addItem}
                                                className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-md text-sm font-bold text-gray-500 hover:border-primary/30 hover:text-primary hover:bg-muted flex items-center justify-center gap-2 transition-all">
                                                <Plus size={16} /> Add Item
                                            </button>
                                        </div>
                                    ) : (
                                        /* ── VIEW MODE ── */
                                        <>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                                {checklist.items?.length || 0} checks defined
                                            </p>
                                            <ul className="space-y-2">
                                                {(checklist.items as ChecklistItem[]).map((item, idx) => {
                                                    const ti = typeInfo(item.type);
                                                    return (
                                                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                                            <span className="text-gray-400 shrink-0">{ti.icon}</span>
                                                            <span className="leading-tight flex-1">{item.label}</span>
                                                            {item.required && <span className="text-[10px] text-red-500 font-bold shrink-0">*</span>}
                                                        </li>
                                                    );
                                                })}
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
