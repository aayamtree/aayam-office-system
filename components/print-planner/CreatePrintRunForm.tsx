'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Printer, Users, X, Calendar, IndianRupee, CheckCircle, Plus } from 'lucide-react';
import { QuickAddMachine, QuickAddSheetSize, QuickAddMaterial } from '@/components/print-planner/QuickAddModals';

interface PendingJob {
    id: string;
    job_number: string;
    project_name: string;
    client_name: string;
    job_type: string;
    quantity?: number;
}

interface Vendor {
    id: string;
    name: string;
}

interface CreatePrintRunFormProps {
    selectedJobs: PendingJob[];
    onRemoveJob: (jobId: string) => void;
    onClear: () => void;
    onSuccess: () => void;
}

export function CreatePrintRunForm({ selectedJobs, onRemoveJob, onClear, onSuccess }: CreatePrintRunFormProps) {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(false);

    // Form state
    const [vendorId, setVendorId] = useState('');
    const [machineId, setMachineId] = useState('');
    const [sheetSizeId, setSheetSizeId] = useState('');
    const [materialId, setMaterialId] = useState('');
    const [deadline, setDeadline] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [notes, setNotes] = useState('');

    // Dropdowns data
    const [machines, setMachines] = useState<any[]>([]);
    const [sheetSizes, setSheetSizes] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);

    // QuickAdd modal states
    const [showMachineModal, setShowMachineModal] = useState(false);
    const [showSheetModal, setShowSheetModal] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);

    useEffect(() => {
        fetchVendors();
        fetchDropdownData();
    }, []);

    const fetchVendors = async () => {
        const { data } = await supabase.from('vendors').select('*').eq('is_active', true);
        setVendors(data || []);
    };

    const fetchDropdownData = async () => {
        const [m, s, mat] = await Promise.all([
            supabase.from('machines').select('*').eq('is_active', true),
            supabase.from('sheet_sizes').select('*').eq('is_active', true),
            supabase.from('materials').select('*').eq('is_active', true)
        ]);
        setMachines(m.data || []);
        setSheetSizes(s.data || []);
        setMaterials(mat.data || []);
    };

    const uniqueClients = Array.from(new Set(selectedJobs.map(j => j.client_name)));
    const lockedJobType = selectedJobs.length > 0 ? selectedJobs[0].job_type : null;
    const isMultiClient = uniqueClients.length > 1;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedJobs.length === 0) {
            alert('Please add at least one job');
            return;
        }
        if (!vendorId) {
            alert('Please select a vendor');
            return;
        }

        setLoading(true);
        try {
            // Create print run
            const { data: printRun, error: printRunError } = await supabase
                .from('print_runs')
                .insert({
                    machine_id: machineId || null,
                    sheet_size_id: sheetSizeId || null,
                    material_id: materialId || null,
                    vendor_id: vendorId,
                    deadline: deadline || null,
                    total_amount: totalAmount ? parseFloat(totalAmount) : null,
                    status: 'planned',
                    notes
                })
                .select()
                .single();

            if (printRunError) throw printRunError;

            // Add jobs to print run
            const jobsToAdd = selectedJobs.map(job => ({
                print_run_id: printRun.id,
                job_id: job.id,
                client_name: job.client_name,
                item_name: job.project_name,
                quantity_needed: job.quantity || 0,
                ups_in_sheet: 1,
                job_type: job.job_type
            }));

            const { error: jobsError } = await supabase
                .from('print_run_jobs')
                .insert(jobsToAdd);

            if (jobsError) throw jobsError;

            // Success!
            onSuccess();
            onClear();
            resetForm();
        } catch (error: any) {
            console.error('Error creating print run:', error);
            alert('Error creating print run: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setVendorId('');
        setMachineId('');
        setSheetSizeId('');
        setMaterialId('');
        setDeadline('');
        setTotalAmount('');
        setNotes('');
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-md border border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                            <Printer className="text-gray-700" size={20} />
                        </div>
                        <div>
                            <h2 className="text-page-title text-gray-900">Create Print Run</h2>
                            <p className="text-sm text-gray-500">Batch jobs for printing</p>
                        </div>
                    </div>
                    {selectedJobs.length > 0 && (
                        <button
                            onClick={onClear}
                            className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-all"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {/* Job Type Lock Badge */}
                {lockedJobType && (
                    <div className={`p-3 rounded-md border ${isMultiClient
                        ? 'bg-gray-100 border-gray-300'
                        : 'bg-gray-50 border-gray-300'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {isMultiClient ? (
                                    <>
                                        <Users size={16} className="text-gray-700" />
                                        <span className="text-sm font-bold text-gray-900">MULTI-CLIENT BATCH</span>
                                    </>
                                ) : (
                                    <span className="text-sm font-bold text-gray-900">SINGLE CLIENT</span>
                                )}
                                <span className="px-2 py-0.5 bg-white rounded text-xs font-bold text-gray-700">
                                    {lockedJobType}
                                </span>
                            </div>
                            <span className="text-xs text-gray-600 font-medium">
                                {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Vendor Selection */}
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
                        <option value="">Select vendor...</option>
                        {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>

                {/* Print Specifications */}
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
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-gray-700">Sheet Size</label>
                            <button
                                type="button"
                                onClick={() => setShowSheetModal(true)}
                                className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1"
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>
                        <select
                            value={sheetSizeId}
                            onChange={(e) => setSheetSizeId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                        >
                            <option value="">Select...</option>
                            {sheetSizes.map(s => (
                                <option key={s.id} value={s.id}>{s.size}</option>
                            ))}
                        </select>
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

                {/* Deadline & Amount */}
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
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
                            <IndianRupee size={16} className="inline mr-1" />
                            Total Amount
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                        />
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Special instructions..."
                        className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none outline-none"
                    />
                </div>

                {/* Selected Jobs */}
                {selectedJobs.length > 0 && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">
                            Selected Jobs ({selectedJobs.length})
                        </label>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {selectedJobs.map(job => (
                                <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{job.job_number}</p>
                                        <p className="text-xs text-gray-500">
                                            {job.client_name} • {job.project_name}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveJob(job.id)}
                                        className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md transition-all"
                                    >
                                        <X size={16} />
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

            {/* QuickAdd Modals - Conditionally Rendered */}
            {showMachineModal && (
                <QuickAddMachine
                    onClose={() => setShowMachineModal(false)}
                    onAdded={() => {
                        fetchDropdownData();
                        setShowMachineModal(false);
                    }}
                />
            )}
            {showSheetModal && (
                <QuickAddSheetSize
                    onClose={() => setShowSheetModal(false)}
                    onAdded={() => {
                        fetchDropdownData();
                        setShowSheetModal(false);
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
