'use client';

import { useState, useEffect } from 'react';
import { X, FolderOpen, User, Calendar, DollarSign, Plus, Upload, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Client, Vendor, ProductCategory, Profile, Job } from '@/types/database';
import ClientQuickAdd from './ClientQuickAdd';
import VendorQuickAdd from './VendorQuickAdd';

const JOB_TYPES = [
    { value: 'print_only', label: 'Print Only' },
    { value: 'design_only', label: 'Design Only' },
    { value: 'design_print', label: 'Design + Print' }
];

interface UnifiedProjectFormProps {
    onJobCreated?: (job: Job) => void;
    onClose: () => void;
    existingJob?: Job; // For editing
}

export default function UnifiedProjectForm({ onJobCreated, onClose, existingJob }: UnifiedProjectFormProps) {

    const { profile } = useAuth();
    const isDesigner = profile?.role === 'designer';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Quick add modals
    const [showClientQuickAdd, setShowClientQuickAdd] = useState(false);
    const [showVendorQuickAdd, setShowVendorQuickAdd] = useState(false);

    // Data
    const [clients, setClients] = useState<Client[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
    const [designers, setDesigners] = useState<Profile[]>([]);

    // Form data
    const [formData, setFormData] = useState({
        // Section 1: Project Basics (ALL ROLES)
        project_name: existingJob?.project_name || '',
        client_id: existingJob?.client_id || '',
        job_type: existingJob?.job_type || 'design_print',
        description: existingJob?.description || '',

        // Section 2: Designer Assignment (ALL ROLES)
        designer_id: existingJob?.designer_id || '',
        client_deadline: existingJob?.client_deadline || '',
        priority: existingJob?.priority || 'normal',

        // Section 3: Multiple Files (ALL ROLES)
        files: existingJob?.files || [],

        // Section 4: Financial (ADMIN ONLY)
        product_category_id: existingJob?.product_category_id || '',
        quantity: existingJob?.quantity || 1,
        base_price: existingJob?.base_price || 0,
        gst_rate: existingJob?.gst_rate || 18.00,
        total_amount: existingJob?.total_amount || 0,
        vendor_id: existingJob?.vendor_id || '',
        current_stage: existingJob?.current_stage || 'new',
    });

    // File upload state
    const [fileUploads, setFileUploads] = useState<File[]>([]);

    // Fetch data
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [clientsRes, vendorsRes, categoriesRes, designersRes] = await Promise.all([
                supabase.from('clients').select('*').eq('is_active', true).order('name'),
                supabase.from('vendors').select('*').eq('is_active', true).order('name'),
                supabase.from('product_categories').select('*').eq('is_active', true).order('name'),
                supabase.from('profiles').select('*').eq('role', 'designer').eq('is_active', true).order('full_name')
            ]);

            if (clientsRes.data) setClients(clientsRes.data);
            if (vendorsRes.data) setVendors(vendorsRes.data);
            if (categoriesRes.data) setProductCategories(categoriesRes.data);
            if (designersRes.data) setDesigners(designersRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        }
    };

    // Calculate total when base price or GST changes
    useEffect(() => {
        if (!isDesigner) {
            const base = parseFloat(formData.base_price as any) || 0;
            const gst = parseFloat(formData.gst_rate as any) || 0;
            const total = base * (1 + gst / 100);
            setFormData(prev => ({ ...prev, total_amount: total }));
        }
    }, [formData.base_price, formData.gst_rate, isDesigner]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFileUploads(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFileUploads(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate required fields
            if (!formData.project_name || !formData.client_id) {
                throw new Error('Project name and client are required');
            }

            // Prepare job data
            const jobData: any = {
                project_name: formData.project_name,
                client_id: formData.client_id,
                job_type: formData.job_type,
                description: formData.description,
                designer_id: formData.designer_id || null,
                client_deadline: formData.client_deadline || null,
                priority: formData.priority,
                files: formData.files,
                current_stage: formData.current_stage,
                status: 'active'
            };

            // Add financial fields only if user is not a designer
            if (!isDesigner) {
                jobData.product_category_id = formData.product_category_id || null;
                jobData.quantity = formData.quantity;
                jobData.base_price = formData.base_price;
                jobData.gst_rate = formData.gst_rate;
                jobData.total_amount = formData.total_amount;
                jobData.vendor_id = formData.vendor_id || null;
            }

            // Create or update job
            let job;
            if (existingJob) {
                const { data, error: updateError } = await supabase
                    .from('jobs')
                    .update(jobData)
                    .eq('id', existingJob.id)
                    .select()
                    .single();
                if (updateError) throw updateError;
                job = data;
            } else {
                const { data, error: insertError } = await supabase
                    .from('jobs')
                    .insert([jobData])
                    .select()
                    .single();
                if (insertError) throw insertError;
                job = data;
            }

            // Log activity
            await supabase.from('activity_logs').insert([{
                action: existingJob ? 'updated' : 'created',
                module: 'jobs',
                details: { job_id: job.id, project_name: job.project_name }
            }]);

            if (onJobCreated) {
                onJobCreated(job);
            }

            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-4xl  overflow-hidden max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="bg-oms-blue p-6 text-white flex items-center justify-between">
                        <div>
                            <h3 className="text-page-title flex items-center gap-3">
                                <FolderOpen size={28} />
                                {existingJob ? 'Edit Project' : 'Create New Project'}
                            </h3>
                            <p className="text-purple-100 text-sm mt-1">
                                {isDesigner ? 'Designer View - Financial fields hidden' : 'Complete project details with financial info'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-all">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Section 1: Project Basics (ALL ROLES) */}
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg md:rounded-2xl p-4 md:p-6 border-2 border-blue-100">
                            <h4 className="font-bold text-blue-900 mb-4 text-lg">📋 Project Basics</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Project Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.project_name}
                                        onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                        placeholder="e.g., Visiting Card for ABC Corp"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2 md:gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Client <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                required
                                                value={formData.client_id}
                                                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                            >
                                                <option value="">Select Client</option>
                                                {clients.map(client => (
                                                    <option key={client.id} value={client.id}>{client.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setShowClientQuickAdd(true)}
                                                className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
                                                title="Add New Client"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Job Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.job_type}
                                            onChange={(e) => setFormData({ ...formData, job_type: e.target.value as 'print_only' | 'design_only' | 'design_print' })}
                                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                        >
                                            {JOB_TYPES.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all resize-none"
                                        rows={3}
                                        placeholder="Project details and requirements"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Designer Assignment (ALL ROLES) */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg md:rounded-2xl p-4 md:p-6 border-2 border-green-100">
                            <h4 className="font-bold text-green-900 mb-4 text-lg flex items-center gap-2">
                                <User size={20} />
                                Designer & Timeline
                            </h4>
                            <div className="grid grid-cols-3 gap-2 md:gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Assign Designer
                                    </label>
                                    <select
                                        value={formData.designer_id}
                                        onChange={(e) => setFormData({ ...formData, designer_id: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                    >
                                        <option value="">Unassigned</option>
                                        {designers.map(designer => (
                                            <option key={designer.id} value={designer.id}>{designer.full_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        <Calendar size={16} className="inline mr-1" />
                                        Deadline
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.client_deadline}
                                        onChange={(e) => setFormData({ ...formData, client_deadline: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Priority
                                    </label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Multiple Files (ALL ROLES) */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg md:rounded-2xl p-4 md:p-6 border-2 border-amber-100">
                            <h4 className="font-bold text-amber-900 mb-4 text-lg flex items-center gap-2">
                                <Upload size={20} />
                                Project Files (Multiple Upload)
                            </h4>
                            <div className="space-y-3">
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="w-full border-2 border-dashed border-amber-300 rounded-xl p-4 bg-white hover:bg-amber-50 transition-all cursor-pointer"
                                />
                                {fileUploads.length > 0 && (
                                    <div className="space-y-2">
                                        {fileUploads.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200">
                                                <span className="text-sm font-medium text-gray-700">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(index)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Financial (ADMIN ONLY - HIDDEN FROM DESIGNERS) */}
                        {!isDesigner && (
                            <div className="bg-oms-blue rounded-lg md:rounded-2xl p-4 md:p-6 border-2 border-[rgba(0,0,255,0.2)]-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-indigo-900 text-lg flex items-center gap-2">
                                        <DollarSign size={20} />
                                        Financial Details (Admin Only)
                                    </h4>
                                    <span className="text-xs bg-[rgba(0,0,255,0.1)] text-indigo-800 px-3 py-1 rounded-full font-bold">
                                        🔒 Hidden from Designers
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Product Category
                                            </label>
                                            <select
                                                value={formData.product_category_id}
                                                onChange={(e) => setFormData({ ...formData, product_category_id: e.target.value })}
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                            >
                                                <option value="">Select Category</option>
                                                {productCategories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Quantity
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.quantity}
                                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                                min="1"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Current Stage
                                            </label>
                                            <select
                                                value={formData.current_stage}
                                                onChange={(e) => setFormData({ ...formData, current_stage: e.target.value as any })}
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                            >
                                                <option value="new">New</option>
                                                <option value="designing">Designing</option>
                                                <option value="approval">Awaiting Approval</option>
                                                <option value="printing">Printing</option>
                                                <option value="finishing">Finishing</option>
                                                <option value="ready">Ready</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 md:gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Base Price (₹)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.base_price}
                                                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                GST %
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.gst_rate}
                                                onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) || 0 })}
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Total Amount (₹)
                                            </label>
                                            <input
                                                type="number"
                                                readOnly
                                                value={formData.total_amount.toFixed(2)}
                                                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 bg-gray-100 font-bold text-gray-700"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Vendor
                                            </label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={formData.vendor_id}
                                                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                                                >
                                                    <option value="">None</option>
                                                    {vendors.map(vendor => (
                                                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowVendorQuickAdd(true)}
                                                    className="px-3 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all"
                                                    title="Add New Vendor"
                                                >
                                                    <Plus size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="pt-4 border-t-2 border-gray-100 flex gap-2 md:gap-4 justify-end">
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
                                className="px-8 py-3 bg-oms-blue text-white rounded-xl font-bold  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Saving...' : existingJob ? 'Update Project' : 'Create Project'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Quick Add Modals */}
            {showClientQuickAdd && (
                <ClientQuickAdd
                    onClientCreated={(client) => {
                        setClients(prev => [...prev, client]);
                        setFormData({ ...formData, client_id: client.id });
                        setShowClientQuickAdd(false);
                    }}
                    onClose={() => setShowClientQuickAdd(false)}
                />
            )}

            {showVendorQuickAdd && (
                <VendorQuickAdd
                    onVendorCreated={(vendor) => {
                        setVendors(prev => [...prev, vendor]);
                        setFormData({ ...formData, vendor_id: vendor.id });
                        setShowVendorQuickAdd(false);
                    }}
                    onClose={() => setShowVendorQuickAdd(false)}
                />
            )}
        </>
    );
}
