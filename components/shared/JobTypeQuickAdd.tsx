'use client';

import { useState } from 'react';
import { X, Loader2, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface JobTypeQuickAddProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function JobTypeQuickAdd({ isOpen, onClose, onSuccess }: JobTypeQuickAddProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('Job type name is required');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('job_types')
                .insert([{
                    name: formData.name.trim(),
                    description: formData.description.trim() || null,
                    is_active: true
                }]);

            if (error) throw error;

            alert('✅ Job type added successfully!');
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({ name: '', description: '' });
        } catch (error: any) {
            console.error('Error adding job type:', error);
            alert('❌ Failed to add job type: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Briefcase size={24} className="text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Add Job Type</h3>
                            <p className="text-sm text-gray-600">Create new job type</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Job Type Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-purple-500/20 focus:border-purple-500"
                            placeholder="e.g., Design Only, Print Only"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            rows={2}
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-purple-500/20 focus:border-purple-500"
                            placeholder="Brief description of this job type..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
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
                            className="px-8 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Briefcase size={18} />
                                    Add Job Type
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
