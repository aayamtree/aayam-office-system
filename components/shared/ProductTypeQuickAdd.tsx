'use client';

import { useState } from 'react';
import { X, Loader2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProductTypeQuickAddProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function ProductTypeQuickAdd({ isOpen, onClose, onSuccess }: ProductTypeQuickAddProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('Product type name is required');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('product_types')
                .insert([{
                    name: formData.name.trim().toUpperCase(),  // Force uppercase
                    description: formData.description.trim() || null,
                    is_active: true
                }]);

            if (error) throw error;

            alert('✅ Product type added successfully!');
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({ name: '', description: '' });
        } catch (error: any) {
            console.error('Error adding product type:', error);
            alert('❌ Failed to add product type: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Package size={24} className="text-orange-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Add Product Type</h3>
                            <p className="text-sm text-gray-600">For print planner job batching</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Product Type Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-orange-500/20 focus:border-orange-500 uppercase"
                            placeholder="e.g., STICKER, BANNER"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Will be converted to UPPERCASE automatically</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            rows={2}
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-orange-500/20 focus:border-orange-500"
                            placeholder="Brief description..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="bg-orange-50 rounded-xl p-3">
                        <p className="text-xs text-orange-700">
                            ⚡ <strong>Print Planner:</strong> Jobs with same product type can be batched together in print runs
                        </p>
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
                            className="px-8 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Package size={18} />
                                    Add Product Type
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
