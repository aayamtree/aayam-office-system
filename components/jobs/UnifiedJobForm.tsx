'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useClients, useVendors, useDesigners } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Job } from '@/types/database';
import { Briefcase, X, Loader2, CheckCircle, Calendar, Folder, Plus } from 'lucide-react';
import { extractFileIdFromLink, verifyDriveFile, formatBytes, getFileIcon, DriveFileInfo } from '@/lib/google-drive';
import { useSession } from 'next-auth/react';
import { createProjectCalendarEvent, createCalendarEvent } from '@/lib/google-calendar';

const jobTypes = ['Design Only', 'Print Only', 'Design + Print'];
const productCategories = ['Banner', 'Book', 'Box', 'Brochure', 'Label', 'Poster', 'Sticker', 'Other'];
const priorities = ['low', 'normal', 'high', 'urgent'];

interface UnifiedJobFormProps {
    mode?: 'modal' | 'page';
    editingJob?: Job | null;
    onSuccess?: () => void;
    onCancel?: () => void;
    showAdminFields?: boolean; // Override role detection
}

export default function UnifiedJobForm({
    mode = 'modal',
    editingJob = null,
    onSuccess,
    onCancel,
    showAdminFields
}: UnifiedJobFormProps) {
    const { profile } = useAuth();
    const { data: session } = useSession();
    const { clients } = useClients();
    const { vendors } = useVendors();
    const { designers } = useDesigners();

    const [saving, setSaving] = useState(false);
    const [showAddClient, setShowAddClient] = useState(false);
    const [showAddVendor, setShowAddVendor] = useState(false);

    // Determine if admin fields should be shown
    const isAdmin = showAdminFields ?? (profile?.role === 'admin' || profile?.role === 'finance');

    // Form state
    const [formData, setFormData] = useState({
        project_name: '',
        client_id: '',
        designer_id: '',
        job_type: 'Design + Print',
        product_category: 'Other',
        priority: 'normal',
        client_deadline: '',
        description: '',
        drive_link: '',
        // Admin-only fields
        quantity: 1,
        quote_per_piece: 0,
        gst_rate: 18,
        vendor_id: '',
        current_stage: 'new'
    });

    // Drive verification
    const [driveStatus, setDriveStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
    const [driveFileInfo, setDriveFileInfo] = useState<DriveFileInfo | null>(null);
    const [driveError, setDriveError] = useState('');

    // File uploads
    const [files, setFiles] = useState<File[]>([]);

    // Load editing job
    useEffect(() => {
        if (editingJob) {
            setFormData({
                project_name: editingJob.project_name,
                client_id: editingJob.client_id || '',
                designer_id: editingJob.designer_id || '',
                job_type: editingJob.job_type || 'Design + Print',
                product_category: editingJob.product_category || 'Other',
                priority: editingJob.priority || 'normal',
                client_deadline: editingJob.client_deadline || '',
                description: editingJob.description || '',
                drive_link: (editingJob as any).drive_link || '',
                quantity: editingJob.quantity || 1,
                quote_per_piece: editingJob.quote_per_piece || 0,
                gst_rate: editingJob.gst_rate || 18,
                vendor_id: editingJob.vendor_id || '',
                current_stage: editingJob.current_stage || 'new'
            });
        }
    }, [editingJob]);

    // Drive link verification
    const handleDriveLinkChange = async (link: string) => {
        setFormData({ ...formData, drive_link: link });

        if (!link.trim()) {
            setDriveStatus('idle');
            setDriveFileInfo(null);
            setDriveError('');
            return;
        }

        const fileId = extractFileIdFromLink(link);
        if (!fileId) {
            setDriveStatus('error');
            setDriveError('Invalid Google Drive link format');
            return;
        }

        setDriveStatus('verifying');
        const result = await verifyDriveFile(fileId);

        if (result.success && result.file) {
            setDriveStatus('verified');
            setDriveFileInfo(result.file);
            setDriveError('');
        } else {
            setDriveStatus('error');
            setDriveError(result.error || 'Could not verify file');
        }
    };

    // Calculate totals
    const subtotal = formData.quantity * formData.quote_per_piece;
    const gstAmount = (subtotal * formData.gst_rate) / 100;
    const total = subtotal + gstAmount;

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const jobData = {
                project_name: formData.project_name,
                client_id: formData.client_id,
                designer_id: formData.designer_id || user?.id,
                job_type: formData.job_type,
                product_category: formData.product_category,
                priority: formData.priority,
                client_deadline: formData.client_deadline || null,
                description: formData.description || null,
                drive_link: formData.drive_link || null,
                current_stage: formData.current_stage as any,
                status: 'active' as const,
                // Admin fields
                quantity: isAdmin ? formData.quantity : 1,
                quote_per_piece: isAdmin ? formData.quote_per_piece : 0,
                gst_rate: isAdmin ? formData.gst_rate : 0,
                subtotal: isAdmin ? subtotal : 0,
                gst_amount: isAdmin ? gstAmount : 0,
                total_amount: isAdmin ? total : 0,
                vendor_id: isAdmin ? formData.vendor_id || null : null,
                payment_status: 'pending' as const,
                amount_received: 0,
                order_date: new Date().toISOString().split('T')[0],
                created_by: user?.id
            };

            let newJob;
            if (editingJob) {
                const { data, error } = await supabase
                    .from('jobs')
                    .update(jobData)
                    .eq('id', editingJob.id)
                    .select()
                    .single();
                if (error) throw error;
                newJob = data;
            } else {
                const { data, error } = await supabase
                    .from('jobs')
                    .insert([jobData])
                    .select()
                    .single();
                if (error) throw error;
                newJob = data;
            }

            // Calendar integration
            if (session?.accessToken && formData.client_deadline) {
                const calendarEvent = createProjectCalendarEvent(
                    formData.project_name,
                    formData.client_deadline,
                    formData.description,
                    formData.drive_link
                );

                const eventResult = await createCalendarEvent(
                    session.accessToken,
                    calendarEvent
                );

                if (eventResult.success && eventResult.eventId) {
                    await supabase
                        .from('jobs')
                        .update({
                            calendar_event_id: eventResult.eventId,
                            calendar_event_link: eventResult.eventLink
                        })
                        .eq('id', newJob.id);
                }
            }

            onSuccess?.();
        } catch (error: any) {
            console.error('Error saving job:', error);
            toast({ title: '❌ Failed to save job', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const containerClass = mode === 'modal'
        ? 'bg-white rounded-lg p-4 md:p-6 max-h-[85vh] overflow-y-auto'
        : 'space-y-6';

    return (
        <div className={containerClass}>
            {/* Header */}
            {mode === 'modal' && (
                <div className="flex items-center justify-between mb-3 md:mb-6 pb-4 border-b">
                    <div className="flex items-center gap-3">
                        <Briefcase className="text-primary" size={24} />
                        <h2 className="text-page-title text-gray-900">
                            {editingJob ? 'Edit Job' : 'New Job'}
                        </h2>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-md">
                        <X size={20} />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* SECTION 1: Project Basics - ALL ROLES */}
                <div className="space-y-2 md:space-y-4 bg-muted/50 rounded-lg p-4 md:p-6 border border-border">
                    <h3 className="text-section text-gray-900 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">1</span>
                        Project Basics
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Project Name *</label>
                            <input
                                required
                                type="text"
                                className="w-full px-3 py-2 border rounded-md"
                                placeholder="e.g. Wedding Invitation - Sharma Family"
                                value={formData.project_name}
                                onChange={e => setFormData({ ...formData, project_name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Client *</label>
                            <div className="flex gap-2">
                                <select
                                    required
                                    className="flex-1 px-3 py-2 border rounded-md"
                                    value={formData.client_id}
                                    onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                                >
                                    <option value="">Select Client</option>
                                    {clients?.map(c => (
                                        <option key={c.id} value={c.id}>{c.company || c.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowAddClient(true)}
                                    className="px-3 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Designer</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={formData.designer_id}
                                onChange={e => setFormData({ ...formData, designer_id: e.target.value })}
                            >
                                <option value="">Assign to Me</option>
                                {designers?.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Project Parameters - ALL ROLES */}
                <div className="space-y-2 md:space-y-4 bg-muted/50 rounded-lg p-4 md:p-6 border border-border">
                    <h3 className="text-section text-gray-900 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">2</span>
                        Project Parameters
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Job Type</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={formData.job_type}
                                onChange={e => setFormData({ ...formData, job_type: e.target.value })}
                            >
                                {jobTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Product Category</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={formData.product_category}
                                onChange={e => setFormData({ ...formData, product_category: e.target.value })}
                            >
                                {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Used for production checklists</p>
                        </div>


                        <div>
                            <label className="block text-sm font-medium mb-1">Priority</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={formData.priority}
                                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                            >
                                {priorities.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Deadline</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border rounded-md"
                                value={formData.client_deadline}
                                onChange={e => setFormData({ ...formData, client_deadline: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* SECTION 3: Financial Details - ADMIN ONLY */}
                {isAdmin && (
                    <div className="space-y-2 md:space-y-4 bg-muted/50 rounded-lg p-4 md:p-6 border border-border">
                        <h3 className="text-section text-gray-900 flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">3</span>
                            Financial Details
                            <span className="ml-auto text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">Admin Only</span>
                        </h3>

                        <div className="grid grid-cols-3 gap-2 md:gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Rate/Piece (₹)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={formData.quote_per_piece}
                                    onChange={e => setFormData({ ...formData, quote_per_piece: parseFloat(e.target.value) || 0 })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">GST %</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={formData.gst_rate}
                                    onChange={e => setFormData({ ...formData, gst_rate: parseInt(e.target.value) })}
                                >
                                    <option value="0">0%</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18">18%</option>
                                    <option value="28">28%</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 md:gap-4 bg-white p-4 rounded-lg">
                            <div>
                                <p className="text-xs text-gray-500">Subtotal</p>
                                <p className="font-bold text-gray-900">₹{subtotal.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">GST ({formData.gst_rate}%)</p>
                                <p className="font-bold text-gray-900">₹{gstAmount.toFixed(2)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="font-bold text-primary text-xl">₹{total.toFixed(2)}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Vendor</label>
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 px-3 py-2 border rounded-md"
                                    value={formData.vendor_id}
                                    onChange={e => setFormData({ ...formData, vendor_id: e.target.value })}
                                >
                                    <option value="">Select Vendor</option>
                                    {vendors?.map(v => (
                                        <option key={v.id} value={v.id}>{v.company || v.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowAddVendor(true)}
                                    className="px-3 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Current Stage</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={formData.current_stage}
                                onChange={e => setFormData({ ...formData, current_stage: e.target.value })}
                            >
                                <option value="new">New</option>
                                <option value="designing">Designing</option>
                                <option value="approval">Approval</option>
                                <option value="printing">Printing</option>
                                <option value="ready">Ready</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* SECTION 4: Assets & Description - ALL ROLES */}
                <div className="space-y-2 md:space-y-4 bg-muted/50 rounded-lg p-4 md:p-6 border border-border">
                    <h3 className="text-section text-gray-900 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">{isAdmin ? '4' : '3'}</span>
                        Assets & Brief
                    </h3>

                    <div>
                        <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                            <Folder size={16} />
                            Google Drive Link
                        </label>
                        <input
                            type="url"
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="https://drive.google.com/..."
                            value={formData.drive_link}
                            onChange={e => handleDriveLinkChange(e.target.value)}
                        />

                        {driveStatus === 'verifying' && (
                            <div className="flex items-center gap-2 text-blue-600 text-sm mt-2">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Verifying file...</span>
                            </div>
                        )}

                        {driveStatus === 'verified' && driveFileInfo && (
                            <div className="bg-white p-3 rounded-lg border border-green-200 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{getFileIcon(driveFileInfo.mimeType)}</span>
                                    <div>
                                        <p className="font-medium text-sm">{driveFileInfo.name}</p>
                                        <p className="text-xs text-gray-500">{formatBytes(driveFileInfo.size)}</p>
                                    </div>
                                    <CheckCircle size={18} className="text-green-600 ml-auto" />
                                </div>
                            </div>
                        )}

                        {driveStatus === 'error' && driveError && (
                            <p className="text-sm text-red-600 mt-1">❌ {driveError}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description / Work Items</label>
                        <textarea
                            rows={4}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="Describe specific requirements, items to print, size, quantity, special instructions..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">File Upload (Multiple)</label>
                        <input
                            type="file"
                            multiple
                            className="w-full text-sm"
                            onChange={e => {
                                if (e.target.files) {
                                    setFiles(Array.from(e.target.files));
                                }
                            }}
                        />
                        {files.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">{files.length} file(s) selected</p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
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
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                {editingJob ? 'Update Job' : 'Create Job'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Quick Add Modals - Placeholder for now */}
            {showAddClient && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg">
                        <p>Client Quick Add Modal - To be implemented</p>
                        <button onClick={() => setShowAddClient(false)} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                    </div>
                </div>
            )}

            {showAddVendor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg">
                        <p>Vendor Quick Add Modal - To be implemented</p>
                        <button onClick={() => setShowAddVendor(false)} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
