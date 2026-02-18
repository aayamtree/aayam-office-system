'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Package, FileText, ClipboardCheck, Clock, Upload,
    CheckCircle, XCircle, AlertTriangle, User, Calendar, Loader2,
    Download, Truck, IndianRupee, TrendingUp, TrendingDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

// ─── Types ───────────────────────────────────────────────────
interface JobDetail {
    id: string;
    job_number: string;
    project_name: string;
    description?: string;
    quantity: number;
    actual_quantity?: number;
    job_type?: string;
    product_category?: string;
    priority: string;
    current_stage: string;
    order_date: string;
    client_deadline?: string;
    completed_date?: string;
    total_amount: number;
    payment_status: string;
    notes?: string;
    files: { name: string; url: string; type: string; size: number; uploaded_at: string }[];
    packing_info?: {
        verified_qty: number;
        package_type: string;
        package_count: number;
        approx_weight_kg: number;
        packing_notes: string;
    };
    client?: { company?: string; name?: string; phone?: string; email?: string };
    vendor?: { name?: string; company?: string };
    invoices?: { id: string; invoice_number: string; total_amount: number; status: string }[];
    created_at: string;
    updated_at?: string;
}

interface QCRecord {
    id: string;
    qc_type: string;
    checklist: Record<string, boolean>;
    result: string;
    notes?: string;
    performed_by_name: string;
    design_file_url?: string;
    created_at: string;
}

interface ActivityLog {
    id: string;
    action: string;
    description: string;
    metadata?: Record<string, any>;
    created_at: string;
    user_id: string;
    profiles?: { full_name?: string; role?: string };
}

// ─── Status helpers ──────────────────────────────────────────
const stageLabel: Record<string, string> = {
    new: 'New', awaiting_admin: 'Pending Approval', designing: 'Designing',
    approval: 'Client Approval', printing: 'Printing', finishing: 'Finishing',
    quality_check: 'Quality Check', ready: 'Ready', packed: 'Packed',
    dispatched: 'Dispatched', completed: 'Completed', cancelled: 'Cancelled',
};

const stageColor: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', awaiting_admin: 'bg-orange-100 text-orange-700',
    designing: 'bg-violet-100 text-violet-700', approval: 'bg-amber-100 text-amber-700',
    printing: 'bg-gray-800 text-white', finishing: 'bg-cyan-100 text-cyan-700',
    quality_check: 'bg-indigo-100 text-indigo-700', ready: 'bg-green-100 text-green-700',
    packed: 'bg-teal-100 text-teal-700', dispatched: 'bg-gray-100 text-gray-700',
    completed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700',
};

export default function JobDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { profile } = useAuth();
    const jobId = params.id as string;

    const [job, setJob] = useState<JobDetail | null>(null);
    const [qcRecords, setQcRecords] = useState<QCRecord[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalExpense, setTotalExpense] = useState(0);

    // Invoice / E-Way Bill form
    const [invoiceRef, setInvoiceRef] = useState('');
    const [ewayBillNo, setEwayBillNo] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<{ label: string; name: string }[]>([]);

    useEffect(() => {
        if (!jobId) return;
        fetchAll();
    }, [jobId]);

    const fetchAll = async () => {
        setLoading(true);

        // Fetch job — try with joins first, fallback to basic query
        let jobData: any = null;
        const { data, error } = await supabase
            .from('jobs')
            .select('*, client:clients(company, name, phone, email), vendor:vendors(name, company), invoices(id, invoice_number, total_amount, payment_status)')
            .eq('id', jobId)
            .single();

        if (data) {
            jobData = data;
        } else if (error) {
            console.warn('Job fetch with joins failed, trying basic:', error.message);
            // Fallback: fetch without joins
            const { data: basicData } = await supabase
                .from('jobs')
                .select('*')
                .eq('id', jobId)
                .single();
            if (basicData) jobData = basicData;
        }

        if (jobData) {
            setJob(jobData as JobDetail);
            if (jobData.invoice_reference) setInvoiceRef(jobData.invoice_reference);
            if (jobData.eway_bill_number) setEwayBillNo(jobData.eway_bill_number);
        }

        // Fetch QC records
        const { data: qcData } = await supabase
            .from('qc_records')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });

        if (qcData) setQcRecords(qcData as QCRecord[]);

        // Fetch expenses (purchase bills)
        const { data: billsData } = await supabase
            .from('purchase_bills')
            .select('total_amount')
            .eq('job_id', jobId);

        if (billsData) {
            setTotalExpense(billsData.reduce((s: number, b: any) => s + (b.total_amount || 0), 0));
        }

        // Fetch activity logs
        const { data: logData } = await supabase
            .from('activity_logs')
            .select('*, profiles:user_id(full_name, role)')
            .eq('entity_id', jobId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (logData) setActivityLogs(logData as ActivityLog[]);

        setLoading(false);
    };

    // Save invoice ref & e-way bill number
    const handleSaveInvoiceDetails = async () => {
        if (!job) return;
        setUploading(true);

        await supabase
            .from('jobs')
            .update({
                invoice_reference: invoiceRef || null,
                eway_bill_number: ewayBillNo || null,
            })
            .eq('id', job.id);

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        setUploading(false);

        // Notify dispatch that invoice is ready
        if (invoiceRef) {
            try {
                await supabase.from('broadcast_notifications').insert({
                    message: `✅ Invoice ready for ${job.job_number}\nInvoice: ${invoiceRef}${ewayBillNo ? `\nE-Way Bill: ${ewayBillNo}` : ''}\nJob is ready for dispatch!`,
                    target_audience: 'dispatch',
                    priority: 'normal',
                });
            } catch (err) {
                console.warn('Failed to notify dispatch:', err);
            }
        }
    };

    // Upload file (invoice PDF, e-way bill PDF)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileLabel: string) => {
        const file = e.target.files?.[0];
        if (!file || !job) return;
        setUploading(true);

        const ext = file.name.split('.').pop() || 'pdf';
        const fileName = `${job.job_number}_${fileLabel.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
        const filePath = `jobs/${job.id}/${fileName}`;

        const { error } = await supabase.storage
            .from('attachments')
            .upload(filePath, file);

        if (error) {
            console.error('Upload failed:', error);
            alert(`Upload failed: ${error.message}`);
            setUploading(false);
            e.target.value = '';
            return;
        }

        const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);

        // Add to job files array
        const newFile = {
            name: `${fileLabel}: ${file.name}`,
            url: urlData.publicUrl,
            type: file.type,
            size: file.size,
            uploaded_at: new Date().toISOString(),
        };

        const updatedFiles = [...(job.files || []), newFile];
        await supabase
            .from('jobs')
            .update({ files: updatedFiles })
            .eq('id', job.id);

        setJob({ ...job, files: updatedFiles });
        setUploadedFiles(prev => [...prev, { label: fileLabel, name: file.name }]);

        setUploading(false);
        e.target.value = '';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin text-gray-400 w-6 h-6" />
            </div>
        );
    }

    if (!job) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <p className="text-gray-500">Job not found</p>
                <Link href="/admin/jobs" className="text-blue-600 hover:underline text-sm">← Back to Jobs</Link>
            </div>
        );
    }

    const latestQC = qcRecords[0];
    const hasInvoice = (job.invoices && job.invoices.length > 0) || !!invoiceRef;
    const profit = (job.total_amount || 0) - totalExpense;
    const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="max-w-4xl space-y-4 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex items-start gap-3">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg mt-0.5">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl lg:text-page-title text-gray-900 font-bold">{job.job_number}</h1>
                        <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${stageColor[job.current_stage] || 'bg-gray-100 text-gray-700'}`}>
                            {stageLabel[job.current_stage] || job.current_stage}
                        </span>
                        {job.priority && job.priority !== 'normal' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">{job.priority}</span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{job.client?.company || job.client?.name}</p>
                    <p className="text-sm text-gray-900 font-medium">{job.project_name}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>Qty: <span className="font-medium text-gray-700">{job.quantity}</span></span>
                        {job.product_category && <span>Product: <span className="font-medium text-gray-700">{job.product_category}</span></span>}
                        {job.client_deadline && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Due: <span className="font-medium text-gray-700">{new Date(job.client_deadline).toLocaleDateString()}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Financial Summary — Bold & Clear */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-blue-600 font-medium">Revenue</p>
                    <p className="text-sm font-bold text-blue-900">{formatCurrency(job.total_amount || 0)}</p>
                </div>
                <div className="bg-red-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-red-600 font-medium">Expense</p>
                    <p className="text-sm font-bold text-red-900">{formatCurrency(totalExpense)}</p>
                </div>
                <div className={`${profit >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg px-3 py-2`}>
                    <p className={`text-[10px] font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit >= 0 ? 'Profit' : 'Loss'}
                    </p>
                    <p className={`text-sm font-bold ${profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>{formatCurrency(Math.abs(profit))}</p>
                </div>
                <div className={`${(job as any).amount_received >= job.total_amount ? 'bg-green-50' : 'bg-amber-50'} rounded-lg px-3 py-2`}>
                    <p className={`text-[10px] font-medium ${(job as any).amount_received >= job.total_amount ? 'text-green-600' : 'text-amber-600'}`}>Paid</p>
                    <p className={`text-sm font-bold ${(job as any).amount_received >= job.total_amount ? 'text-green-900' : 'text-amber-900'}`}>
                        {formatCurrency((job as any).amount_received || 0)}
                    </p>
                </div>
            </div>

            {/* Packing Details (from QC) */}
            {job.packing_info && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-green-900 flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4" />
                        Packing Details (from QC)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <p className="text-xs text-green-700">Verified Qty</p>
                            <p className="text-sm font-semibold text-green-900">{job.packing_info.verified_qty}</p>
                        </div>
                        <div>
                            <p className="text-xs text-green-700">Packages</p>
                            <p className="text-sm font-semibold text-green-900">{job.packing_info.package_count} {job.packing_info.package_type}(s)</p>
                        </div>
                        <div>
                            <p className="text-xs text-green-700">Approx Weight</p>
                            <p className="text-sm font-semibold text-green-900">~{job.packing_info.approx_weight_kg} kg</p>
                        </div>
                        {job.packing_info.packing_notes && (
                            <div>
                                <p className="text-xs text-green-700">Notes</p>
                                <p className="text-sm text-green-900">{job.packing_info.packing_notes}</p>
                            </div>
                        )}
                    </div>
                    {latestQC && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            QC by {latestQC.performed_by_name} · {new Date(latestQC.created_at).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            {/* Invoice & E-Way Bill Section */}
            <div className={`border rounded-lg p-4 ${hasInvoice ? 'bg-white border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <h3 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${hasInvoice ? 'text-green-900' : 'text-amber-900'}`}>
                    <FileText className="w-4 h-4" />
                    Invoice & E-Way Bill
                    {hasInvoice && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Added</span>}
                    {!hasInvoice && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Pending</span>}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="text-xs text-gray-600 mb-1 block">Invoice Reference No.</label>
                        <input
                            type="text"
                            value={invoiceRef}
                            onChange={e => setInvoiceRef(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                            placeholder="e.g. INV-2026-001"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600 mb-1 block">E-Way Bill Number</label>
                        <input
                            type="text"
                            value={ewayBillNo}
                            onChange={e => setEwayBillNo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                            placeholder="e.g. EWB123456789"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm transition-colors">
                        <Upload className="w-4 h-4 text-gray-600" />
                        Upload Invoice PDF
                        <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={e => handleFileUpload(e, 'Invoice')} />
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm transition-colors">
                        <Upload className="w-4 h-4 text-gray-600" />
                        Upload E-Way Bill
                        <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={e => handleFileUpload(e, 'E-Way Bill')} />
                    </label>
                </div>

                {/* Upload confirmation */}
                {uploadedFiles.length > 0 && (
                    <div className="mb-3 space-y-1">
                        {uploadedFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                <span className="text-green-800 font-medium">{f.label}:</span>
                                <span className="text-green-700 truncate">{f.name}</span>
                                <span className="text-green-500">uploaded ✓</span>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    onClick={handleSaveInvoiceDetails}
                    disabled={uploading}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    {uploading ? 'Saving...' : saved ? '✓ Saved & Dispatch Notified' : 'Save & Notify Dispatch'}
                </button>
            </div>

            {/* QC Report */}
            {qcRecords.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                        <ClipboardCheck className="w-4 h-4" />
                        QC Report
                    </h3>
                    {qcRecords.map((qc) => (
                        <div key={qc.id} className="mb-4 last:mb-0">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${qc.result === 'passed' ? 'bg-green-100 text-green-700' :
                                    qc.result === 'rework' ? 'bg-amber-100 text-amber-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {qc.result === 'passed' ? '✅ Passed' : qc.result === 'rework' ? '⚠️ Rework' : '❌ Failed'}
                                </span>
                                <span className="text-xs text-gray-500">{qc.qc_type === 'post_print' ? 'QC-Dispatch' : 'Pre-Print'}</span>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-500">{new Date(qc.created_at).toLocaleString()}</span>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-500">By {qc.performed_by_name}</span>
                            </div>
                            {qc.checklist && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                                    {Object.entries(qc.checklist).map(([item, passed]) => (
                                        <div key={item} className="flex items-center gap-1.5 text-xs">
                                            {passed ? (
                                                <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                            )}
                                            <span className={passed ? 'text-gray-700' : 'text-red-600 font-medium'}>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {qc.notes && (
                                <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">Notes: {qc.notes}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Files */}
            {job.files && job.files.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4" />
                        Files ({job.files.length})
                    </h3>
                    <div className="space-y-2">
                        {job.files.map((file, i) => (
                            <a
                                key={i}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                    <Download className="w-4 h-4 text-gray-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-900 truncate">{file.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : ''}
                                        {file.size ? ` · ${(file.size / 1024).toFixed(0)} KB` : ''}
                                    </p>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Activity Timeline */}
            <div className="bg-white border border-gray-100 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" />
                    Activity Timeline
                </h3>
                {activityLogs.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No activity recorded yet</p>
                ) : (
                    <div className="space-y-0">
                        {activityLogs.map((log, i) => (
                            <div key={log.id} className="flex gap-3 py-2 relative">
                                {/* timeline line */}
                                {i < activityLogs.length - 1 && (
                                    <div className="absolute left-[11px] top-8 bottom-0 w-px bg-gray-200" />
                                )}
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 z-10">
                                    {log.action === 'create' ? <Package className="w-3 h-3 text-blue-600" /> :
                                        log.action === 'update' ? <Clock className="w-3 h-3 text-amber-600" /> :
                                            log.action === 'upload' ? <Upload className="w-3 h-3 text-violet-600" /> :
                                                log.action === 'approve' ? <CheckCircle className="w-3 h-3 text-green-600" /> :
                                                    <Clock className="w-3 h-3 text-gray-500" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-900">{log.description}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                                        {(log.profiles as any)?.full_name && (
                                            <span className="text-xs text-gray-400">· {(log.profiles as any).full_name}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Job Info Summary at bottom */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Job Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div><span className="text-gray-500">Client:</span> <span className="font-medium text-gray-900">{job.client?.company || job.client?.name || '-'}</span></div>
                    <div><span className="text-gray-500">Contact:</span> <span className="font-medium text-gray-900">{job.client?.phone || '-'}</span></div>
                    <div><span className="text-gray-500">Job Type:</span> <span className="font-medium text-gray-900">{job.job_type || '-'}</span></div>
                    <div><span className="text-gray-500">Order Date:</span> <span className="font-medium text-gray-900">{new Date(job.order_date).toLocaleDateString()}</span></div>
                    <div><span className="text-gray-500">Total:</span> <span className="font-medium text-gray-900">₹{job.total_amount?.toLocaleString() || '0'}</span></div>
                    <div><span className="text-gray-500">Payment:</span> <span className="font-medium text-gray-900">{job.payment_status}</span></div>
                    {job.vendor && <div><span className="text-gray-500">Vendor:</span> <span className="font-medium text-gray-900">{job.vendor.company || job.vendor.name}</span></div>}
                    {job.notes && <div className="col-span-2"><span className="text-gray-500">Notes:</span> <span className="text-gray-900"> {job.notes}</span></div>}
                </div>
            </div>
        </div>
    );
}
