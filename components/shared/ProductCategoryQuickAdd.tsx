'use client';

import { useState } from 'react';
import { X, Loader2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProductCategoryQuickAddProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (categoryId: string, categoryName: string) => void;
}

export default function ProductCategoryQuickAdd({ isOpen, onClose, onSuccess }: ProductCategoryQuickAddProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        checklist_type: ''
    });

    if (!isOpen) return null;

    const checklistTypes = ['Banner', 'Book', 'Box', 'Brochure', 'Label', 'Poster'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name) {
            alert('Category name is required');
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('product_categories')
                .insert([{
                    name: formData.name,
                    description: formData.description || null,
                    checklist_type: formData.checklist_type || null,
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;

            alert('✅ Product category added successfully!');
            onSuccess?.(data.id, data.name);
            onClose();

            // Reset form
            setFormData({
                name: '',
                description: '',
                checklist_type: ''
            });
        } catch (error: any) {
            console.error('Error adding category:', error);
            alert('❌ Failed to add category: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-oms-blue">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[rgba(0,0,255,0.1)] rounded-lg">
                            <Tag size={24} className="text-oms-blue" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Add Product Category</h3>
                            <p className="text-sm text-gray-600">Create new category for jobs</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Category Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-purple-500/20 focus:border-purple-500"
                            placeholder="e.g. Visiting Card, Flyer, Packaging"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            rows={2}
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-purple-500/20 focus:border-purple-500"
                            placeholder="Brief description of this category..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Production Checklist Type</label>
                        <select
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-purple-500/20 focus:border-purple-500"
                            value={formData.checklist_type}
                            onChange={e => setFormData({ ...formData, checklist_type: e.target.value })}
                        >
                            <option value="">No checklist</option>
                            {checklistTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Links to production workflow checklist</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-8 py-2 bg-oms-blue text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Tag size={18} />
                                    Add Category
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
