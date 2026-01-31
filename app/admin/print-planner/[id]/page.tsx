'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, CheckCircle, Printer, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PrintRun, PrintRunJob, Job } from '@/types/database';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function PrintRunDetailPage() {
    const params = useParams();
    const router = useRouter();
    const printRunId = params.id as string;


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
            quantity,
            client:clients(name)
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

    const updateStatus = async (newStatus: 'planned' | 'printed' | 'delivered') => {
        try {
            const { error } = await supabase
                .from('print_runs')
                .update({ status: newStatus })
                .eq('id', printRunId);

            if (error) throw error;

            setPrintRun(prev => prev ? { ...prev, status: newStatus } : null);

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
        if (!confirm('Remove this job from the print run?')) return;

        try {
            const { error } = await supabase
                .from('print_run_jobs')
                .delete()
                .eq('print_run_id', printRunId)
                .eq('job_id', jobId);

            if (error) throw error;
            fetchPrintRunDetails();
        } catch (error) {
            console.error('Error removing job:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(0,0,255,0.2)]-600"></div>
            </div>
        );
    }

    if (!printRun) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">Print run not found</p>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'planned': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'printed': return 'bg-[rgba(0,0,255,0.1)] text-purple-800 border-[rgba(0,0,255,0.2)]-200';
            case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-6">
                <div className="max-w-7xl mx-auto">
                    <Link
                        href="/admin/print-planner"
                        className="inline-flex items-center gap-2 text-oms-blue hover:text-indigo-800 font-medium mb-4 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back to Print Planner
                    </Link>

                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                    <Printer className="text-oms-blue" size={32} />
                                    {printRun.print_run_number}
                                </h1>
                                <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${getStatusColor(printRun.status)}`}>
                                    {printRun.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                                <span><strong>Machine:</strong> {printRun.machine?.name || 'Not set'}</span>
                                <span><strong>Size:</strong> {printRun.sheet_size?.size || 'Not set'}</span>
                                <span><strong>Material:</strong> {printRun.material?.name || 'Not set'}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {printRun.status === 'planned' && (
                                <button
                                    onClick={() => updateStatus('printed')}
                                    className="px-6 py-3 bg-[rgba(0,0,255,0.1)] text-white rounded-xl font-bold hover:bg-[rgba(0,0,255,0.1)] transition-all flex items-center gap-2"
                                >
                                    <CheckCircle size={20} />
                                    Mark as Printed
                                </button>
                            )}
                            {printRun.status === 'printed' && (
                                <button
                                    onClick={() => updateStatus('delivered')}
                                    className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle size={20} />
                                    Mark as Delivered
                                </button>
                            )}
                            <button
                                onClick={() => setShowAddJobsModal(true)}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                            >
                                <Plus size={20} />
                                Add Jobs
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Summary */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Print Run Summary</h2>
                    <div className="grid grid-cols-5 gap-6">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Total Jobs</p>
                            <p className="text-2xl font-bold text-oms-blue">{printRunJobs.length}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Total Sheets</p>
                            <p className="text-2xl font-bold text-oms-blue">
                                {printRunJobs.reduce((sum, job) => {
                                    const sheets = Math.ceil((job.quantity_needed || 0) / (job.ups_in_sheet || 1));
                                    return sum + sheets;
                                }, 0)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Created Date</p>
                            <p className="text-lg font-bold text-gray-900">
                                {new Date(printRun.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Status</p>
                            <p className="text-lg font-bold text-gray-900 capitalize">{printRun.status}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{printRun.notes || 'None'}</p>
                        </div>
                    </div>
                </div>

                {/* Jobs Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900">Jobs in This Print Run</h2>
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
                                                    className="font-mono text-sm text-oms-blue hover:text-indigo-800 font-bold"
                                                >
                                                    {(prj.job as any)?.job_number || 'N/A'}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                {prj.client_name || (prj.job as any)?.client?.name || 'N/A'}
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
                                                <span className="px-3 py-1 bg-[rgba(0,0,255,0.1)] text-indigo-800 rounded-lg text-sm font-bold">
                                                    {Math.ceil((prj.quantity_needed || 0) / (prj.ups_in_sheet || 1))} sheets
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">
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
          quantity,
          file_version,
          client:clients(name)
        `)
                .eq('print_ready', true)
                .eq('client_approval', true)
                .in('job_type', ['print_only', 'design_print']);

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
                        client_name: j.client?.name,
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

            await supabase.from('activity_logs').insert([{
                action: 'updated',
                module: 'print_runs',
                details: { print_run_id: printRunId, jobs_added: selectedJobs.size }
            }]);

            onJobsAdded();
        } catch (error) {
            console.error('Error adding jobs:', error);
            alert('Failed to add jobs');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex items-center justify-between sticky top-0">
                    <div>
                        <h3 className="text-2xl font-bold">Add Jobs to Print Run</h3>
                        <p className="text-indigo-100 text-sm mt-1">
                            Select print-ready jobs below ({selectedJobs.size} selected)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-all">
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(0,0,255,0.2)]-600"></div>
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
                            <div className="space-y-3 mb-6">
                                {eligibleJobs.map((job) => {
                                    const isSelected = selectedJobs.has(job.id);
                                    const quantities = jobQuantities[job.id] || { quantity: 0, ups: 1 };
                                    const sheets = calculateSheets(quantities.quantity, quantities.ups);

                                    return (
                                        <div
                                            key={job.id}
                                            className={`p-4 rounded-xl border-2 transition-all ${isSelected
                                                ? 'bg-[rgba(0,0,255,0.1)] border-[rgba(0,0,255,0.2)]-300'
                                                : 'bg-white border-gray-200'
                                                }`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleJob(job.id)}
                                                    className="h-5 w-5 text-oms-blue rounded focus:ring-indigo-500 mt-1"
                                                />

                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-mono text-sm font-bold text-oms-blue">
                                                            {job.job_number}
                                                        </span>
                                                        <span className="font-medium text-gray-900">{job.project_name}</span>
                                                    </div>

                                                    <div className="text-sm text-gray-600 mb-3">
                                                        Client: {job.client?.name} • Version: {job.file_version || 'v1'}
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
                                                                    value={quantities.quantity}
                                                                    onChange={(e) => updateJobQuantity(job.id, 'quantity', parseInt(e.target.value) || 0)}
                                                                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
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
                                                                    value={quantities.ups}
                                                                    onChange={(e) => updateJobQuantity(job.id, 'ups', parseInt(e.target.value) || 1)}
                                                                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500"
                                                                    placeholder="1"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                                                    Sheets Required
                                                                </label>
                                                                <div className="w-full border-2 border-[rgba(0,0,255,0.2)]-200 bg-[rgba(0,0,255,0.1)] rounded-lg px-3 py-2 text-sm font-bold text-oms-blue">
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

                            <div className="flex gap-4 justify-end border-t-2 border-gray-100 pt-4">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={selectedJobs.size === 0 || submitting}
                                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
