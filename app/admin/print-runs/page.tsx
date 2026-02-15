'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Printer, ChevronDown, ChevronUp, Package, Clock, CheckCircle, Truck,
    Calendar, IndianRupee, Trash2, RefreshCw, ArrowRight
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
    planned: { label: 'Planned', icon: Clock, color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
    printed: { label: 'Printed', icon: CheckCircle, color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
    delivered: { label: 'Delivered', icon: Truck, color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
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
    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const fetchRuns = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch print runs with related data
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

            // Fetch all print run jobs
            const runIds = (runsData || []).map(r => r.id);
            let jobsData: any[] = [];
            if (runIds.length > 0) {
                const { data: jd } = await supabase
                    .from('print_run_jobs')
                    .select('*, jobs(job_number)')
                    .in('print_run_id', runIds);
                jobsData = jd || [];
            }

            // Map runs with jobs
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

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-12 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Printer size={22} /> Print Runs
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Monitor and track all print runs</p>
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
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-4">
                {([
                    { key: 'all', label: 'Total', icon: Package, bg: 'bg-gray-100', text: 'text-gray-800' },
                    { key: 'planned', label: 'Planned', icon: Clock, bg: 'bg-amber-50', text: 'text-amber-700' },
                    { key: 'printed', label: 'Printed', icon: CheckCircle, bg: 'bg-blue-50', text: 'text-blue-700' },
                    { key: 'delivered', label: 'Delivered', icon: Truck, bg: 'bg-green-50', text: 'text-green-700' },
                ] as const).map(s => (
                    <button
                        key={s.key}
                        onClick={() => setFilter(s.key)}
                        className={`p-3 rounded-md text-center transition-all border ${filter === s.key
                            ? `${s.bg} ${s.text} border-current ring-1 ring-current/20`
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <p className={`text-2xl font-bold ${filter === s.key ? s.text : 'text-gray-900'}`}>
                            {counts[s.key]}
                        </p>
                        <p className={`text-xs font-medium ${filter === s.key ? s.text : 'text-gray-500'}`}>
                            {s.label}
                        </p>
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
                </div>
            ) : filteredRuns.length === 0 ? (
                <div className="bg-white rounded-md border border-gray-200 p-12 text-center">
                    <Printer size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No print runs found</p>
                    <p className="text-sm text-gray-400 mt-1">Create a print run from the Print Planner</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRuns.map(run => {
                        const isExpanded = expandedRun === run.id;
                        const statusConf = STATUS_CONFIG[run.status];
                        const StatusIcon = statusConf.icon;
                        const nextStatus = NEXT_STATUS[run.status];
                        const totalQty = run.jobs.reduce((sum, j) => sum + (j.quantity_needed || 0), 0);
                        const isUpdating = updating === run.id;

                        return (
                            <div key={run.id} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                {/* Run Header */}
                                <div
                                    className="p-4 cursor-pointer hover:bg-gray-50/50 transition-all"
                                    onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Run Number */}
                                            <span className="font-mono text-sm font-bold text-gray-900">
                                                {run.print_run_number}
                                            </span>
                                            {/* Status Badge */}
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${statusConf.color}`}>
                                                <StatusIcon size={12} />
                                                {statusConf.label}
                                            </span>
                                            {/* Vendor */}
                                            {run.vendor_name && (
                                                <span className="text-xs text-gray-500">
                                                    · {run.vendor_name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {/* Jobs & Qty */}
                                            <span className="text-xs text-gray-500">
                                                {run.jobs.length} job{run.jobs.length !== 1 ? 's' : ''} · {totalQty.toLocaleString()} qty
                                            </span>
                                            {/* Deadline */}
                                            {run.deadline && (
                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {formatDate(run.deadline)}
                                                </span>
                                            )}
                                            {/* Amount */}
                                            {run.total_amount && run.total_amount > 0 && (
                                                <span className="text-xs font-bold text-gray-700 flex items-center gap-0.5">
                                                    <IndianRupee size={11} />
                                                    {run.total_amount.toLocaleString()}
                                                </span>
                                            )}
                                            {/* Expand Icon */}
                                            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                        </div>
                                    </div>
                                    {/* Specs row */}
                                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                                        {run.machine_name && <span>Machine: {run.machine_name}</span>}
                                        {run.sheet_size && <span>Sheet: {run.sheet_size}</span>}
                                        {run.material_name && <span>Material: {run.material_name}</span>}
                                        <span>Created: {formatDate(run.created_at)}</span>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100">
                                        {/* Jobs Table */}
                                        <div className="px-4 py-3">
                                            <p className="text-xs font-bold text-gray-600 mb-2">Jobs in this run ({run.jobs.length})</p>
                                            <div className="space-y-1.5">
                                                {run.jobs.map(job => (
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

                                        {/* Notes */}
                                        {run.notes && (
                                            <div className="px-4 pb-3">
                                                <p className="text-xs text-gray-500">
                                                    <strong>Notes:</strong> {run.notes}
                                                </p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteRun(run.id); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-all"
                                            >
                                                <Trash2 size={13} />
                                                Delete
                                            </button>
                                            {nextStatus && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(run.id, nextStatus); }}
                                                    disabled={isUpdating}
                                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-md hover:bg-gray-800 disabled:opacity-50 transition-all"
                                                >
                                                    {isUpdating ? (
                                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <ArrowRight size={13} />
                                                    )}
                                                    Mark as {STATUS_CONFIG[nextStatus as keyof typeof STATUS_CONFIG].label}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
