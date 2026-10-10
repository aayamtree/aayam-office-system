'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { Plus, Trash2, GripVertical, Loader2, Tag } from 'lucide-react';

interface ProductCategory {
    id: string;
    name: string;
    is_active: boolean;
    type?: string | null;
    print_family?: string | null;
}

export default function ProductCategoriesManager() {
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const confirm = useConfirm();

    const fetchCategories = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('product_categories')
            .select('*')
            .order('name', { ascending: true });
        if (data) setCategories(data);
        setLoading(false);
    };

    useEffect(() => { fetchCategories(); }, []);

    const handleAdd = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
            toast.error('Category already exists');
            return;
        }
        setAdding(true);
        const { error } = await supabase
            .from('product_categories')
            .insert({ name: trimmed, is_active: true });
        if (error) toast.error(error.message);
        else {
            toast.success(`"${trimmed}" added!`);
            setNewName('');
            fetchCategories();
        }
        setAdding(false);
    };

    const handleDelete = async (cat: ProductCategory) => {
        const { confirmed } = await confirm({
            title: 'Delete Category',
            message: `Delete "${cat.name}"? Existing jobs/bills using this category won't be affected.`,
            variant: 'danger',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;
        setSaving(true);
        const { error } = await supabase.from('product_categories').delete().eq('id', cat.id);
        if (error) toast.error(error.message);
        else { toast.success(`"${cat.name}" deleted`); fetchCategories(); }
        setSaving(false);
    };

    // Print family: product types with the same family may share one printing
    // sheet in the Print Planner. Empty = its own family.
    const saveFamily = async (cat: ProductCategory, value: string) => {
        const next = value.trim() || null;
        if ((cat.print_family || null) === next) return;
        const { error } = await supabase.from('product_categories').update({ print_family: next }).eq('id', cat.id);
        if (error) { toast.error('Could not save print family: ' + error.message); return; }
        setCategories(prev => prev.map(c => (c.id === cat.id ? { ...c, print_family: next } : c)));
        toast.success(next ? `${cat.name} → ${next}` : `${cat.name} now has no family (prints alone)`);
    };
    const familyNames = Array.from(new Set(categories.map(c => (c.print_family || '').trim()).filter(Boolean))).sort();

    const handleToggle = async (cat: ProductCategory) => {
        const { error } = await supabase
            .from('product_categories')
            .update({ is_active: !cat.is_active })
            .eq('id', cat.id);
        if (!error) fetchCategories();
    };

    if (loading) return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    );

    return (
        <div className="space-y-4 max-w-xl">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Product Categories
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Manage categories used in Jobs, Purchase Bills, and Quotations (e.g. Banner, Brochure, Poster).
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    <b>Print family</b> decides which product types may share one printing sheet in the Print Planner
                    (e.g. Letterhead + Pamphlet). Pick an existing family or type a new name. Leave empty to print alone.
                </p>
                <datalist id="print-family-list">
                    {familyNames.map(f => <option key={f} value={f} />)}
                </datalist>
            </div>

            {/* Add new category */}
            <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-gray-700">New category name</label>
                    <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="e.g. Banner, Poster, T-Shirt..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                </div>
                <button
                    onClick={handleAdd}
                    disabled={adding || !newName.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                </button>
            </div>

            {/* Category list */}
            <div className="border border-gray-200 rounded-md overflow-hidden divide-y divide-gray-100">
                {categories.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        No categories yet. Add one above.
                    </div>
                )}
                {categories.map(cat => (
                    <div key={cat.id} className={`flex items-center gap-3 px-3 py-2.5 ${!cat.is_active ? 'opacity-50 bg-gray-50' : 'bg-white'}`}>
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                        {!cat.is_active && (
                            <span className="text-xs text-gray-400 italic">(hidden)</span>
                        )}
                        <div className="flex-1" />
                        {cat.type !== 'service' && (
                            <input
                                key={`${cat.id}-${cat.print_family || ''}`}
                                list="print-family-list"
                                defaultValue={cat.print_family || ''}
                                placeholder="Print family"
                                title="Print family — types with the same family can share one sheet"
                                onBlur={e => saveFamily(cat, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                className="w-36 border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                            />
                        )}
                        <button
                            onClick={() => handleToggle(cat)}
                            className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${cat.is_active
                                ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                                }`}
                        >
                            {cat.is_active ? 'Hide' : 'Show'}
                        </button>
                        <button
                            onClick={() => handleDelete(cat)}
                            disabled={saving}
                            className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                            title={`Delete ${cat.name}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            <p className="text-xs text-muted-foreground">
                💡 Hidden categories won&apos;t appear in dropdowns, but existing records are kept.
            </p>
        </div>
    );
}
