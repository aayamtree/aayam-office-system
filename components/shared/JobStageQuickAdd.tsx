'use client';

import { useState } from 'react';
import { X, Loader2, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface JobStageQuickAddProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function JobStageQuickAdd({ isOpen, onClose, onSuccess }: JobStageQuickAddProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        color: 'bg-blue-500',
        bgLight: 'bg-blue-50',
        border: 'border-blue-200'
    });

    if (!isOpen) return null;

    const colorSets = [
        { main: 'bg-gray-500', light: 'bg-gray-50', border: 'border-gray-200', name: 'Gray' },
        { main: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-200', name: 'Blue' },
        { main: 'bg-green-500', light: 'bg-green-50', border: 'border-green-200', name: 'Green' },
        { main: 'bg-yellow-500', light: 'bg-yellow-50', border: 'border-yellow-200', name: 'Yellow' },
        { main: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', name: 'Orange' },
        { main: 'bg-red-500', light: 'bg-red-50', border: 'border-red-200', name: 'Red' },
        { main: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', name: 'Purple' },
        { main: 'bg-pink-500', light: 'bg-pink-50', border: 'border-pink-200', name: 'Pink' },
        { main: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', name: 'Indigo' },
        { main: 'bg-teal-500', light: 'bg-teal-50', border: 'border-teal-200', name: 'Teal' },
        { main: 'bg-cyan-500', light: 'bg-cyan-50', border: 'border-cyan-200', name: 'Cyan' },
        { main: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200', name: 'Emerald' },
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
            const { data: stages } = await supabase
                .from('job_stages')
                .select('order_index')
                .order('order_index', { ascending: false })
                .limit(1);

            const nextOrder = stages && stages.length > 0
                ? stages[0].order_index + 1
                : 1;

            const { error } = await supabase
                .from('job_stages')
                .insert([{
                    id: formData.id.trim().toLowerCase().replace(/\s+/g, '_'),
                    name: formData.name.trim(),
                    color: formData.color,
                    bg_light: formData.bgLight,
                    border: formData.border,
                    order_index: nextOrder,
                    is_active: true
                }]);

            if (error) throw error;

            alert('✅ Job stage added successfully!');
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({
                id: '',
                name: '',
                color: 'bg-blue-500',
                bgLight: 'bg-blue-50',
                border: 'border-blue-200'
            });
        } catch (error: any) {
            console.error('Error adding job stage:', error);
            alert('❌ Failed to add job stage: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-teal-50 to-cyan-50 sticky top-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg">
                            <Layers size={24} className="text-teal-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Add Job Stage</h3>
                            <p className="text-sm text-gray-600">Create new workflow stage</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Stage ID *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-teal-500/20 focus:border-teal-500 lowercase"
                            placeholder="e.g., quality_check, ready"
                            value={formData.id}
                            onChange={e => setFormData({ ...formData, id: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Lowercase, use underscore for spaces</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Stage Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-teal-500/20 focus:border-teal-500"
                            placeholder="e.g., Quality Check, Ready"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Stage Color Theme *</label>
                        <div className="grid grid-cols-4 gap-2">
                            {colorSets.map(colorSet => (
                                <button
                                    key={colorSet.main}
                                    type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        color: colorSet.main,
                                        bgLight: colorSet.light,
                                        border: colorSet.border
                                    })}
                                    className={`h-12 rounded-lg border-2 transition-all ${formData.color === colorSet.main
                                            ? 'border-teal-500 scale-105 shadow-lg'
                                            : 'border-gray-200 hover:border-teal-300'
                                        } ${colorSet.light}`}
                                    title={colorSet.name}
                                >
                                    <div className={`h-4 w-4 mx-auto rounded-full ${colorSet.main}`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={`rounded-xl p-4 border-2 ${formData.border} ${formData.bgLight}`}>
                        <p className="text-xs text-gray-500 mb-2">Preview:</p>
                        <div className="flex items-center justify-between">
                            <span className={`text-xs px-3 py-1 rounded-full text-white ${formData.color}`}>
                                {formData.name || 'Stage Name'}
                            </span>
                            <span className="text-sm text-gray-700">Kanban Card Background</span>
                        </div>
                    </div>

                    <div className="bg-teal-50 rounded-xl p-3">
                        <p className="text-xs text-teal-700">
                            ℹ️ <strong>Note:</strong> New stage will be added at the end of workflow. You can reorder stages later.
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
                            className="px-8 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Layers size={18} />
                                    Add Stage
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
