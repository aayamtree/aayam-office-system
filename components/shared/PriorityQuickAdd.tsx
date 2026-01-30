'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PriorityQuickAddProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function PriorityQuickAdd({ isOpen, onClose, onSuccess }: PriorityQuickAddProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        color: 'bg-blue-100 text-blue-600'
    });

    if (!isOpen) return null;

    const colorOptions = [
        { value: 'bg-gray-100 text-gray-600', label: 'Gray', preview: 'bg-gray-100' },
        { value: 'bg-blue-100 text-blue-600', label: 'Blue', preview: 'bg-blue-100' },
        { value: 'bg-green-100 text-green-600', label: 'Green', preview: 'bg-green-100' },
        { value: 'bg-yellow-100 text-yellow-600', label: 'Yellow', preview: 'bg-yellow-100' },
        { value: 'bg-orange-100 text-orange-600', label: 'Orange', preview: 'bg-orange-100' },
        { value: 'bg-red-100 text-red-600', label: 'Red', preview: 'bg-red-100' },
        { value: 'bg-purple-100 text-purple-600', label: 'Purple', preview: 'bg-purple-100' },
        { value: 'bg-pink-100 text-pink-600', label: 'Pink', preview: 'bg-pink-100' },
        { value: 'bg-indigo-100 text-indigo-600', label: 'Indigo', preview: 'bg-indigo-100' },
        { value: 'bg-teal-100 text-teal-600', label: 'Teal', preview: 'bg-teal-100' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.id.trim() || !formData.name.trim()) {
            alert('ID and Name are required');
            return;
        }

        setSaving(true);
        try {
            // Get max order_index
            const { data: priorities } = await supabase
                .from('priorities')
                .select('order_index')
                .order('order_index', { ascending: false })
                .limit(1);

            const nextOrder = priorities && priorities.length > 0
                ? priorities[0].order_index + 1
                : 1;

            const { error } = await supabase
                .from('priorities')
                .insert([{
                    id: formData.id.trim().toLowerCase(),
                    name: formData.name.trim(),
                    color: formData.color,
                    order_index: nextOrder,
                    is_active: true
                }]);

            if (error) throw error;

            alert('✅ Priority added successfully!');
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({ id: '', name: '', color: 'bg-blue-100 text-blue-600' });
        } catch (error: any) {
            console.error('Error adding priority:', error);
            alert('❌ Failed to add priority: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-yellow-50 to-amber-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <AlertCircle size={24} className="text-yellow-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Add Priority Level</h3>
                            <p className="text-sm text-gray-600">Create new priority level</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Priority ID *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-yellow-500/20 focus:border-yellow-500 lowercase"
                            placeholder="e.g., critical, medium"
                            value={formData.id}
                            onChange={e => setFormData({ ...formData, id: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Lowercase alphanumeric only (used in database)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Priority Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-yellow-500/20 focus:border-yellow-500"
                            placeholder="e.g., Critical, Medium"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Badge Color *</label>
                        <div className="grid grid-cols-5 gap-2">
                            {colorOptions.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color: option.value })}
                                    className={`h-10 rounded-lg border-2 transition-all ${formData.color === option.value
                                            ? 'border-yellow-500 scale-105'
                                            : 'border-gray-200 hover:border-yellow-300'
                                        } ${option.preview}`}
                                    title={option.label}
                                />
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Preview: <span className={`px-2 py-0.5 rounded-full text-xs ${formData.color}`}>
                                {formData.name || 'Priority'}
                            </span>
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
                            className="px-8 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={18} />
                                    Add Priority
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
