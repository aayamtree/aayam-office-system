'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Building2, Plus } from 'lucide-react';
import { useVendors } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import VendorCategoryQuickAdd from './VendorCategoryQuickAdd';

interface VendorQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (vendorId: string) => void;
}

export default function VendorQuickAddModal({ isOpen, onClose, onSuccess }: VendorQuickAddModalProps) {
    const { createVendor } = useVendors();
    const [saving, setSaving] = useState(false);
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [vendorCategories, setVendorCategories] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        phone: '',
        email: '',
        category: '',
        city: '',
        state: 'Gujarat',
        gstin: '',
        payment_terms: 'Net 30'
    });

    // Load vendor categories from database
    useEffect(() => {
        const loadCategories = async () => {
            const { data } = await supabase
                .from('vendor_categories')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (data) {
                setVendorCategories(data);
                if (data.length > 0 && !formData.category) {
                    setFormData(prev => ({ ...prev, category: data[0].name }));
                }
            }
        };
        if (isOpen) loadCategories();
    }, [isOpen]);

    if (!isOpen) return null;

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
            <div className="bg-white rounded-2xl  w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[rgba(0,0,255,0.1)] rounded-lg">
                            <Building2 size={24} className="text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-page-title text-gray-900">Quick Add Vendor</h3>
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
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {vendorCategories.map(cat => (
                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setShowAddCategoryModal(true)}
                                    className="px-3 py-2 bg-green-100 text-oms-blue rounded-xl hover:bg-[rgba(0,0,255,0.2)] flex items-center gap-1">
                                    <Plus size={16} /><span className="hidden sm:inline">Add</span>
                                </button>
                            </div>
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
                            <label className="block text-sm font-medium mb-1">State / Province</label>
                            <input
                                list="vendor-states"
                                type="text"
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 ring-green-500/20 focus:border-green-500"
                                placeholder="Select or type state/province"
                                value={formData.state}
                                onChange={e => setFormData({ ...formData, state: e.target.value })}
                            />
                            <datalist id="vendor-states">
                                <option value="Andhra Pradesh" />
                                <option value="Arunachal Pradesh" />
                                <option value="Assam" />
                                <option value="Bihar" />
                                <option value="Chhattisgarh" />
                                <option value="Goa" />
                                <option value="Gujarat" />
                                <option value="Haryana" />
                                <option value="Himachal Pradesh" />
                                <option value="Jharkhand" />
                                <option value="Karnataka" />
                                <option value="Kerala" />
                                <option value="Madhya Pradesh" />
                                <option value="Maharashtra" />
                                <option value="Manipur" />
                                <option value="Meghalaya" />
                                <option value="Mizoram" />
                                <option value="Nagaland" />
                                <option value="Odisha" />
                                <option value="Punjab" />
                                <option value="Rajasthan" />
                                <option value="Sikkim" />
                                <option value="Tamil Nadu" />
                                <option value="Telangana" />
                                <option value="Tripura" />
                                <option value="Uttar Pradesh" />
                                <option value="Uttarakhand" />
                                <option value="West Bengal" />
                                <option value="Delhi" />
                                <option value="Jammu and Kashmir" />
                                <option value="Ladakh" />
                                <option value="Puducherry" />
                                <option value="Chandigarh" />
                            </datalist>
                            <p className="text-xs text-gray-500 mt-1">💡 Select Indian state or type any international state/province</p>
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
                            className="px-8 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium  disabled:opacity-50 flex items-center gap-2"
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

            {/* Vendor Category Quick Add Modal */}
            <VendorCategoryQuickAdd
                isOpen={showAddCategoryModal}
                onClose={() => setShowAddCategoryModal(false)}
                onSuccess={async () => {
                    // Reload categories after adding
                    const { data } = await supabase
                        .from('vendor_categories')
                        .select('*')
                        .eq('is_active', true)
                        .order('name');
                    if (data) setVendorCategories(data);
                    setShowAddCategoryModal(false);
                }}
            />
        </div>
    );
}
