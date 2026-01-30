'use client';

import { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import { useClients } from '@/lib/hooks';

interface ClientQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (clientId: string) => void;
}

export default function ClientQuickAddModal({ isOpen, onClose, onSuccess }: ClientQuickAddModalProps) {
    const { createClient } = useClients();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        phone: '',
        email: '',
        city: '',
        state: 'Gujarat',
        gstin: '',
        address: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.phone) {
            alert('Name and Phone are required');
            return;
        }

        setSaving(true);
        try {
            const newClient = await createClient({
                ...formData,
                is_active: true,
                client_type: 'regular',
                credit_limit: 0
            });

            alert('✅ Client added successfully!');
            onSuccess?.(newClient.id);
            onClose();

            // Reset form
            setFormData({
                name: '',
                company: '',
                phone: '',
                email: '',
                city: '',
                state: 'Gujarat',
                gstin: '',
                address: ''
            });
        } catch (error: any) {
            console.error('Error adding client:', error);
            alert('❌ Failed to add client: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <UserPlus size={24} className="text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Quick Add Client</h3>
                            <p className="text-sm text-gray-600">Add a new client to the system</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name *</label>
                            <input
                                required
                                type="text"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Full Name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Company</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Company Name"
                                value={formData.company}
                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Phone *</label>
                            <input
                                required
                                type="tel"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="+91 98765 43210"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="email@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">City</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="City"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">State</label>
                            <select
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                value={formData.state}
                                onChange={e => setFormData({ ...formData, state: e.target.value })}
                            >
                                <option value="Gujarat">Gujarat</option>
                                <option value="Maharashtra">Maharashtra</option>
                                <option value="Rajasthan">Rajasthan</option>
                                <option value="Delhi">Delhi</option>
                                <option value="Karnataka">Karnataka</option>
                                <option value="Tamil Nadu">Tamil Nadu</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">GSTIN</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="22AAAAA0000A1Z5"
                                value={formData.gstin}
                                onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Address</label>
                            <textarea
                                rows={2}
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Full Address"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
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
                            className="px-8 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={18} />
                                    Add Client
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
