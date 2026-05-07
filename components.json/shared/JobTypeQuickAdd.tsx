'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
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
            toast.error('Job type name is required');
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

            toast.success('Job type added successfully!');
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({ name: '', description: '' });
        } catch (error: any) {
            console.error('Error adding job type:', error);
            toast.error(String('❌ Failed to add job type: ' + error.message));
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
                            <Briefcase size={24} className="text-foreground" />
                        </div>
                        <div>
                            <h3 className="text-page-title text-gray-900">Add Job Type</h3>
                            <p className="text-sm text-gray-600">Create new job type</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-gray-200 rounded-md transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Job Type Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 ring-ring/20 focus:border-gray-400"
                            placeholder="e.g., Design Only, Print Only"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            rows={2}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 ring-ring/20 focus:border-gray-400"
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
