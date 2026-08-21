'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { syncRunJobsToStage, revertJobsToReadyToPrint } from '@/lib/print-run-sync';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import ProductBadge from '@/components/shared/ProductBadge';
import { runProductCategory } from '@/lib/product-category';
import {
    Printer, Package, Clock, CheckCircle, Truck, Search as SearchIcon,
    Calendar, IndianRupee, Trash2, RefreshCw, ArrowRight, Eye, X,
    ClipboardCheck, Send, MapPin, FileText, AlertTriangle, Building2, Camera
} from 'lucide-react';

// ─── Interfaces ────────────────────────────────────────────
interface PrintRunJob {
    id: string;
    job_id: string;
    client_name: string;
    item_name: string;
    quantity_needed: number;
    ups_in_sheet: number;
    job_type: string;          // WORK type: Design + Printing / Print Only
    product_category?: string | null; // PRODUCT type: Label / Pouch / Box
    job_number?: string;
    received_qty?: number;
}

interface PrintRun {
    id: string;
    print_run_number: string;
    status: 'planned' | 'at_printer' | 'printing_done' | 'dispatched';
    notes: string | null;
    deadline: string | null;
    total_amount: number | null;
    created_at: string;
    vendor_name: string | null;
    machine_name: string | null;
    sheet_size: string | null;
    sheet_size_label: string | null;
    material_name: string | null;
    pulling_multiple: number | null;
    // Paper supply
    paper_vendor_name: string | null;
    paper_qty: number | null;
    paper_rate: number | null;
    paper_gst_percent: number | null;
    paper_total: number | null;
    paper_payment_status: string | null;
    // Delivery & dispatch
    delivery_mode: string | null;
    delivery_address: string | null;
    transporter_name: string | null;
    eway_bill_number: string | null;
    dispatch_date: string | null;
    invoice_reference: string | null;

    // Jobs
    jobs: PrintRunJob[];
}

interface TransporterVendor {
    id: string;
    name: string;
}

// ─── Status Config ─────────────────────────────────────────
const DEFAULT_STATUS = { label: 'Unknown', icon: Clock, color: 'bg-stone-100 text-stone-700', borderColor: 'border-l-stone-400', tintBg: 'bg-stone-50', dot: 'bg-stone-400' };
const STATUS_CONFIG: Record<string, typeof DEFAULT_STATUS> = {
    planned: { label: 'Planned', icon: Clock, color: 'bg-amber-100 text-amber-800', borderColor: 'border-l-amber-400', tintBg: 'bg-amber-50/60', dot: 'bg-amber-500' },
    at_printer: { label: 'At Printer', icon: Printer, color: 'bg-orange-100 text-orange-800', borderColor: 'border-l-orange-400', tintBg: 'bg-orange-50/60', dot: 'bg-orange-500' },
    printing_done: { label: 'Printing Done', icon: CheckCircle, color: 'bg-blue-100 text-blue-800', borderColor: 'border-l-blue-400', tintBg: 'bg-blue-50/60', dot: 'bg-blue-500' },
    dispatched: { label: 'Dispatched', icon: Truck, color: 'bg-green-100 text-green-800', borderColor: 'border-l-green-400', tintBg: 'bg-green-50/60', dot: 'bg-green-500' },
};

const NEXT_STATUS: Record<string, string | null> = {
    planned: 'at_printer',
    at_printer: 'printing_done',
    printing_done: null, // handled via delivery modal
    dispatched: null,
};

// QC items fetched dynamically from Production Settings (job_checklists table)

// ─── Main Component ────────────────────────────────────────
export default function PrintRunsPage() {
    const { profile } = useAuth();
    const confirm = useConfirm();
    const [runs, setRuns] = useState<PrintRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [updating, setUpdating] = useState<string | null>(null);
    const [focusJobId, setFocusJobId] = useState<string | null>(null);
    const focusRunRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setFocusJobId(new URLSearchParams(window.location.search).get('job'));
    }, []);
    useEffect(() => {
        if (!focusJobId || loading) return;
        focusRunRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [focusJobId, loading, runs]);

    // Modals
    const [viewRun, setViewRun] = useState<PrintRun | null>(null);
    const [deliveryModal, setDeliveryModal] = useState<PrintRun | null>(null);
    const [dispatchModal, setDispatchModal] = useState<PrintRun | null>(null);

    // Delivery modal state
    const [deliveryMode, setDeliveryMode] = useState<'warehouse' | 'direct_to_client'>('warehouse');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [directPhotoUrl, setDirectPhotoUrl] = useState('');
    const [directSkipReason, setDirectSkipReason] = useState('');

    // Dispatch modal state
    const [transporterName, setTransporterName] = useState('');
    const [ewayBill, setEwayBill] = useState('');
    const [invoiceRef, setInvoiceRef] = useState('');
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);


    const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

    // Transporters
    const [transporters, setTransporters] = useState<TransporterVendor[]>([]);

    // Dynamic QC checklist items from Production Settings


    // ─── Fetch ──────────────────────────────────────────────
    const fetchRuns = useCallback(async () => {
        setLoading(true);
        try {
            const { data: runsData, error } = await supabase
                .from('print_runs')
                .select(`
                    id, print_run_number, status, notes, deadline, total_amount, created_at,
                    sheet_size_label, pulling_multiple,
                    paper_qty, paper_rate, paper_gst_percent, paper_total, paper_payment_status,
                    delivery_mode, delivery_address, transporter_name, eway_bill_number,
                    dispatch_date, invoice_reference,
                    vendors!print_runs_vendor_id_fkey(name),
                    machines(name),
                    sheet_sizes(size),
                    materials(name),
                    paper_vendor:vendors!print_runs_paper_vendor_id_fkey(name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const runIds = (runsData || []).map(r => r.id);
            let jobsData: any[] = [];
            if (runIds.length > 0) {
                const { data: jd, error: jdErr } = await supabase
                    .from('print_run_jobs')
                    .select('*, jobs(job_number, product_category)')
                    .in('print_run_id', runIds);
                // Without this, a failure here silently produced print runs with
                // no jobs on them — a sheet that looks empty rather than broken.
                if (jdErr) throw jdErr;
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
                sheet_size_label: r.sheet_size_label || null,
                material_name: r.materials?.name || null,
                pulling_multiple: r.pulling_multiple || null,
                paper_vendor_name: r.paper_vendor?.name || null,
                paper_qty: r.paper_qty,
                paper_rate: r.paper_rate,
                paper_gst_percent: r.paper_gst_percent,
                paper_total: r.paper_total,
                paper_payment_status: r.paper_payment_status,
                delivery_mode: r.delivery_mode,
                delivery_address: r.delivery_address,
                transporter_name: r.transporter_name,
                eway_bill_number: r.eway_bill_number,
                dispatch_date: r.dispatch_date,
                invoice_reference: r.invoice_reference,
                jobs: jobsData
                    .filter(j => j.print_run_id === r.id)
                    .map(j => ({
                        ...j,
                        job_number: j.jobs?.job_number || j.job_id?.slice(0, 8),
                        // Snapshot first, live job second — old runs predate the column.
                        product_category: j.product_category || j.jobs?.product_category || null,
                    })),
            }));

            setRuns(mapped);
        } catch (err: any) {
            toast.error('Failed to load print runs: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTransporters = async () => {
        const { data } = await supabase
            .from('vendors')
            .select('id, name')
            .eq('is_active', true)
            .ilike('category', '%transporter%');
        setTransporters(data || []);
    };



    useEffect(() => { fetchRuns(); fetchTransporters(); }, [fetchRuns]);

    // ─── Status Update ─────────────────────────────────────
    const updateStatus = async (runId: string, newStatus: string, extraData?: Record<string, any>) => {
        setUpdating(runId);
        try {
            const { error } = await supabase
                .from('print_runs')
                .update({ status: newStatus, updated_at: new Date().toISOString(), ...extraData })
                .eq('id', runId);
            if (error) throw error;
            // Keep the Jobs board in sync: push this run's status onto its jobs.
            await syncRunJobsToStage(runId);
            await fetchRuns();
        } catch (err: any) {
            toast.error('Failed to update status: ' + (err.message || 'Unknown error'));
        } finally {
            setUpdating(null);
        }
    };

    // ─── Delivery Mode Handler ──────────────────────────────
    const handleDeliverySubmit = async () => {
        if (!deliveryModal) return;
        const data: Record<string, any> = {
            delivery_mode: deliveryMode,
        };
        if (deliveryMode === 'direct_to_client') {
            if (!directSkipReason.trim()) {
                toast.error('Please enter a reason for skipping physical QC.');
                return;
            }
            data.delivery_address = deliveryAddress;
            await updateStatus(deliveryModal.id, 'dispatched', data);

            // Save remote QC record (photo + waiver)
            try {
                await supabase.from('qc_records').insert({
                    print_run_id: deliveryModal.id,
                    qc_type: 'remote',
                    checklist: {},
                    result: 'passed',
                    notes: `Direct to client — QC skipped. Reason: ${directSkipReason}`,
                    photos: directPhotoUrl ? [directPhotoUrl] : [],
                    skip_reason: directSkipReason,
                    performed_by: profile?.id || null,
                    performed_by_name: profile?.full_name || 'Unknown',
                });
            } catch (err) {
                console.warn('Could not save remote QC record:', err);
            }
        } else {
            // Warehouse path — set status; updateStatus() syncs linked jobs to
            // quality_check (delivery_mode = warehouse is written in the same update).
            await updateStatus(deliveryModal.id, 'printing_done', data);
        }
        setDeliveryModal(null);
        setDeliveryAddress('');
        setDeliveryMode('warehouse');
        setDirectPhotoUrl('');
        setDirectSkipReason('');
    };



    // ─── Dispatch Handler ───────────────────────────────────
    const handleDispatchSubmit = async () => {
        if (!dispatchModal) return;
        await updateStatus(dispatchModal.id, 'dispatched', {
            transporter_name: transporterName,
            eway_bill_number: ewayBill,
            invoice_reference: invoiceRef,
            dispatch_date: dispatchDate,
        });
        setDispatchModal(null);
        setTransporterName('');
        setEwayBill('');
        setInvoiceRef('');
    };

    const deleteRun = async (runId: string) => {
        const { confirmed } = await confirm({ title: 'Delete Print Run', message: 'Delete this print run? This cannot be undone.', variant: 'danger', confirmLabel: 'Delete' });
        if (!confirmed) return;
        try {
            // Grab linked jobs before deleting so we can send them back to Ready to Print.
            const { data: linked } = await supabase
                .from('print_run_jobs')
                .select('job_id')
                .eq('print_run_id', runId);
            const jobIds = (linked || []).map(r => r.job_id).filter(Boolean);
            await supabase.from('print_run_jobs').delete().eq('print_run_id', runId);
            await supabase.from('print_runs').delete().eq('id', runId);
            await revertJobsToReadyToPrint(jobIds);
            setViewRun(null);
            await fetchRuns();
        } catch (err: any) {
            toast.error('Failed to delete print run: ' + (err.message || 'Unknown error'));
        }
    };

    // ─── Handle next step button click ──────────────────────
    const handleNextStep = (run: PrintRun) => {
        if (run.status === 'printing_done') {
            // Show delivery mode modal
            setDeliveryModal(run);
        } else {
            const next = NEXT_STATUS[run.status];
            if (next) updateStatus(run.id, next);
        }
    };



    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCount = runs.filter(r =>
        r.deadline &&
        new Date(r.deadline) < today &&
        !['printing_done'].includes(r.status)
    ).length;

    const filteredRuns = filter === 'all' ? runs : filter === 'overdue'
        ? runs.filter(r => r.deadline && new Date(r.deadline) < today && !['printing_done'].includes(r.status))
        : runs.filter(r => r.status === filter);

    // ?job=<id> — arrived from ⌘K's "where does this appear" list. A job isn't a
    // row here, it's a line inside a run, so highlight the RUN that carries it.
    const focusRunId = focusJobId
        ? runs.find(r => r.jobs?.some(j => j.job_id === focusJobId))?.id ?? null
        : null;
    const counts: Record<string, number> = {
        all: runs.length,
        planned: runs.filter(r => r.status === 'planned').length,
        at_printer: runs.filter(r => r.status === 'at_printer').length,
        printing_done: runs.filter(r => r.status === 'printing_done').length,
    };

    const formatDate = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getNextLabel = (status: string) => {
        if (status === 'printing_done') return 'Delivery →';
        const next = NEXT_STATUS[status];
        if (!next) return null;
        return STATUS_CONFIG[next as keyof typeof STATUS_CONFIG]?.label + ' →';
    };

    // ─── Loading ────────────────────────────────────────────
    if (loading) {
        return <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-gray-400" /></div>;
    }

    // ─── Render ─────────────────────────────────────────────
    return (
        <div className="space-y-2 md:space-y-4 px-2 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900 flex items-center gap-2">
                        <Printer size={22} /> Print Runs
                    </h1>
                    <p className="text-xs md:text-sm text-gray-500">{filteredRuns.length} print runs</p>
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

            {/* Stat Cards — Job Queue style (4 col) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                <button
                    onClick={() => setFilter(filter === 'planned' ? 'all' : 'planned')}
                    className={`text-left rounded-md p-2 md:p-3 border transition-all ${filter === 'planned'
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-muted border-border'}`}
                >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <Clock className={`w-4 h-4 ${filter === 'planned' ? 'text-white' : 'text-foreground'}`} />
                        <span className={`text-xs font-medium ${filter === 'planned' ? 'text-white' : 'text-foreground'}`}>Planned</span>
                    </div>
                    <p className={`text-page-title ${filter === 'planned' ? 'text-white' : 'text-foreground'}`}>{counts.planned}</p>
                </button>
                <button
                    onClick={() => setFilter(filter === 'at_printer' ? 'all' : 'at_printer')}
                    className={`text-left rounded-md p-2 md:p-3 border transition-all ${filter === 'at_printer'
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-white border-gray-300'}`}
                >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <Printer className={`w-4 h-4 ${filter === 'at_printer' ? 'text-white' : 'text-gray-900'}`} />
                        <span className={`text-xs font-medium ${filter === 'at_printer' ? 'text-white' : 'text-gray-900'}`}>At Printer</span>
                    </div>
                    <p className={`text-page-title ${filter === 'at_printer' ? 'text-white' : 'text-gray-900'}`}>{counts.at_printer}</p>
                </button>
                <button
                    onClick={() => setFilter(filter === 'printing_done' ? 'all' : 'printing_done')}
                    className={`text-left rounded-md p-2 md:p-3 border transition-all ${filter === 'printing_done'
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-muted border-border'}`}
                >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <CheckCircle className={`w-4 h-4 ${filter === 'printing_done' ? 'text-white' : 'text-foreground'}`} />
                        <span className={`text-xs font-medium ${filter === 'printing_done' ? 'text-white' : 'text-foreground'}`}>Printing Done</span>
                    </div>
                    <p className={`text-page-title ${filter === 'printing_done' ? 'text-white' : 'text-foreground'}`}>{counts.printing_done}</p>
                </button>
                <button
                    onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
                    className={`text-left rounded-md p-2 md:p-3 border transition-all ${filter === 'overdue'
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-red-50 border-red-200'}`}
                >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <AlertTriangle className={`w-4 h-4 ${filter === 'overdue' ? 'text-white' : 'text-red-600'}`} />
                        <span className={`text-xs font-medium ${filter === 'overdue' ? 'text-white' : 'text-red-600'}`}>Overdue</span>
                    </div>
                    <p className={`text-page-title ${filter === 'overdue' ? 'text-white' : 'text-red-700'}`}>{overdueCount}</p>
                </button>
            </div>

            {/* Cards Grid */}
            {filteredRuns.length === 0 ? (
                <div className="bg-card rounded-md border border-border p-12 text-center">
                    <Printer size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium text-sm">No print runs found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Create a print run from the Print Planner</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {filteredRuns.map(run => {
                        const statusConf = STATUS_CONFIG[run.status] || DEFAULT_STATUS;
                        const isUpdating = updating === run.id;
                        const isOverdue = run.deadline && new Date(run.deadline) < new Date() && run.status !== 'dispatched';
                        const nextLabel = getNextLabel(run.status);

                        return (
                            <div
                                key={run.id}
                                ref={run.id === focusRunId ? focusRunRef : undefined}
                                className={`bg-card rounded-md border border-border border-l-4 ${statusConf.borderColor} hover:shadow-sm transition-shadow ${run.id === focusRunId ? 'ring-2 ring-amber-400' : isOverdue ? 'ring-1 ring-red-200' : ''}`}
                            >
                                {/* Light tinted top strip */}
                                <div className={`${statusConf.tintBg} px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md`}>
                                    <span className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[10px] font-mono text-muted-foreground">{run.print_run_number}</span>
                                        {/* What this sheet actually is — labels, pouches, boxes. */}
                                        <ProductBadge category={runProductCategory(run.jobs)} size="sm" />
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {isOverdue && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-bold uppercase">Overdue</span>
                                        )}
                                        {run.delivery_mode === 'direct_to_client' && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-medium">Direct</span>
                                        )}
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${statusConf.color}`}>
                                            {statusConf.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="px-3 pt-2 pb-3 space-y-2">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground truncate">{run.vendor_name || 'No vendor'}</p>
                                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5">
                                            {[run.machine_name, run.sheet_size_label || run.sheet_size, run.material_name].filter(Boolean).join(' · ') || 'No specs'}
                                        </h3>
                                    </div>

                                    {/* Client names & jobs */}
                                    {run.jobs.length > 0 && (() => {
                                        const uniqueClients = Array.from(new Set(run.jobs.map(j => j.client_name).filter(Boolean)));
                                        return (
                                            <div>
                                                <p className="text-[10px] font-semibold text-foreground truncate">
                                                    👤 {uniqueClients.join(', ') || 'No client'}
                                                </p>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {run.jobs.map(job => (
                                                        <span key={job.id} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                                            <span className="font-bold">{job.job_number}</span>
                                                            <span className="opacity-50">·</span>
                                                            <span className="truncate max-w-[80px]">{job.item_name || 'Unnamed'}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                        <span>{run.jobs.length} job{run.jobs.length !== 1 ? 's' : ''}</span>
                                        {run.deadline && (
                                            <span className="flex items-center gap-0.5">
                                                <Calendar size={9} />{formatDate(run.deadline)}
                                            </span>
                                        )}
                                        {run.total_amount && run.total_amount > 0 && (
                                            <span className="font-bold text-foreground flex items-center gap-0.5 ml-auto">
                                                <IndianRupee size={9} />₹{run.total_amount.toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Paper supply badge */}
                                    {run.paper_vendor_name && (
                                        <span className={`inline-flex text-[9px] px-1.5 py-0.5 rounded font-medium ${run.paper_payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            📄 Paper: {run.paper_vendor_name} · ₹{(run.paper_total || 0).toLocaleString()} · {run.paper_payment_status}
                                        </span>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-1.5 flex-wrap pt-0.5">
                                        <button
                                            onClick={() => setViewRun(run)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-card border border-border text-muted-foreground rounded text-xs font-medium hover:text-foreground hover:border-foreground/30 transition-colors"
                                        >
                                            <Eye className="w-3 h-3" /> View
                                        </button>

                                        {nextLabel && (
                                            <button
                                                onClick={() => handleNextStep(run)}
                                                disabled={isUpdating}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-foreground text-background rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                                            >
                                                {isUpdating ? (
                                                    <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <ArrowRight className="w-3 h-3" />
                                                )}
                                                {nextLabel}
                                            </button>
                                        )}
                                        {run.status === 'dispatched' && (
                                            <span className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded text-xs font-medium border border-green-200 opacity-80">
                                                <CheckCircle className="w-3 h-3" /> Done
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* VIEW MODAL                                            */}
            {/* ═══════════════════════════════════════════════════════ */}
            {viewRun && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewRun(null)}>
                    <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className={`${(STATUS_CONFIG[viewRun.status] || DEFAULT_STATUS).tintBg} px-4 py-3 flex items-center justify-between rounded-t-lg sticky top-0 border-b border-border/50`}>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-foreground font-bold text-base">{viewRun.print_run_number}</h2>
                                    <ProductBadge category={runProductCategory(viewRun.jobs)} size="sm" />
                                </div>
                                <p className="text-muted-foreground text-xs">{viewRun.vendor_name || 'No vendor'}</p>
                            </div>
                            <button onClick={() => setViewRun(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Specs Grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><p className="text-gray-400 text-xs">Status</p><p className="font-medium capitalize">{(STATUS_CONFIG[viewRun.status] || DEFAULT_STATUS).label}</p></div>
                                <div><p className="text-gray-400 text-xs">Created</p><p className="font-medium">{formatDate(viewRun.created_at)}</p></div>
                                {viewRun.machine_name && <div><p className="text-gray-400 text-xs">Machine</p><p className="font-medium">{viewRun.machine_name}</p></div>}
                                {(viewRun.sheet_size_label || viewRun.sheet_size) && <div><p className="text-gray-400 text-xs">Sheet Size</p><p className="font-medium">{viewRun.sheet_size_label || viewRun.sheet_size}</p></div>}
                                {viewRun.material_name && <div><p className="text-gray-400 text-xs">Material</p><p className="font-medium">{viewRun.material_name}</p></div>}
                                {viewRun.deadline && <div><p className="text-gray-400 text-xs">Deadline</p><p className="font-medium">{formatDate(viewRun.deadline)}</p></div>}
                                {viewRun.pulling_multiple && <div><p className="text-gray-400 text-xs">Pulling</p><p className="font-medium">{viewRun.pulling_multiple.toLocaleString()} sheets</p></div>}
                                {viewRun.total_amount && viewRun.total_amount > 0 && <div><p className="text-gray-400 text-xs">Printing Charge</p><p className="font-bold flex items-center gap-0.5"><IndianRupee size={13} />{viewRun.total_amount.toLocaleString()}</p></div>}
                            </div>

                            {/* Paper Supply */}
                            {viewRun.paper_vendor_name && (
                                <div className="bg-blue-50 rounded-md p-3 border border-blue-100">
                                    <p className="text-xs font-bold text-blue-700 mb-2">📄 Paper Supply</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div><span className="text-blue-500">Vendor:</span> <strong>{viewRun.paper_vendor_name}</strong></div>
                                        <div><span className="text-blue-500">Qty:</span> <strong>{viewRun.paper_qty?.toLocaleString()} sheets</strong></div>
                                        <div><span className="text-blue-500">Rate:</span> <strong>₹{viewRun.paper_rate}/sheet</strong></div>
                                        <div><span className="text-blue-500">GST:</span> <strong>{viewRun.paper_gst_percent}%</strong></div>
                                        <div><span className="text-blue-500">Total:</span> <strong className="text-blue-800">₹{viewRun.paper_total?.toLocaleString()}</strong></div>
                                        <div>
                                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${viewRun.paper_payment_status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'
                                                }`}>
                                                {viewRun.paper_payment_status === 'paid' ? '✓ Paid' : '⏳ Pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Delivery & Dispatch Info */}
                            {viewRun.delivery_mode && (
                                <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                                    <p className="text-xs font-bold text-gray-700 mb-2">
                                        {viewRun.delivery_mode === 'direct_to_client' ? '📦 Direct to Client' : '🏭 Via Warehouse'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {viewRun.delivery_address && <div className="col-span-2"><span className="text-gray-400">Address:</span> {viewRun.delivery_address}</div>}
                                        {viewRun.transporter_name && <div><span className="text-gray-400">Transporter:</span> <strong>{viewRun.transporter_name}</strong></div>}
                                        {viewRun.eway_bill_number && <div><span className="text-gray-400">E-way Bill:</span> <strong>{viewRun.eway_bill_number}</strong></div>}
                                        {viewRun.invoice_reference && <div><span className="text-gray-400">Invoice:</span> <strong>{viewRun.invoice_reference}</strong></div>}
                                        {viewRun.dispatch_date && <div><span className="text-gray-400">Dispatched:</span> <strong>{formatDate(viewRun.dispatch_date)}</strong></div>}
                                    </div>
                                </div>
                            )}



                            {/* Notes */}
                            {viewRun.notes && (
                                <div className="bg-gray-50 rounded-md p-3">
                                    <p className="text-xs text-gray-400 mb-1">Notes</p>
                                    <p className="text-sm text-gray-700">{viewRun.notes}</p>
                                </div>
                            )}

                            {/* Jobs List */}
                            <div>
                                <p className="text-xs font-bold text-gray-600 mb-2">Jobs ({viewRun.jobs.length})</p>
                                <div className="space-y-1.5">
                                    {viewRun.jobs.map(job => (
                                        <div key={job.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-xs font-bold text-gray-900">{job.job_number}</span>
                                                <ProductBadge category={job.product_category} />
                                                <span className="text-xs text-gray-600">{job.client_name}</span>
                                                <span className="text-xs text-gray-400">{job.item_name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-gray-500">{job.quantity_needed?.toLocaleString()} qty</span>
                                                <span className="text-xs text-gray-400">{job.ups_in_sheet}-up</span>
                                                {job.received_qty !== null && job.received_qty !== undefined && (
                                                    <span className={`text-xs font-bold ${job.received_qty >= (job.quantity_needed || 0) ? 'text-green-600' : 'text-red-600'}`}>
                                                        Rcvd: {job.received_qty.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <button onClick={() => deleteRun(viewRun.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md">
                                    <Trash2 size={13} /> Delete
                                </button>
                                <div className="flex gap-2">

                                    {getNextLabel(viewRun.status) && (
                                        <button
                                            onClick={() => { setViewRun(null); handleNextStep(viewRun); }}
                                            disabled={updating === viewRun.id}
                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-md hover:bg-gray-800 disabled:opacity-50"
                                        >
                                            <ArrowRight size={13} /> {getNextLabel(viewRun.status)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* DELIVERY MODE MODAL (after printing_done)             */}
            {/* ═══════════════════════════════════════════════════════ */}
            {deliveryModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeliveryModal(null)}>
                    <div className="bg-white rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-600 px-4 py-3 rounded-t-lg">
                            <h2 className="text-white font-bold text-base">Printing Done — Delivery Mode</h2>
                            <p className="text-white/70 text-xs">{deliveryModal.print_run_number} · Where should it go?</p>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Two big choice buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeliveryMode('warehouse')}
                                    className={`p-4 rounded-md border-2 text-center transition-all ${deliveryMode === 'warehouse'
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <Building2 size={28} className={`mx-auto mb-2 ${deliveryMode === 'warehouse' ? 'text-purple-600' : 'text-gray-400'}`} />
                                    <p className="font-bold text-sm">Warehouse</p>
                                    <p className="text-xs text-gray-500 mt-1">QC by dispatch team</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeliveryMode('direct_to_client')}
                                    className={`p-4 rounded-md border-2 text-center transition-all ${deliveryMode === 'direct_to_client'
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <MapPin size={28} className={`mx-auto mb-2 ${deliveryMode === 'direct_to_client' ? 'text-green-600' : 'text-gray-400'}`} />
                                    <p className="font-bold text-sm">Direct to Client</p>
                                    <p className="text-xs text-gray-500 mt-1">Skip QC, dispatch now</p>
                                </button>
                            </div>

                            {/* Client address (only for direct) */}
                            {deliveryMode === 'direct_to_client' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Client Delivery Address</label>
                                        <textarea
                                            value={deliveryAddress}
                                            onChange={e => setDeliveryAddress(e.target.value)}
                                            rows={2}
                                            placeholder="Enter client delivery address..."
                                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none focus:ring-2 focus:ring-gray-400 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                                            <Camera size={12} className="inline mr-1" />
                                            Printer Photo URL (for remote QC)
                                        </label>
                                        <input
                                            type="url"
                                            value={directPhotoUrl}
                                            onChange={e => setDirectPhotoUrl(e.target.value)}
                                            placeholder="Paste photo link from printer..."
                                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Ask printer to share photo before dispatch</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-red-600 mb-1.5">Reason for Skipping Physical QC *</label>
                                        <input
                                            type="text"
                                            value={directSkipReason}
                                            onChange={e => setDirectSkipReason(e.target.value)}
                                            placeholder="e.g. Repeat order, Trusted printer, Urgent..."
                                            className="w-full px-3 py-2 border border-red-200 rounded-md text-sm focus:ring-2 focus:ring-red-300 outline-none"
                                            required
                                        />
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-700 flex items-start gap-2">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <span>Physical QC will be skipped. A remote QC record will be saved with your name for traceability.</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setDeliveryModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md">Cancel</button>
                                <button
                                    onClick={handleDeliverySubmit}
                                    className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-md hover:bg-gray-800"
                                >
                                    {deliveryMode === 'warehouse' ? 'Send to QC →' : 'Mark Dispatched →'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* ═══════════════════════════════════════════════════════ */}
            {/* DISPATCH MODAL (from QC → dispatched)                  */}
            {/* ═══════════════════════════════════════════════════════ */}
            {dispatchModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDispatchModal(null)}>
                    <div className="bg-white rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="bg-green-600 px-4 py-3 rounded-t-lg">
                            <h2 className="text-white font-bold text-base">Dispatch Details</h2>
                            <p className="text-white/70 text-xs">{dispatchModal.print_run_number}</p>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Transporter */}
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">Transporter</label>
                                {transporters.length > 0 ? (
                                    <select
                                        value={transporterName}
                                        onChange={e => setTransporterName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-green-400 outline-none"
                                    >
                                        <option value="">Select transporter...</option>
                                        {transporters.map(t => (
                                            <option key={t.id} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={transporterName}
                                        onChange={e => setTransporterName(e.target.value)}
                                        placeholder="Enter transporter name"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-green-400 outline-none"
                                    />
                                )}
                            </div>

                            {/* E-way bill & Invoice */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">E-way Bill No.</label>
                                    <input
                                        type="text"
                                        value={ewayBill}
                                        onChange={e => setEwayBill(e.target.value)}
                                        placeholder="EWB-XXXXX"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-green-400 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Invoice Ref.</label>
                                    <input
                                        type="text"
                                        value={invoiceRef}
                                        onChange={e => setInvoiceRef(e.target.value)}
                                        placeholder="INV-XXXXX"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-green-400 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Dispatch Date */}
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">Dispatch Date</label>
                                <input
                                    type="date"
                                    value={dispatchDate}
                                    onChange={e => setDispatchDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-green-400 outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setDispatchModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md">Cancel</button>
                                <button
                                    onClick={handleDispatchSubmit}
                                    className="px-6 py-2 bg-green-600 text-white text-sm font-bold rounded-md hover:bg-green-700"
                                >
                                    <Truck className="inline w-4 h-4 mr-1" /> Dispatch →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
