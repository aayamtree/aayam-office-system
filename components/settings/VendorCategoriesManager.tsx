'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, GripVertical, Loader2, Check, X } from 'lucide-react';

interface VendorCategory {
    id: string;
    name: string;
    color: string;
    sort_order: number;
    is_active: boolean;
}

const COLOR_OPTIONS = [
    { label: 'Gray', value: 'bg-gray-100 text-gray-800' },
    { label: 'Blue', value: 'bg-blue-100 text-blue-800' },
    { label: 'Purple', value: 'bg-purple-100 text-purple-800' },
    { label: 'Green', value: 'bg-green-100 text-green-800' },
    { label: 'Amber', value: 'bg-amber-100 text-amber-800' },
    { label: 'Red', value: 'bg-red-100 text-red-800' },
    { label: 'Pink', value: 'bg-pink-100 text-pink-800' },
    { label: 'Indigo', value: 'bg-indigo-100 text-indigo-800' },
    { label: 'Teal', value: 'bg-teal-100 text-teal-800' },
    { label: 'Orange', value: 'bg-orange-100 text-orange-800' },
];

export default function VendorCategoriesManager() {
    const [categories, setCategories] = useState<VendorCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLOR_OPTIONS[0].value);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchCategories = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('vendor_categories')
            .select('*')
            .order('sort_order', { ascending: true });
        if (data) setCategories(data);
        setLoading(false);
    };

    useEffect(() => { fetchCategories(); }, []);

    const notify = (msg: string, type: 'success' | 'error' = 'success') => {
        if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
        else { setError(msg); setTimeout(() => setError(null), 4000); }
    };

    const handleAdd = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
            notify('Category already exists', 'error');
            return;
        }
        setAdding(true);
        const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0);
        const { error } = await supabase.from('vendor_categories').insert({
            name: trimmed,
            color: newColor,
            sort_order: maxOrder + 1,
        });
        if (error) notify(error.message, 'error');
        else {
            notify(`"${trimmed}" added!`);
            setNewName('');
            setNewColor(COLOR_OPTIONS[0].value);
            fetchCategories();
        }
        setAdding(false);
    };

    const handleDelete = async (cat: VendorCategory) => {
        if (!confirm(`Delete category "${cat.name}"? Existing vendors with this category won't be affected.`)) return;
        setSaving(true);
        const { error } = await supabase.from('vendor_categories').delete().eq('id', cat.id);
        if (error) notify(error.message, 'error');
        else { notify(`"${cat.name}" deleted`); fetchCategories(); }
        setSaving(false);
    };

    const handleToggle = async (cat: VendorCategory) => {
        const { error } = await supabase
            .from('vendor_categories')
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
                <h3 className="text-sm font-semibold text-gray-900">Vendor Categories</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Add, remove, or reorder categories used when adding vendors.
                </p>
            </div>

            {/* Feedback */}
            {success && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <Check className="h-3.5 w-3.5" /> {success}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <X className="h-3.5 w-3.5" /> {error}
                </div>
            )}

            {/* Add new category */}
            <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-gray-700">New category name</label>
                    <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="e.g. Chemicals, Transport..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Colour</label>
                    <select
                        value={newColor}
                        onChange={e => setNewColor(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                        {COLOR_OPTIONS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
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
                    <div key={cat.id} className={`flex items-center gap-3 px-3 py-2.5 ${!cat.is_active ? 'opacity-50' : ''}`}>
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${cat.color}`}>
                            {cat.name}
                        </span>
                        <div className="flex-1" />
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
                💡 Hidden categories won't appear in the vendor form, but existing vendor records are kept.
            </p>
        </div>
    );
}
