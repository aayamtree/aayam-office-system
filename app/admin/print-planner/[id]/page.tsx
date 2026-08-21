'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { ArrowLeft, Plus, Trash2, CheckCircle, Printer, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncRunJobsToStage, revertJobsToReadyToPrint } from '@/lib/print-run-sync';
import type { PrintRun, PrintRunJob, Job } from '@/types/database';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ConfirmModal';
import ProductBadge from '@/components/shared/ProductBadge';
import { runProductCategory } from '@/lib/product-category';

export default function PrintRunDetailPage() {
    const params = useParams();
    const router = useRouter();
    const printRunId = params.id as string;
    const confirm = useConfirm();


    const [printRun, setPrintRun] = useState<PrintRun | null>(null);
    const [printRunJobs, setPrintRunJobs] = useState<PrintRunJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddJobsModal, setShowAddJobsModal] = useState(false);

    useEffect(() => {
        if (printRunId) {
            fetchPrintRunDetails();
        }
    }, [printRunId]);

    const fetchPrintRunDetails = async () => {
        try {
            // Fetch print run with relations
            const { data: runData, error: runError } = await supabase
                .from('print_runs')
                .select(`
          *,
          machine:machines(*),
          sheet_size:sheet_sizes(*),
          material:materials(*)
        `)
                .eq('id', printRunId)
                .single();

            if (runError) throw runError;
            setPrintRun(runData);

            // Fetch jobs in this print run
            const { data: jobsData, error: jobsError } = await supabase
                .from('print_run_jobs')
                .select(`
          *,
          job:jobs(
            id,
            job_number,
            project_name,
            product_category,
            quantity,
            client:clients(name,company)
          )
        `)
                .eq('print_run_id', printRunId)
                .order('added_at', { ascending: false });

            if (jobsError) throw jobsError;
            setPrintRunJobs(jobsData || []);
        } catch (error) {
            console.error('Error fetching print run details:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (newStatus: 'planned' | 'at_printer' | 'printing_done' | 'qc' | 'dispatched') => {
        try {
            const { error } = await supabase
                .from('print_runs')
                .update({ status: newStatus })
                .eq('id', printRunId);

            if (error) throw error;

            setPrintRun(prev => prev ? { ...prev, status: newStatus } : null);

            // Keep the Jobs board in sync with the run's new status.
            await syncRunJobsToStage(printRunId);

            await supabase.from('activity_logs').insert([{
                action: 'updated',
                module: 'print_runs',
                details: { print_run_id: printRunId, new_status: newStatus }
            }]);
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const removeJob = async (jobId: string) => {
        const { confirmed } = await confirm({ title: 'Remove Job', message: 'Remove this job from the print run?', variant: 'danger', confirmLabel: 'Remove' });
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('print_run_jobs')
                .delete()
                .eq('print_run_id', printRunId)
                .eq('job_id', jobId);

            if (error) throw error;
            // Pulled out of the run → send back to Ready to Print (only if still in printing).
            await revertJobsToReadyToPrint([jobId]);
            fetchPrintRunDetails();
        } catch (error) {
            console.error('Error removing job:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
        );
    }

    if (!printRun) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">Print run not found</p>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'planned': return 'bg-amber-100 text-amber-800 border-amber-300';
            case 'at_printer': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'printing_done': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'qc': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'dispatched': return 'bg-green-100 text-green-800 border-green-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 max-w-7xl">
            {/* Header */}
            <div>
                <div>
                    <Link
                        href="/admin/print-planner"
                        className="inline-flex items-center gap-2 text-primary hover:text-gray-800 font-medium mb-4 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back to Print Planner
                    </Link>

                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 md:gap-4 mb-2">
                                <h1 className="text-page-title text-gray-900 flex items-center gap-3">
                                    <Printer className="text-primary" size={32} />
                                    {printRun.print_run_number}
                                    <ProductBadge category={runProductCategory(printRunJobs.map((p: any) => ({ product_category: p.product_category || p.job?.product_category })))} size="sm" />
                                </h1>
                                <span className={`px-4 py-2 rounded-md text-sm font-bold border-2 ${getStatusColor(printRun.status)}`} style={{ textTransform: 'capitalize' }}>
                                    {printRun.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 md:gap-4 text-sm text-gray-600">
                                <span><strong>Machine:</strong> {printRun.machine?.name || 'Not set'}</span>
                                <span><strong>Size:</strong> {printRun.sheet_size?.size || 'Not set'}</span>
                                <span><strong>Material:</strong> {printRun.material?.name || 'Not set'}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {printRun.status === 'planned' && (
                                <button
                                    onClick={() => updateStatus('at_printer')}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-md font-bold hover:bg-gray-800 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle size={20} />
                                    Send to Printer
                                </button>
                            )}
                            {printRun.status === 'at_printer' && (
                                <button
                                    onClick={() => updateStatus('printing_done')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle size={20} />
                                    Printing Done
                                </button>
                            )}
                            <button
                                onClick={() => setShowAddJobsModal(true)}
                                className="px-4 py-2 bg-gray-900 text-white rounded-md font-bold  transition-all flex items-center gap-2"
                            >
                                <Plus size={20} />
                                Add Jobs
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {/* Summary */}
                <div className="bg-white rounded-md md:rounded-md p-3 md:p-4 border border-gray-100">
                    <h2 className="text-section text-gray-900 mb-4">Print Run Summary</h2>
                    <div className="grid grid-cols-5 gap-3 md:gap-4">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Total Jobs</p>
                            <p className="text-page-title text-primary">{printRunJobs.length}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Total Sheets</p>
                            <p className="text-page-title text-primary">
                                {printRunJobs.reduce((sum, job) => {
                                    const sheets = Math.ceil((job.quantity_needed || 0) / (job.ups_in_sheet || 1));
                                    return sum + sheets;
                                }, 0)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Created Date</p>
                            <p className="text-section text-gray-900">
                                {new Date(printRun.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Status</p>
                            <p className="text-section text-gray-900 capitalize">{printRun.status}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{printRun.notes || 'None'}</p>
                        </div>
                    </div>
                </div>

                {/* Jobs Table */}
                <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-section text-gray-900">Jobs in This Print Run</h2>
                    </div>

                    {printRunJobs.length === 0 ? (
                        <div className="p-12 text-center">
                            <Printer className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No jobs added yet</p>
                            <p className="text-sm text-gray-400 mt-1">Click &quot;Add Jobs&quot; to add client jobs to this print run</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Job #</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Client</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Item Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Qty Needed</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Ups</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Sheets</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Version</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {printRunJobs.map((prj) => (
                                        <tr key={prj.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={`/admin/jobs/${prj.job_id}`}
                                                    className="font-mono text-sm text-primary hover:text-gray-800 font-bold"
                                                >
                                                    {(prj.job as any)?.job_number || 'N/A'}
                                                </Link>
                                                <ProductBadge category={(prj as any).product_category || (prj.job as any)?.product_category} className="ml-2" />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                {prj.client_name || (prj.job as any)?.client?.company || (prj.job as any)?.client?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {prj.item_name || (prj.job as any)?.project_name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                {prj.quantity_needed || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                {prj.ups_in_sheet || 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 bg-gray-900 text-white rounded-md text-sm font-bold">
                                                    {Math.ceil((prj.quantity_needed || 0) / (prj.ups_in_sheet || 1))} sheets
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-muted text-gray-800 rounded text-xs font-bold">
                                                    {prj.file_version || 'v1'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => removeJob(prj.job_id)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                    title="Remove from print run"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Jobs Modal */}
            {showAddJobsModal && (
                <AddJobsModal
                    printRunId={printRunId}
                    onClose={() => setShowAddJobsModal(false)}
                    onJobsAdded={() => {
                        setShowAddJobsModal(false);
                        fetchPrintRunDetails();
                    }}
                />
            )}
        </div>
    );
}

// Add Jobs Modal
function AddJobsModal({
    printRunId,
    onClose,
    onJobsAdded
}: {
    printRunId: string;
    onClose: () => void;
    onJobsAdded: () => void;
}) {

    const [eligibleJobs, setEligibleJobs] = useState<any[]>([]);
    const [jobQuantities, setJobQuantities] = useState<Record<string, { quantity: number; ups: number }>>({});
    const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchEligibleJobs();
    }, []);

    const fetchEligibleJobs = async () => {
        try {
            // Get jobs that are print-ready, approved, and not already in a print run
            const { data, error } = await supabase
                .from('jobs')
                .select(`
          id,
          job_number,
          project_name,
          product_category,
          quantity,
          file_version,
          client:clients(name,company)
        `)
                .eq('print_ready', true)
                .eq('client_approval', true)
                .not('job_type', 'ilike', 'design only'); // exclude design-only jobs

            if (error) throw error;

            // Filter out jobs already in this or other print runs
            const { data: existingJobs } = await supabase
                .from('print_run_jobs')
                .select('job_id');

            const existingJobIds = new Set(existingJobs?.map(j => j.job_id) || []);
            const eligible = (data || []).filter(j => !existingJobIds.has(j.id));

            setEligibleJobs(eligible);

            // Initialize quantities with job's quantity if available
            const initialQuantities: Record<string, { quantity: number; ups: number }> = {};
            eligible.forEach(job => {
                initialQuantities[job.id] = {
                    quantity: job.quantity || 0,
                    ups: 1
                };
            });
            setJobQuantities(initialQuantities);
        } catch (error) {
            console.error('Error fetching eligible jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleJob = (jobId: string) => {
        setSelectedJobs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(jobId)) {
                newSet.delete(jobId);
            } else {
                newSet.add(jobId);
            }
            return newSet;
        });
    };

    const updateJobQuantity = (jobId: string, field: 'quantity' | 'ups', value: number) => {
        setJobQuantities(prev => ({
            ...prev,
            [jobId]: {
                ...prev[jobId],
                [field]: value
            }
        }));
    };

    const calculateSheets = (quantity: number, ups: number): number => {
        if (ups <= 0) return 0;
        return Math.ceil(quantity / ups);
    };

    const handleSubmit = async () => {
        if (selectedJobs.size === 0) return;

        setSubmitting(true);
        try {
            const jobsToAdd = eligibleJobs
                .filter(j => selectedJobs.has(j.id))
                .map(j => {
                    const quantities = jobQuantities[j.id] || { quantity: 0, ups: 1 };
                    return {
                        print_run_id: printRunId,
                        job_id: j.id,
                        client_name: j.client?.company || j.client?.name,
                        item_name: j.project_name,
                        file_version: j.file_version || 'v1',
                        quantity_needed: quantities.quantity,
                        ups_in_sheet: quantities.ups
                    };
                });

            const { error } = await supabase
                .from('print_run_jobs')
                .insert(jobsToAdd);

            if (error) throw error;

            // If the run is already sent to the printer, freshly-added jobs should
            // immediately reflect the run's stage on the Jobs board.
            await syncRunJobsToStage(printRunId);

            await supabase.from('activity_logs').insert([{
                action: 'updated',
                module: 'print_runs',
                details: { print_run_id: printRunId, jobs_added: selectedJobs.size }
            }]);

            onJobsAdded();
        } catch (error) {
            console.error('Error adding jobs:', error);
            toast.error('Failed to add jobs');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-md w-full max-w-4xl  overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-gray-900 p-4 text-white flex items-center justify-between sticky top-0">
                    <div>
                        <h3 className="text-page-title">Add Jobs to Print Run</h3>
                        <p className="text-white/80 text-sm mt-1">
                            Select print-ready jobs below ({selectedJobs.size} selected)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-md transition-all">
                        ✕
                    </button>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                        </div>
                    ) : eligibleJobs.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No eligible jobs found</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Jobs must be print-ready, client-approved, and not in another print run
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 mb-3 md:mb-1.5">
                                {eligibleJobs.map((job) => {
                                    const isSelected = selectedJobs.has(job.id);
                                    const quantities = jobQuantities[job.id] || { quantity: 0, ups: 1 };
                                    const sheets = calculateSheets(quantities.quantity, quantities.ups);

                                    return (
                                        <div
                                            key={job.id}
                                            className={`p-4 rounded-md border-2 transition-all ${isSelected
                                                ? 'bg-gray-900 border-gray-300'
                                                : 'bg-white border-gray-200'
                                                }`}
                                        >
                                            <div className="flex items-start gap-2 md:gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleJob(job.id)}
                                                    className="h-5 w-5 text-primary rounded focus:ring-gray-400 mt-1"
                                                />

                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-mono text-sm font-bold text-primary">
                                                            {job.job_number}
                                                        </span>
                                                        <span className="font-medium text-gray-900">{job.project_name}</span>
                                                        <ProductBadge category={(job as any).product_category} />
                                                    </div>

                                                    <div className="text-sm text-gray-600 mb-3">
                                                        Client: {job.client?.company || job.client?.name} • Version: {job.file_version || 'v1'}
                                                    </div>

                                                    {isSelected && (
                                                        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                                                    Quantity Needed
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={quantities.quantity || ''}
                                                                    onChange={(e) => updateJobQuantity(job.id, 'quantity', parseInt(e.target.value) || 0)}
                                                                    className="w-full border-2 border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 ring-primary/20 focus:border-gray-400"
                                                                    placeholder="0"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                                                    Ups (per sheet)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={quantities.ups || ''}
                                                                    onChange={(e) => updateJobQuantity(job.id, 'ups', parseInt(e.target.value) || 1)}
                                                                    className="w-full border-2 border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 ring-primary/20 focus:border-gray-400"
                                                                    placeholder="1"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                                                    Sheets Required
                                                                </label>
                                                                <div className="w-full border-2 border-gray-300 bg-gray-900 rounded-md px-3 py-2 text-sm font-bold text-primary">
                                                                    {sheets} sheets
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex gap-2 md:gap-4 justify-end border-t-2 border-gray-100 pt-4">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 border-2 border-gray-300 rounded-md font-bold text-gray-700 hover:bg-gray-100 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={selectedJobs.size === 0 || submitting}
                                    className="px-8 py-2 bg-gray-900 text-white rounded-md font-bold  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Adding...' : `Add ${selectedJobs.size} Job${selectedJobs.size !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
