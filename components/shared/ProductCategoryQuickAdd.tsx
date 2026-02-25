'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { X, Loader2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProductCategories } from '@/lib/hooks';

interface ProductCategoryQuickAddProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (categoryId: string, categoryName: string) => void;
}

export default function ProductCategoryQuickAdd({ isOpen, onClose, onSuccess }: ProductCategoryQuickAddProps) {
    const [saving, setSaving] = useState(false);
    const { categories: existingCategories } = useProductCategories();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        checklist_type: ''
    });

    if (!isOpen) return null;

    const checklistTypes = existingCategories.map((c: any) => c.name);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name) {
            toast.error('Category name is required');
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

            toast.success('Product category added successfully!');
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
            toast.error(String('❌ Failed to add category: ' + error.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-lg w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-muted/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                            <Tag size={24} className="text-foreground" />
                        </div>
                        <div>
                            <h3 className="text-page-title text-gray-900">Add Product Category</h3>
                            <p className="text-sm text-gray-600">Create new category for jobs</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-gray-200 rounded-md transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Category Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 ring-ring/20 focus:border-gray-400"
                            placeholder="e.g. Visiting Card, Flyer, Packaging"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            rows={2}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 ring-ring/20 focus:border-gray-400"
                            placeholder="Brief description of this category..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Production Checklist Type</label>
                        <select
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 ring-ring/20 focus:border-gray-400"
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
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-8 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 flex items-center gap-2"
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
