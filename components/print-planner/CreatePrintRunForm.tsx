'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Printer, X, Calendar, IndianRupee, CheckCircle, Plus, Truck, Edit3 } from 'lucide-react';
import { QuickAddMachine, QuickAddMaterial } from '@/components/print-planner/QuickAddModals';

interface ConfiguredJob {
    id: string;
    job_number: string;
    project_name: string;
    client_name: string;
    job_type: string;
    quantity?: number;
    quantity_needed: number;
    ups_in_sheet: number;
}

interface VendorItem {
    id: string;
    name: string;
    category?: string;
}

interface CreatePrintRunFormProps {
    selectedJobs: ConfiguredJob[];
    onRemoveJob: (jobId: string) => void;
    onClear: () => void;
    onSuccess: () => void;
    sheetSize: string;
    pullingMultiple: number;
}

const GST_OPTIONS = [0, 5, 12, 18, 28];

export function CreatePrintRunForm({ selectedJobs, onRemoveJob, onClear, onSuccess, sheetSize, pullingMultiple }: CreatePrintRunFormProps) {
    const [allVendors, setAllVendors] = useState<VendorItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Pulling sheets — editable, starts from Step 2 value
    const [editablePulling, setEditablePulling] = useState(pullingMultiple);

    // Form state
    const [vendorId, setVendorId] = useState('');
    const [machineId, setMachineId] = useState('');
    const [materialId, setMaterialId] = useState('');
    const [deadline, setDeadline] = useState('');
    const [printingCharge, setPrintingCharge] = useState('');
    const [notes, setNotes] = useState('');

    // Paper supply state
    const [sendingPaper, setSendingPaper] = useState(false);
    const [paperVendorId, setPaperVendorId] = useState('');
    const [paperQty, setPaperQty] = useState('');
    const [paperRate, setPaperRate] = useState('');
    const [paperGst, setPaperGst] = useState(18);
    const [paperPaymentStatus, setPaperPaymentStatus] = useState<'paid' | 'pending'>('pending');
    const [paperPaymentMode, setPaperPaymentMode] = useState<string>('cash');

    // Dropdowns data
    const [machines, setMachines] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);

    // QuickAdd modal states
    const [showMachineModal, setShowMachineModal] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);

    // Computed paper amounts
    const paperAmount = (parseFloat(paperQty) || 0) * (parseFloat(paperRate) || 0);
    const paperGstAmount = paperAmount * (paperGst / 100);
    const paperTotalWithGst = paperAmount + paperGstAmount;

    // Filter vendors: paper vendors only for paper dropdown
    const paperVendors = allVendors.filter(v =>
        v.category?.toLowerCase().includes('paper')
    );

    // Update editable pulling when prop changes (e.g. going back to step 2 and returning)
    useEffect(() => {
        setEditablePulling(pullingMultiple);
    }, [pullingMultiple]);

    useEffect(() => {
        fetchVendors();
        fetchDropdownData();
    }, []);

    const fetchVendors = async () => {
        const { data } = await supabase.from('vendors').select('id, name, category').eq('is_active', true);
        setAllVendors(data || []);
    };

    const fetchDropdownData = async () => {
        const [m, mat] = await Promise.all([
            supabase.from('machines').select('*').eq('is_active', true),
            supabase.from('materials').select('*').eq('is_active', true)
        ]);
        setMachines(m.data || []);
        setMaterials(mat.data || []);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedJobs.length === 0) {
            toast.error('Please add at least one job to the print run.');
            return;
        }
        if (!vendorId) {
            toast.error('Please select a print vendor.');
            return;
        }

        setLoading(true);
        try {
            // Build insert data
            const insertData: Record<string, any> = {
                machine_id: machineId || null,
                sheet_size_id: null,
                material_id: materialId || null,
                vendor_id: vendorId,
                deadline: deadline || null,
                total_amount: printingCharge ? parseFloat(printingCharge) : null,
                status: 'planned',
                notes: notes || null,
                sheet_size_label: sheetSize,
                pulling_multiple: editablePulling,
            };

            // Paper supply fields
            if (sendingPaper) {
                insertData.paper_vendor_id = paperVendorId || null;
                insertData.paper_qty = paperQty ? parseInt(paperQty) : null;
                insertData.paper_rate = paperRate ? parseFloat(paperRate) : null;
                insertData.paper_gst_percent = paperGst;
                insertData.paper_total = paperTotalWithGst || null;
                insertData.paper_payment_status = paperPaymentStatus;
                if (paperPaymentStatus === 'paid') {
                    insertData.paper_payment_mode = paperPaymentMode;
                }
            }

            // Create print run
            const { data: printRun, error: printRunError } = await supabase
                .from('print_runs')
                .insert(insertData)
                .select('id, print_run_number')
                .single();

            if (printRunError) {
                throw printRunError;
            }

            // Add jobs
            await addJobsToPrintRun(printRun.id);

            // Financial records for paper supply
            if (sendingPaper && paperVendorId && paperTotalWithGst > 0) {
                const refText = `Paper for ${printRun.print_run_number} - ${selectedJobs.map(j => j.job_number).join(', ')}`;
                const noteText = `Paper supply: ${paperQty} sheets × ₹${paperRate}/sheet + ${paperGst}% GST = ₹${paperTotalWithGst.toFixed(2)}`;

                if (paperPaymentStatus === 'paid') {
                    // Record as paid vendor payment
                    try {
                        await supabase.rpc('record_vendor_payment', {
                            p_vendor_id: paperVendorId,
                            p_amount: paperTotalWithGst,
                            p_payment_mode: paperPaymentMode,
                            p_payment_date: new Date().toISOString().split('T')[0],
                            p_bank_account_id: null,
                            p_reference: refText,
                            p_notes: noteText,
                            p_purchase_bill_id: null,
                            p_attachment_url: null
                        });
                    } catch (err) {
                        console.warn('Could not record vendor payment:', err);
                    }
                } else {
                    // Record as pending purchase bill (shows as outstanding in finance)
                    try {
                        await supabase.from('purchase_bills').insert({
                            vendor_id: paperVendorId,
                            product_type: 'Paper',
                            description: refText,
                            quantity: parseInt(paperQty) || 0,
                            rate: parseFloat(paperRate) || 0,
                            subtotal: paperAmount,
                            gst_rate: paperGst,
                            gst_amount: paperGstAmount,
                            total_amount: paperTotalWithGst,
                            payment_status: 'pending',
                            amount_paid: 0,
                            bill_date: new Date().toISOString().split('T')[0],
                        });
                    } catch (err) {
                        console.warn('Could not create purchase bill:', err);
                    }
                }
            }

            // Success!
            onSuccess();
            onClear();
            resetForm();
        } catch (error: any) {
            toast.error('Error creating print run: ' + (error.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const addJobsToPrintRun = async (printRunId: string) => {
        const jobsToAdd = selectedJobs.map(job => ({
            print_run_id: printRunId,
            job_id: job.id,
            client_name: job.client_name,
            item_name: job.project_name,
            quantity_needed: job.quantity_needed,
            ups_in_sheet: job.ups_in_sheet,
            job_type: job.job_type
        }));

        const { error: jobsError } = await supabase
            .from('print_run_jobs')
            .insert(jobsToAdd);

        if (jobsError) throw jobsError;
    };

    const resetForm = () => {
        setVendorId('');
        setMachineId('');
        setMaterialId('');
        setDeadline('');
        setPrintingCharge('');
        setNotes('');
        setSendingPaper(false);
        setPaperVendorId('');
        setPaperQty('');
        setPaperRate('');
        setPaperGst(18);
        setPaperPaymentStatus('pending');
        setPaperPaymentMode('cash');
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-md border border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                        <Printer className="text-gray-700" size={20} />
                    </div>
                    <div>
                        <h2 className="text-page-title text-gray-900">Print Specifications</h2>
                        <p className="text-sm text-gray-500">Set machine, material, vendor & paper details</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Print Vendor Selection */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Print Vendor *
                    </label>
                    <select
                        required
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all outline-none"
                    >
                        <option value="">Select print vendor...</option>
                        {allVendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name} {v.category && `(${v.category})`}</option>
                        ))}
                    </select>
                </div>

                {/* Machine, Sheet Size (read-only), Material */}
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-gray-700">Machine</label>
                            <button
                                type="button"
                                onClick={() => setShowMachineModal(true)}
                                className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1"
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>
                        <select
                            value={machineId}
                            onChange={(e) => setMachineId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                        >
                            <option value="">Select...</option>
                            {machines.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Sheet Size</label>
                        <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-medium text-gray-700">
                            {sheetSize}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-gray-700">Material</label>
                            <button
                                type="button"
                                onClick={() => setShowMaterialModal(true)}
                                className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1"
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>
                        <select
                            value={materialId}
                            onChange={(e) => setMaterialId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                        >
                            <option value="">Select...</option>
                            {materials.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Pulling Sheets (editable), Deadline, Printing Charge */}
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            <Edit3 size={14} className="inline mr-1" />
                            Pulling Sheets
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={editablePulling}
                            onChange={(e) => setEditablePulling(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            <Calendar size={14} className="inline mr-1" />
                            Deadline
                        </label>
                        <input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            <IndianRupee size={14} className="inline mr-1" />
                            Printing Charge
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={printingCharge}
                            onChange={(e) => setPrintingCharge(e.target.value)}
                            placeholder="₹ 0.00"
                            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                        />
                    </div>
                </div>

                {/* Paper Supply Section */}
                <div className="border border-gray-200 rounded-md">
                    <button
                        type="button"
                        onClick={() => setSendingPaper(!sendingPaper)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-sm font-bold rounded-md transition-all ${sendingPaper
                            ? 'bg-blue-50 text-blue-800 border-b border-blue-200'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${sendingPaper ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                            }`}>
                            {sendingPaper && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <Truck size={16} />
                        We are sending paper from our vendor
                    </button>

                    {sendingPaper && (
                        <div className="p-4 space-y-4">
                            {/* Paper Vendor — filtered to paper vendors only */}
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">Paper Vendor *</label>
                                {paperVendors.length > 0 ? (
                                    <select
                                        required={sendingPaper}
                                        value={paperVendorId}
                                        onChange={(e) => setPaperVendorId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none text-sm"
                                    >
                                        <option value="">Select paper vendor...</option>
                                        {paperVendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                                        <p className="text-xs text-amber-700">
                                            No paper vendors found. Add a vendor with category &quot;Paper&quot; in <strong>Finance → Vendors</strong>.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Qty, Rate, Amount */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Paper Qty (sheets)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={paperQty}
                                        onChange={(e) => setPaperQty(e.target.value)}
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Rate (₹/sheet)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={paperRate}
                                        onChange={(e) => setPaperRate(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Amount</label>
                                    <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-bold text-gray-900">
                                        ₹{paperAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>

                            {/* GST & Total */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">GST %</label>
                                    <select
                                        value={paperGst}
                                        onChange={(e) => setPaperGst(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none text-sm font-medium"
                                    >
                                        {GST_OPTIONS.map(g => (
                                            <option key={g} value={g}>{g}%</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">GST Amount</label>
                                    <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                                        ₹{paperGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Total with GST</label>
                                    <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-green-50 text-sm font-bold text-green-700">
                                        ₹{paperTotalWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>

                            {/* Payment Status */}
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">Payment Status</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaperPaymentStatus('paid')}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${paperPaymentStatus === 'paid'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        ✓ Paid
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaperPaymentStatus('pending')}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${paperPaymentStatus === 'pending'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        ⏳ Pending
                                    </button>
                                </div>
                                {paperPaymentStatus === 'paid' && (
                                    <div className="mt-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Payment Mode *</label>
                                        <select
                                            value={paperPaymentMode}
                                            onChange={(e) => setPaperPaymentMode(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none text-sm"
                                        >
                                            <option value="cash">💵 Cash</option>
                                            <option value="bank_transfer">🏦 Bank Transfer</option>
                                            <option value="upi">📱 UPI</option>
                                            <option value="card">💳 Card</option>
                                        </select>
                                        {paperTotalWithGst > 0 && (
                                            <p className="text-xs text-green-600 mt-1.5">
                                                ✓ ₹{paperTotalWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })} will be recorded as paid via {paperPaymentMode.replace('_', ' ')} in vendor payments
                                            </p>
                                        )}
                                    </div>
                                )}
                                {paperPaymentStatus === 'pending' && paperTotalWithGst > 0 && (
                                    <p className="text-xs text-amber-600 mt-1.5">
                                        ⏳ ₹{paperTotalWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })} will be added to vendor outstanding balance
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Special instructions..."
                        className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none outline-none"
                    />
                </div>

                {/* Selected Jobs Summary */}
                {selectedJobs.length > 0 && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">
                            Jobs in this run ({selectedJobs.length})
                        </label>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {selectedJobs.map(job => (
                                <div key={job.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md">
                                    <div className="flex-1">
                                        <span className="text-xs font-bold text-gray-900">{job.job_number}</span>
                                        <span className="text-xs text-gray-500 ml-2">{job.client_name}</span>
                                        <span className="text-xs text-gray-400 ml-2">
                                            {job.quantity_needed.toLocaleString()} qty · {job.ups_in_sheet}-up · {(editablePulling * job.ups_in_sheet).toLocaleString()} prints
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveJob(job.id)}
                                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || selectedJobs.length === 0}
                    className="w-full py-4 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Creating...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={20} />
                            Create Print Run
                        </>
                    )}
                </button>
            </form>

            {/* QuickAdd Modals */}
            {showMachineModal && (
                <QuickAddMachine
                    onClose={() => setShowMachineModal(false)}
                    onAdded={() => {
                        fetchDropdownData();
                        setShowMachineModal(false);
                    }}
                />
            )}
            {showMaterialModal && (
                <QuickAddMaterial
                    onClose={() => setShowMaterialModal(false)}
                    onAdded={() => {
                        fetchDropdownData();
                        setShowMaterialModal(false);
                    }}
                />
            )}
        </div>
    );
}
