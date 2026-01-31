'use client';

import { useState } from 'react';
import { X, User, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Client, ClientInput } from '@/types/database';

interface ClientQuickAddProps {
    onClientCreated?: (client: Client) => void;
    onClose: () => void;
}

export default function ClientQuickAdd({ onClientCreated, onClose }: ClientQuickAddProps) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<ClientInput>({
        name: '',
        company: '',
        phone: '',
        alt_phone: '',
        email: '',
        gstin: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        client_type: 'regular',
        credit_limit: 0,
        is_active: true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate required fields
            if (!formData.name || !formData.phone) {
                throw new Error('Name and phone are required');
            }

            // Create client
            const { data, error: insertError } = await supabase
                .from('clients')
                .insert([{
                    ...formData,
                    outstanding_balance: 0 // Initialize balance
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            // Log activity
            await supabase.from('activity_logs').insert([{
                action: 'created',
                module: 'clients',
                details: { client_id: data.id, client_name: data.name }
            }]);

            // Call callback if provided
            if (onClientCreated) {
                onClientCreated(data);
            }

            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl  overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-page-title flex items-center gap-3">
                            <User size={28} />
                            Quick Add Client
                        </h3>
                        <p className="text-blue-100 text-sm mt-1">Add new client to centralized database</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Client full name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Company
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    className="w-full border-2 border-gray-200 rounded-xl pl-11 pr-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="Company name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full border-2 border-gray-200 rounded-xl pl-11 pr-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Phone <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full border-2 border-gray-200 rounded-xl pl-11 pr-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="9876543210"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Alternate Phone
                            </label>
                            <input
                                type="tel"
                                value={formData.alt_phone}
                                onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value })}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    {/* Business Info */}
                    <div className="pt-4">
                        <h4 className="font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-100">Business Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    GSTIN
                                </label>
                                <input
                                    type="text"
                                    value={formData.gstin}
                                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all uppercase"
                                    placeholder="22AAAAA0000A1Z5"
                                    maxLength={15}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Client Type
                                </label>
                                <select
                                    value={formData.client_type}
                                    onChange={(e) => setFormData({ ...formData, client_type: e.target.value as any })}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                >
                                    <option value="regular">Regular</option>
                                    <option value="premium">Premium</option>
                                    <option value="corporate">Corporate</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="pt-4">
                        <h4 className="font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-100 flex items-center gap-2">
                            <MapPin size={18} />
                            Address
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Street Address
                                </label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                    rows={2}
                                    placeholder="Building, Street, Area"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                        placeholder="Mumbai"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        State
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                        placeholder="Maharashtra"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Pincode
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.pincode}
                                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-blue-500/20 focus:border-blue-500 transition-all"
                                        placeholder="400001"
                                        maxLength={6}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t-2 border-gray-100 flex gap-4 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Adding...' : 'Add Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
