'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useClients, useVendors, useDesigners, useProductCategories, useJobs } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Job } from '@/types/database';
import { getStagesForJobType } from '@/lib/job-workflow';
import {
    Briefcase, X, Loader2, CheckCircle, Calendar, Folder, Plus,
    IndianRupee, User, Tag, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import VendorQuickAddModal from '@/components/shared/VendorQuickAddModal';

const JOB_TYPES = ['Design Only', 'Print Only', 'Design + Print'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const GST_RATES = [0, 5, 12, 18, 28];
const PAYMENT_MODES = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' },
];

interface UnifiedJobFormProps {
    mode?: 'modal' | 'page';
    editingJob?: Job | null;
    onSuccess?: () => void;
    onCancel?: () => void;
    showAdminFields?: boolean;
}

export default function UnifiedJobForm({
    mode = 'modal',
    editingJob = null,
    onSuccess,
    onCancel,
    showAdminFields,
}: UnifiedJobFormProps) {
    const { profile } = useAuth();
    const { clients, refetch: refetchClients } = useClients();
    const { vendors, refetch: refetchVendors } = useVendors();
    const { designers } = useDesigners();
    const { categories: productCategories, createCategory } = useProductCategories();
    const { createJob, updateJob } = useJobs();

    const isAdmin = showAdminFields ?? (profile?.role === 'admin' || profile?.role === 'finance');
    const isDesignOnly = (jt: string) => jt.toLowerCase() === 'design only';

    const [saving, setSaving] = useState(false);
    // Stock job = printed on spare sheet space and kept in the warehouse until the
    // client orders. Not an order: no price, no invoice, no dispatch.
    const [isStock, setIsStock] = useState(false);
    const [showClientModal, setShowClientModal] = useState(false);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [showAdvance, setShowAdvance] = useState(false);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [savingCategory, setSavingCategory] = useState(false);

    const handleAddCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        setSavingCategory(true);
        const result = await createCategory(name);
        if (result?.data) {
            set('product_category', name);
            setNewCategoryName('');
            setShowAddCategory(false);
        }
        setSavingCategory(false);
    };

    const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string }[]>([]);
    useEffect(() => {
        supabase.from('profiles').select('id, full_name').eq('is_active', true)
            .then(({ data }) => {
                if (data) setTeamMembers(data.filter(m => (m.full_name || '').trim() !== ''));
            });
    }, []);

    const [formData, setFormData] = useState({
        project_name: '',
        client_id: '',
        job_type: 'Design + Print',
        product_category: '',
        priority: 'normal',
        client_deadline: '',
        description: '',
        notes: '',
        drive_link: '',
        // Admin: pricing
        quantity: 0,
        quote_per_piece: 0,
        design_charge: 0,
        design_billing: '' as '' | 'billable' | 'non_billable', // '' = auto-derive on save
        gst_rate: 18,
        discount_amount: 0,
        // Admin: assignment
        vendor_id: '',
        designer_id: '',
        sales_person_id: '',
        current_stage: 'new',
    });

    const [advance, setAdvance] = useState({
        amount: 0,
        payment_mode: 'bank_transfer' as 'bank_transfer' | 'cheque',
        reference_number: '',
        received_by: '',
    });

    // Load editing job
    useEffect(() => {
        if (!editingJob) return;
        setFormData({
            project_name: editingJob.project_name || '',
            client_id: editingJob.client_id || '',
            job_type: editingJob.job_type || 'Design + Print',
            product_category: editingJob.product_category || '',
            priority: editingJob.priority || 'normal',
            client_deadline: editingJob.client_deadline ? new Date(editingJob.client_deadline).toISOString().split('T')[0] : '',
            description: editingJob.description || '',
            notes: (editingJob as any).notes || '',
            drive_link: (editingJob as any).drive_link || '',
            quantity: editingJob.quantity ?? 0,
            quote_per_piece: editingJob.quote_per_piece || 0,
            design_charge: (editingJob as any).design_charge || 0,
            design_billing: (editingJob as any).design_billing || '',
            gst_rate: editingJob.gst_rate || 18,
            discount_amount: editingJob.discount_amount || 0,
            vendor_id: editingJob.vendor_id || '',
            designer_id: editingJob.designer_id || '',
            sales_person_id: (editingJob as any).sales_person_id || '',
            current_stage: editingJob.current_stage || 'new',
        });
        if ((editingJob as any).advance_amount > 0) {
            setShowAdvance(true);
            setAdvance(prev => ({ ...prev, amount: (editingJob as any).advance_amount || 0 }));
        }
    }, [editingJob]);

    // ── Pricing calculations ────────────────────────────────────────────────
    const isPrint = !isDesignOnly(formData.job_type);
    const isDesign = formData.job_type.toLowerCase() !== 'print only';

    const printSubtotal = isPrint ? formData.quantity * formData.quote_per_piece : 0;
    const designSubtotal = isDesign ? (formData.design_charge || 0) : 0;
    const rawSubtotal = printSubtotal + designSubtotal - (formData.discount_amount || 0);
    const subtotal = Math.max(0, rawSubtotal);
    const gstAmount = subtotal * (formData.gst_rate / 100);
    const total = subtotal + gstAmount;

    // ── Submit ──────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.project_name || !formData.client_id) {
            toast.error(isStock ? 'Project name is required, and choose a client or "No client — common stock"' : 'Project name and client are required');
            return;
        }
        setSaving(true);
        try {
            const advanceAmount = showAdvance ? (advance.amount || 0) : 0;
            const paymentStatus = advanceAmount > 0
                ? (advanceAmount >= total ? 'paid' : 'partial')
                : 'pending';

            const jobPayload: any = {
                project_name: formData.project_name,
                client_id: formData.client_id === '__common' ? null : formData.client_id,
                job_type: formData.job_type,
                product_category: formData.product_category || null,
                priority: formData.priority,
                client_deadline: formData.client_deadline || null,
                description: formData.description || null,
                notes: formData.notes || null,
                drive_link: formData.drive_link || null,
                status: 'active',
            };
            if (isStock && !editingJob) jobPayload.is_stock = true;

            if (isAdmin) {
                jobPayload.quantity = formData.quantity;
                jobPayload.quote_per_piece = formData.quote_per_piece;
                jobPayload.design_charge = formData.design_charge || 0;
                // Finance tag. '' = let the DB trigger auto-derive (print-only/no charge => non_billable, charge>0 => billable).
                // For Print Only there is no design, so force non_billable.
                if (isPrint && !isDesign) {
                    jobPayload.design_billing = 'non_billable';
                } else if (formData.design_billing) {
                    jobPayload.design_billing = formData.design_billing;
                } else {
                    jobPayload.design_billing = (formData.design_charge || 0) > 0 ? 'billable' : 'non_billable';
                }
                // Admin saved the tag here → it is confirmed (clears any "pending" from a designer suggestion).
                jobPayload.design_billing_confirmed = true;
                jobPayload.subtotal = subtotal;
                jobPayload.gst_rate = formData.gst_rate;
                jobPayload.gst_amount = gstAmount;
                jobPayload.discount_amount = formData.discount_amount || 0;
                jobPayload.total_amount = total;
                jobPayload.vendor_id = formData.vendor_id || null;
                jobPayload.designer_id = formData.designer_id || null;
                jobPayload.sales_person_id = formData.sales_person_id || profile?.id || null;
                jobPayload.current_stage = formData.current_stage;
                jobPayload.payment_status = paymentStatus;
                jobPayload.amount_received = advanceAmount;
                jobPayload.advance_amount = advanceAmount;
                jobPayload.advance_collected = advanceAmount > 0;
                jobPayload.advance_payment_mode = advanceAmount > 0 ? advance.payment_mode : null;
                if (isStock && !editingJob) {
                    // Stock is not sold yet: nothing to invoice, nothing to collect.
                    jobPayload.quote_per_piece = 0;
                    jobPayload.design_charge = 0;
                    jobPayload.subtotal = 0;
                    jobPayload.gst_amount = 0;
                    jobPayload.discount_amount = 0;
                    jobPayload.total_amount = 0;
                    jobPayload.payment_status = 'pending';
                    jobPayload.amount_received = 0;
                    jobPayload.advance_amount = 0;
                    jobPayload.advance_collected = false;
                    jobPayload.advance_required = false;
                    jobPayload.advance_payment_mode = null;
                }
            }

            let savedJob: any = null;
            if (editingJob) {
                const result = await updateJob(editingJob.id, jobPayload);
                if (result?.error) throw new Error(result.error);
                savedJob = result?.data;
            } else {
                const result = await createJob(jobPayload);
                if (result?.error) throw new Error(result.error);
                savedJob = result?.data;
            }

            // Record advance payment
            if (!editingJob && !isStock && advanceAmount > 0 && savedJob?.id) {
                await supabase.from('payments_received').insert([{
                    job_id: savedJob.id,
                    client_id: formData.client_id || null,
                    amount: advanceAmount,
                    payment_mode: advance.payment_mode,
                    payment_date: new Date().toISOString(),
                    reference_number: advance.reference_number || null,
                    received_by: advance.received_by || profile?.id || null,
                    notes: 'Advance payment at order creation',
                }]);
            }

            toast.success(editingJob ? 'Job updated!' : 'Job created!');
            onSuccess?.();
        } catch (err: any) {
            toast.error('Failed to save: ' + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const set = (key: string, val: any) => setFormData(prev => ({ ...prev, [key]: val }));

    return (
        <>
            <div className={mode === 'modal' ? 'bg-white rounded-lg max-h-[90vh] overflow-y-auto' : 'space-y-4'}>

                {/* Header */}
                {mode === 'modal' && (
                    <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-5 border-b">
                        <div className="flex items-center gap-3">
                            <Briefcase className="text-gray-700" size={22} />
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingJob ? 'Edit Job' : 'New Job'}
                            </h2>
                        </div>
                        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-5 space-y-5">

                    {/* ── SECTION 1: Basics ── */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                            <Tag size={14} /> Project Basics
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Project Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                required
                                type="text"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                placeholder="e.g. Safal Pouch Design 1kg"
                                value={formData.project_name}
                                onChange={e => set('project_name', e.target.value)}
                            />
                        </div>

                        {!editingJob && (
                            <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${isStock ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={isStock}
                                    onChange={e => { setIsStock(e.target.checked); if (!e.target.checked && formData.client_id === '__common') set('client_id', ''); }}
                                />
                                <span>
                                    <span className="block text-sm font-semibold text-gray-900">Stock job — not a client order</span>
                                    <span className="block text-xs text-gray-600">
                                        Printed on spare sheet space and kept in the warehouse until the client orders.
                                        No price, no invoice, no dispatch. Release it from Dispatch when the order comes.
                                    </span>
                                </span>
                            </label>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            {/* Client */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Client <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowClientModal(true)}
                                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <Plus size={13} />
                                        Add New Client
                                    </button>
                                </div>
                                <select
                                    required
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                    value={formData.client_id}
                                    onChange={e => set('client_id', e.target.value)}
                                >
                                    <option value="">Select Client</option>
                                    {isStock && <option value="__common">★ No client — common stock</option>}
                                    {(clients || []).map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.company || c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Job Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                    value={formData.job_type}
                                    onChange={e => set('job_type', e.target.value)}
                                >
                                    {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {/* Product Category */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-gray-700">Product Category</label>
                                    <button
                                        type="button"
                                        onClick={() => { setShowAddCategory(!showAddCategory); setNewCategoryName(''); }}
                                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <Plus size={13} />
                                        Add New Category
                                    </button>
                                </div>
                                {showAddCategory && (
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } if (e.key === 'Escape') setShowAddCategory(false); }}
                                            placeholder="e.g. Logo Design"
                                            className="flex-1 px-3 py-2 border border-blue-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddCategory}
                                            disabled={savingCategory || !newCategoryName.trim()}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                        >
                                            {savingCategory ? '...' : 'Add'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddCategory(false)}
                                            className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                    value={formData.product_category}
                                    onChange={e => set('product_category', e.target.value)}
                                >
                                    <option value="">Select Category</option>
                                    {(productCategories || []).map((c: any) => (
                                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                    value={formData.priority}
                                    onChange={e => set('priority', e.target.value)}
                                >
                                    {PRIORITIES.map(p => (
                                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Deadline */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                    <Calendar size={13} /> Deadline
                                </label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                    value={formData.client_deadline}
                                    onChange={e => set('client_deadline', e.target.value)}
                                />
                            </div>

                            {/* Designer */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                    <User size={13} /> Designer
                                </label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                    value={formData.designer_id}
                                    onChange={e => set('designer_id', e.target.value)}
                                >
                                    <option value="">Unassigned</option>
                                    {(designers || []).map((d: any) => (
                                        <option key={d.id} value={d.id}>{d.name || d.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Drive Link */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <Folder size={13} /> Google Drive Link
                            </label>
                            <input
                                type="url"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                placeholder="https://drive.google.com/..."
                                value={formData.drive_link}
                                onChange={e => set('drive_link', e.target.value)}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Requirements</label>
                            <textarea
                                rows={3}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none resize-none"
                                placeholder="Size, material, special instructions..."
                                value={formData.description}
                                onChange={e => set('description', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* ── SECTION 2: Pricing (Admin only) ── */}
                    {isAdmin && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                                <IndianRupee size={14} /> Pricing
                                <span className="ml-auto text-xs font-normal bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Admin Only</span>
                            </h3>

                            <div className="grid grid-cols-3 gap-3">
                                {isPrint && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                                            <input
                                                type="number" min="1"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                                value={formData.quantity || ''}
                                                onChange={e => set('quantity', e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Rate / Piece (₹)</label>
                                            <input
                                                type="number" min="0" step="0.01"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                                value={formData.quote_per_piece || ''}
                                                onChange={e => set('quote_per_piece', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </>
                                )}
                                {isDesign && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Design Charge (₹)</label>
                                        <input
                                            type="number" min="0" step="0.01"
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                            value={formData.design_charge || ''}
                                            onChange={e => set('design_charge', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                )}
                                {isDesign && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Design Billing (finance tag)</label>
                                        <select
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                            value={formData.design_billing}
                                            onChange={e => set('design_billing', e.target.value as '' | 'billable' | 'non_billable')}
                                        >
                                            <option value="">Auto ({(formData.design_charge || 0) > 0 ? 'Billable' : 'Non-billable'})</option>
                                            <option value="billable">Billable (design charged)</option>
                                            <option value="non_billable">Non-billable (free design)</option>
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">GST %</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                        value={formData.gst_rate}
                                        onChange={e => set('gst_rate', parseInt(e.target.value))}
                                    >
                                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Discount (₹)</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                        value={formData.discount_amount || ''}
                                        onChange={e => set('discount_amount', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            {/* Totals bar */}
                            <div className="grid grid-cols-3 gap-3 bg-white rounded-md p-3 border border-gray-200 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">Subtotal</p>
                                    <p className="font-semibold text-gray-800">₹{subtotal.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">GST ({formData.gst_rate}%)</p>
                                    <p className="font-semibold text-gray-800">₹{gstAmount.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Total</p>
                                    <p className="font-bold text-gray-900 text-base">₹{total.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SECTION 3: Assignment (Admin only) ── */}
                    {isAdmin && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                                <Layers size={14} /> Assignment & Stage
                                <span className="ml-auto text-xs font-normal bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Admin Only</span>
                            </h3>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Vendor */}
                                {!isDesignOnly(formData.job_type) && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Vendor / Printer</label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                                value={formData.vendor_id}
                                                onChange={e => set('vendor_id', e.target.value)}
                                            >
                                                <option value="">No Vendor</option>
                                                {(vendors || []).map((v: any) => (
                                                    <option key={v.id} value={v.id}>{v.company || v.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                title="Add New Vendor"
                                                onClick={() => setShowVendorModal(true)}
                                                className="px-3 py-2.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Sales Person */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Sales Person</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                        value={formData.sales_person_id}
                                        onChange={e => set('sales_person_id', e.target.value)}
                                    >
                                        <option value="">Self ({profile?.full_name || 'Me'})</option>
                                        {teamMembers.map(m => (
                                            <option key={m.id} value={m.id}>{m.full_name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Current Stage */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Current Stage</label>
                                    {/* Stages are filtered by job type. Print Only never shows
                                        Designing/Approval — after New comes File Check (verify the
                                        client's print file), then it moves to print production. */}
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                        value={formData.current_stage}
                                        onChange={e => set('current_stage', e.target.value)}
                                    >
                                        {getStagesForJobType([], formData.job_type).map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.id === 'file_check' ? 'Print File Check (verify)' : s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Notes */}
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
                                    <textarea
                                        rows={2}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none resize-none"
                                        placeholder="Internal notes visible to admin only..."
                                        value={formData.notes}
                                        onChange={e => set('notes', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SECTION 4: Advance Payment (Admin only, new jobs only) ── */}
                    {isAdmin && !editingJob && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowAdvance(!showAdvance)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                            >
                                <span className="flex items-center gap-2">
                                    <IndianRupee size={14} />
                                    Advance Payment
                                    {showAdvance && advance.amount > 0 && (
                                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-bold">
                                            ₹{advance.amount.toLocaleString()}
                                        </span>
                                    )}
                                </span>
                                {showAdvance ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {showAdvance && (
                                <div className="p-4 bg-white space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Advance Amount (₹)</label>
                                            <input
                                                type="number" min="0" step="0.01"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                                value={advance.amount || ''}
                                                onChange={e => setAdvance(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                                            <select
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                                value={advance.payment_mode}
                                                onChange={e => setAdvance(prev => ({ ...prev, payment_mode: e.target.value as any }))}
                                            >
                                                {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Reference / UTR #</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                                placeholder="Optional"
                                                value={advance.reference_number}
                                                onChange={e => setAdvance(prev => ({ ...prev, reference_number: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Received By</label>
                                            <select
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                                value={advance.received_by}
                                                onChange={e => setAdvance(prev => ({ ...prev, received_by: e.target.value }))}
                                            >
                                                <option value="">Self</option>
                                                {teamMembers.map(m => (
                                                    <option key={m.id} value={m.id}>{m.full_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Footer Buttons ── */}
                    <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-8 py-2.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <><Loader2 size={16} className="animate-spin" /> Saving...</>
                            ) : (
                                <><CheckCircle size={16} /> {editingJob ? 'Update Job' : 'Create Job'}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Client Quick Add */}
            <ClientQuickAddModal
                isOpen={showClientModal}
                onClose={() => setShowClientModal(false)}
                onSuccess={(clientId) => {
                    refetchClients();
                    set('client_id', clientId);
                    setShowClientModal(false);
                }}
            />

            {/* Vendor Quick Add */}
            <VendorQuickAddModal
                isOpen={showVendorModal}
                onClose={() => setShowVendorModal(false)}
                onSuccess={(vendorId) => {
                    refetchVendors();
                    set('vendor_id', vendorId);
                    setShowVendorModal(false);
                }}
            />
        </>
    );
}
