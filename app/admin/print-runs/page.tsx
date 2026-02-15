'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Printer, ChevronDown, ChevronUp, Package, Clock, CheckCircle, Truck,
    Calendar, IndianRupee, Trash2, RefreshCw, ArrowRight, AlertTriangle, Eye, X
} from 'lucide-react';

interface PrintRunJob {
    id: string;
    job_id: string;
    client_name: string;
    item_name: string;
    quantity_needed: number;
    ups_in_sheet: number;
    job_type: string;
    job_number?: string;
}

interface PrintRun {
    id: string;
    print_run_number: string;
    status: 'planned' | 'printed' | 'delivered';
    notes: string | null;
    deadline: string | null;
    total_amount: number | null;
    created_at: string;
    vendor_name: string | null;
    machine_name: string | null;
    sheet_size: string | null;
    material_name: string | null;
    jobs: PrintRunJob[];
}

const STATUS_CONFIG = {
    planned: { label: 'Planned', icon: Clock, color: 'bg-amber-100 text-amber-800', headerBg: 'bg-amber-600', dot: 'bg-amber-500' },
    printed: { label: 'Printed', icon: CheckCircle, color: 'bg-blue-100 text-blue-800', headerBg: 'bg-gray-800', dot: 'bg-blue-500' },
    delivered: { label: 'Delivered', icon: Truck, color: 'bg-green-100 text-green-800', headerBg: 'bg-gray-500', dot: 'bg-green-500' },
};

const NEXT_STATUS: Record<string, string | null> = {
    planned: 'printed',
    printed: 'delivered',
    delivered: null,
};

export default function PrintRunsPage() {
    const [runs, setRuns] = useState<PrintRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [updating, setUpdating] = useState<string | null>(null);
    const [viewRun, setViewRun] = useState<PrintRun | null>(null);

    const fetchRuns = useCallback(async () => {
        setLoading(true);
        try {
            const { data: runsData, error } = await supabase
                .from('print_runs')
                .select(`
                    id, print_run_number, status, notes, deadline, total_amount, created_at,
                    vendors(name),
                    machines(name),
                    sheet_sizes(size),
                    materials(name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const runIds = (runsData || []).map(r => r.id);
            let jobsData: any[] = [];
            if (runIds.length > 0) {
                const { data: jd } = await supabase
                    .from('print_run_jobs')
                    .select('*, jobs(job_number)')
                    .in('print_run_id', runIds);
                jobsData = jd || [];
            }

            const mapped: PrintRun[] = (runsData || []).map((r: any) => ({
                id: r.id,
                print_run_number: r.print_run_number,
                status: r.status,
                notes: r.notes,
                deadline: r.deadline,
                total_amount: r.total_amount,
                created_at: r.created_at,
                vendor_name: r.vendors?.name || null,
                machine_name: r.machines?.name || null,
                sheet_size: r.sheet_sizes?.size || null,
                material_name: r.materials?.name || null,
                jobs: jobsData
                    .filter(j => j.print_run_id === r.id)
                    .map(j => ({
                        ...j,
                        job_number: j.jobs?.job_number || j.job_id?.slice(0, 8),
                    })),
            }));

            setRuns(mapped);
        } catch (err) {
            console.error('Error fetching print runs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRuns(); }, [fetchRuns]);

    const updateStatus = async (runId: string, newStatus: string) => {
        setUpdating(runId);
        try {
            const { error } = await supabase
                .from('print_runs')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', runId);
            if (error) throw error;
            await fetchRuns();
        } catch (err) {
            console.error('Error updating status:', err);
        } finally {
            setUpdating(null);
        }
    };

    const deleteRun = async (runId: string) => {
        if (!confirm('Delete this print run? This cannot be undone.')) return;
        try {
            await supabase.from('print_run_jobs').delete().eq('print_run_id', runId);
            await supabase.from('print_runs').delete().eq('id', runId);
            setViewRun(null);
            await fetchRuns();
        } catch (err) {
            console.error('Error deleting print run:', err);
        }
    };

    const filteredRuns = filter === 'all' ? runs : runs.filter(r => r.status === filter);
    const counts = {
        all: runs.length,
        planned: runs.filter(r => r.status === 'planned').length,
        printed: runs.filter(r => r.status === 'printed').length,
        delivered: runs.filter(r => r.status === 'delivered').length,
    };

    const formatDate = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="space-y-2 md:space-y-4 px-2 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900 flex items-center gap-2">
                        <Printer size={22} /> Print Runs
                    </h1>
                    <p className="text-xs md:text-sm text-gray-500">{filteredRuns.length} print runs in system</p>
                </div>
                <button
                    onClick={fetchRuns}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards - matches Job Queue layout */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                <div className="bg-gray-900 border border-gray-800 rounded-md p-2 md:p-3 cursor-pointer" onClick={() => setFilter('all')}>
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <Package className="w-4 h-4 text-white" />
                        <span className="text-xs text-white font-medium">Total</span>
                    </div>
                    <p className="text-page-title text-white">{counts.all}</p>
                </div>
                <div className={`border rounded-md p-2 md:p-3 cursor-pointer ${filter === 'planned' ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`} onClick={() => setFilter('planned')}>
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-amber-700 font-medium">Planned</span>
                    </div>
                    <p className="text-page-title text-amber-800">{counts.planned}</p>
                </div>
                <div className={`border rounded-md p-2 md:p-3 cursor-pointer ${filter === 'printed' ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`} onClick={() => setFilter('printed')}>
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-blue-700 font-medium">Printed</span>
                    </div>
                    <p className="text-page-title text-blue-800">{counts.printed}</p>
                </div>
                <div className={`border rounded-md p-2 md:p-3 cursor-pointer ${filter === 'delivered' ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`} onClick={() => setFilter('delivered')}>
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <Truck className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-700 font-medium">Delivered</span>
                    </div>
                    <p className="text-page-title text-green-800">{counts.delivered}</p>
                </div>
            </div>

            {/* Print Runs Grid - 3-column card layout like Job Queue */}
            {filteredRuns.length === 0 ? (
                <div className="col-span-full bg-white rounded-md border border-gray-200 p-12 text-center">
                    <Printer size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No print runs found</p>
                    <p className="text-sm text-gray-400 mt-1">Create a print run from the Print Planner</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredRuns.map(run => {
                        const statusConf = STATUS_CONFIG[run.status];
                        const StatusIcon = statusConf.icon;
                        const nextStatus = NEXT_STATUS[run.status];
                        const totalQty = run.jobs.reduce((sum, j) => sum + (j.quantity_needed || 0), 0);
                        const isUpdating = updating === run.id;
                        const isOverdue = run.deadline && new Date(run.deadline) < new Date() && run.status !== 'delivered';

                        return (
                            <div key={run.id} className={`bg-white rounded-md overflow-hidden border hover:shadow-sm transition-all ${isOverdue ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}>
                                {/* Colored Header (like Job Queue) */}
                                <div className={`${statusConf.headerBg} px-3 py-2 flex items-center justify-between`}>
                                    <span className="text-white font-semibold text-sm">
                                        {run.print_run_number}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {isOverdue && (
                                            <span className="text-xs px-2 py-0.5 bg-white/25 rounded-md font-bold uppercase text-white">
                                                OVERDUE
                                            </span>
                                        )}
                                        <span className="text-white/90 text-xs px-2 py-0.5 bg-white/15 rounded-md font-medium capitalize">
                                            {statusConf.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-3">
                                    {/* Vendor */}
                                    <p className="text-gray-500 text-xs mb-0.5">
                                        {run.vendor_name || 'No vendor assigned'}
                                    </p>
                                    {/* Specs */}
                                    <h3 className="text-gray-900 font-semibold text-sm mb-2 line-clamp-1">
                                        {[run.machine_name, run.sheet_size, run.material_name].filter(Boolean).join(' · ') || 'No specs'}
                                    </h3>

                                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                                        <span>{run.jobs.length} job{run.jobs.length !== 1 ? 's' : ''}</span>
                                        <span>Qty: {totalQty.toLocaleString()}</span>
                                        {run.deadline && (
                                            <span className="flex items-center gap-0.5">
                                                <Calendar size={11} />
                                                {formatDate(run.deadline)}
                                            </span>
                                        )}
                                        {run.total_amount && run.total_amount > 0 && (
                                            <span className="font-bold text-gray-700 flex items-center gap-0.5 ml-auto">
                                                <IndianRupee size={11} />
                                                {run.total_amount.toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions (like Job Queue) */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setViewRun(run)}
                                            className="flex-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            View
                                        </button>
                                        {nextStatus ? (
                                            <button
                                                onClick={() => updateStatus(run.id, nextStatus)}
                                                disabled={isUpdating}
                                                className="flex-1 px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                {isUpdating ? (
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                )}
                                                {STATUS_CONFIG[nextStatus as keyof typeof STATUS_CONFIG].label}
                                            </button>
                                        ) : (
                                            <button
                                                disabled
                                                className="flex-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-sm font-medium border border-green-200 flex items-center justify-center gap-1.5 opacity-80"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Done
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* View Modal (like Job Queue's view modal) */}
            {viewRun && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewRun(null)}>
                    <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className={`${STATUS_CONFIG[viewRun.status].headerBg} px-4 py-3 flex items-center justify-between rounded-t-lg`}>
                            <div>
                                <h2 className="text-white font-bold text-base">{viewRun.print_run_number}</h2>
                                <p className="text-white/70 text-xs">{viewRun.vendor_name || 'No vendor'}</p>
                            </div>
                            <button onClick={() => setViewRun(null)} className="text-white/70 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 space-y-4">
                            {/* Specs */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-gray-400 text-xs">Status</p>
                                    <p className="font-medium capitalize">{viewRun.status}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs">Created</p>
                                    <p className="font-medium">{formatDate(viewRun.created_at)}</p>
                                </div>
                                {viewRun.machine_name && <div>
                                    <p className="text-gray-400 text-xs">Machine</p>
                                    <p className="font-medium">{viewRun.machine_name}</p>
                                </div>}
                                {viewRun.sheet_size && <div>
                                    <p className="text-gray-400 text-xs">Sheet Size</p>
                                    <p className="font-medium">{viewRun.sheet_size}</p>
                                </div>}
                                {viewRun.material_name && <div>
                                    <p className="text-gray-400 text-xs">Material</p>
                                    <p className="font-medium">{viewRun.material_name}</p>
                                </div>}
                                {viewRun.deadline && <div>
                                    <p className="text-gray-400 text-xs">Deadline</p>
                                    <p className="font-medium">{formatDate(viewRun.deadline)}</p>
                                </div>}
                                {viewRun.total_amount && viewRun.total_amount > 0 && <div>
                                    <p className="text-gray-400 text-xs">Amount</p>
                                    <p className="font-bold flex items-center gap-0.5"><IndianRupee size={13} />{viewRun.total_amount.toLocaleString()}</p>
                                </div>}
                            </div>

                            {/* Notes */}
                            {viewRun.notes && (
                                <div className="bg-gray-50 rounded-md p-3">
                                    <p className="text-xs text-gray-400 mb-1">Notes</p>
                                    <p className="text-sm text-gray-700">{viewRun.notes}</p>
                                </div>
                            )}

                            {/* Jobs List */}
                            <div>
                                <p className="text-xs font-bold text-gray-600 mb-2">Jobs in this run ({viewRun.jobs.length})</p>
                                <div className="space-y-1.5">
                                    {viewRun.jobs.map(job => (
                                        <div key={job.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-xs font-bold text-gray-900">{job.job_number}</span>
                                                <span className="text-xs text-gray-600">{job.client_name}</span>
                                                <span className="text-xs text-gray-400">{job.item_name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-gray-500">{job.quantity_needed?.toLocaleString()} qty</span>
                                                <span className="text-xs text-gray-400">{job.ups_in_sheet}-up</span>
                                                {job.job_type && (
                                                    <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded">
                                                        {job.job_type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <button
                                    onClick={() => deleteRun(viewRun.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-all"
                                >
                                    <Trash2 size={13} />
                                    Delete
                                </button>
                                {NEXT_STATUS[viewRun.status] && (
                                    <button
                                        onClick={() => { updateStatus(viewRun.id, NEXT_STATUS[viewRun.status]!); setViewRun(null); }}
                                        disabled={updating === viewRun.id}
                                        className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-md hover:bg-gray-800 disabled:opacity-50 transition-all"
                                    >
                                        <ArrowRight size={13} />
                                        Mark as {STATUS_CONFIG[NEXT_STATUS[viewRun.status] as keyof typeof STATUS_CONFIG].label}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
