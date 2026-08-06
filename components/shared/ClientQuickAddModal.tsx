'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { X, Loader2, UserPlus, AlertTriangle } from 'lucide-react';
import { useClients } from '@/lib/hooks';

interface ClientQuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Receives the new client's id, plus the full row when available. */
    onSuccess?: (clientId: string, client?: any) => void;
    /** Prefills company + name, e.g. whatever was typed in ClientSelect's search box. */
    initialName?: string;
}

export default function ClientQuickAddModal({ isOpen, onClose, onSuccess, initialName }: ClientQuickAddModalProps) {
    const { createClient, clients } = useClients();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        phone: '',
        email: '',
        city: '',
        state: 'Gujarat',
        gstin: '',
        address: '',
        brand_name: ''  // e.g. #tiger #cobra
    });

    // ── Close on ESC ──
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // ── Start clean every time it opens, prefilled with the searched text ──
    useEffect(() => {
        if (!isOpen) return;
        const seed = (initialName || '').trim();
        setFormData({
            name: seed, company: seed, phone: '', email: '', city: '',
            state: 'Gujarat', gstin: '', address: '', brand_name: ''
        });
    }, [isOpen, initialName]);

    // ── Duplicate guard ──
    // A duplicate client splits that client's jobs, invoices and payment history
    // in two, and nothing in the app will tell you it happened. So look before
    // we create: match loosely on name/company, exactly on phone digits.
    const loose = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const digits = (s: string) => (s || '').replace(/\D/g, '').slice(-10);

    const possibleDuplicates = useMemo(() => {
        const typed = loose(formData.company) || loose(formData.name);
        const typedPhone = digits(formData.phone);
        if (typed.length < 3 && typedPhone.length < 10) return [];
        return (clients || []).filter((c: any) => {
            const co = loose(c.company);
            const nm = loose(c.name);
            const phoneHit = typedPhone.length === 10 && digits(c.phone) === typedPhone;
            const nameHit =
                typed.length >= 3 &&
                ((co && (co.includes(typed) || typed.includes(co))) ||
                    (nm && (nm.includes(typed) || typed.includes(nm))));
            return phoneHit || nameHit;
        }).slice(0, 4);
    }, [clients, formData.company, formData.name, formData.phone]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.phone) {
            toast.error('Name and Phone are required');
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

            if (newClient?.error) {
                toast.error(String('❌ Failed to add client: ' + newClient.error));
                setSaving(false);
                return;
            }

            toast.success('Client added successfully!');
            if (newClient?.data) {
                const clientId = newClient.data.id;
                // Seed brands into the brands table for full system sync
                const brandText = formData.brand_name.trim();
                if (brandText && clientId) {
                    const brandNames = brandText
                        .split(/[\s,]+/)
                        .map((s: string) => s.replace(/^#/, '').trim())
                        .filter(Boolean);
                    for (const name of brandNames) {
                        try {
                            await fetch(`/api/clients/${clientId}/brands`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name }),
                            });
                        } catch { /* non-fatal */ }
                    }
                }
                onSuccess?.(clientId, newClient.data);
            }
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
                address: '',
                brand_name: ''
            });
        } catch (error: any) {
            toast.error(String('❌ Failed to add client: ' + error.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-muted/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                            <UserPlus size={24} className="text-foreground" />
                        </div>
                        <div>
                            <h3 className="text-page-title text-gray-900">Quick Add Client</h3>
                            <p className="text-sm text-gray-600">Add a new client to the system</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-gray-200 rounded-md transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {possibleDuplicates.length > 0 && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <AlertTriangle size={16} />
                                This client may already exist
                            </div>
                            <p className="mt-1 text-xs text-amber-800">
                                Adding a second copy splits their jobs, invoices and payments across two records.
                            </p>
                            <div className="mt-2 space-y-1">
                                {possibleDuplicates.map((c: any) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            onSuccess?.(c.id, c);
                                            onClose();
                                        }}
                                        className="flex w-full items-center justify-between gap-2 rounded border border-amber-200 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">{c.company || c.name}</span>
                                            <span className="block truncate text-xs text-gray-500">
                                                {[c.company ? c.name : null, c.phone, c.city].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs font-semibold text-amber-900">Use this</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name *</label>
                            <input
                                required
                                type="text"
                                className="form-input"
                                placeholder="Full Name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Company</label>
                            <input
                                type="text"
                                className="form-input"
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
                                className="form-input"
                                placeholder="+91 98765 43210"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="email@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">City</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="City"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">State / Province</label>
                            <input
                                list="indian-states"
                                type="text"
                                className="form-input"
                                placeholder="Select or type state/province"
                                value={formData.state}
                                onChange={e => setFormData({ ...formData, state: e.target.value })}
                            />
                            <datalist id="indian-states">
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
                                className="form-input"
                                placeholder="22AAAAA0000A1Z5"
                                value={formData.gstin}
                                onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Brand Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., #tiger #cobra #premium"
                                value={formData.brand_name}
                                onChange={e => setFormData({ ...formData, brand_name: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">🔍 Searchable across entire system (hashtag format supported)</p>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Address</label>
                            <textarea
                                rows={2}
                                className="form-input"
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
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn-primary px-8 py-2"
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
