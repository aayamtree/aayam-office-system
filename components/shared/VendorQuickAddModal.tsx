'use client';

import { useState } from 'react';
import { X, Loader2, Building2 } from 'lucide-react';
import { useVendors } from '@/lib/hooks';

interface VendorQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (vendorId: string) => void;
}

export default function VendorQuickAddModal({ isOpen, onClose, onSuccess }: VendorQuickAddModalProps) {
    const { createVendor } = useVendors();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        phone: '',
        email: '',
        category: 'Paper',
        city: '',
        state: 'Gujarat',
        gstin: '',
        payment_terms: 'Net 30'
    });

    if (!isOpen) return null;

    const vendorCategories = ['Paper', 'Printing', 'Binding', 'Packaging', 'Logistics', 'IT', 'Other'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.phone) {
            alert('Name and Phone are required');
            return;
        }

        setSaving(true);
        try {
            const newVendor = await createVendor({
                ...formData,
                payment_terms: 30, // Convert from string to number
                is_active: true
            });

            alert('✅ Vendor added successfully!');
            if (newVendor?.data) {
                onSuccess?.(newVendor.data.id);
            }
            onClose();

            // Reset form
            setFormData({
                name: '',
                company: '',
                phone: '',
                email: '',
                category: 'Paper',
                city: '',
                state: 'Gujarat',
                gstin: '',
                payment_terms: 'Net 30'
            });
        } catch (error: any) {
            console.error('Error adding vendor:', error);
            alert('❌ Failed to add vendor: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Building2 size={24} className="text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Quick Add Vendor</h3>
                            <p className="text-sm text-gray-600">Add a new vendor to the system</p>
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
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                placeholder="Vendor Name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Company</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
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
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                placeholder="+91 98765 43210"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                placeholder="vendor@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Category</label>
                            <select
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                {vendorCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">City</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                placeholder="City"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">State</label>
                            <select
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
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
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                placeholder="22AAAAA0000A1Z5"
                                value={formData.gstin}
                                onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
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
                            className="px-8 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Building2 size={18} />
                                    Add Vendor
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
