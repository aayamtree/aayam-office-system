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
    Printer, Clock, CheckCircle, Truck,
    Calendar, IndianRupee, Trash2, RefreshCw, ArrowRight, Eye, X,
    ClipboardCheck, MapPin, FileText, AlertTriangle, Building2, Camera,
    PackageCheck, History, Undo2
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
    status: 'planned' | 'at_printer' | 'printing_done' | 'qc' | 'handed_over' | 'dispatched';
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
    // Dispatch paperwork, kept for later reference (GST / audit).
    invoice_doc_url: string | null;
    eway_doc_url: string | null;
    job_sheet_url: string | null;

    // Jobs
    jobs: PrintRunJob[];
}

interface StatusEvent {
    id: string;
    from_status: string | null;
    to_status: string;
    is_rollback: boolean;
    reason: string | null;
    changed_by_name: string | null;
    created_at: string;
}

// ─── Status Config ─────────────────────────────────────────
const DEFAULT_STATUS = { label: 'Unknown', icon: Clock, color: 'bg-stone-100 text-stone-700', borderColor: 'border-l-stone-400', tintBg: 'bg-stone-50', dot: 'bg-stone-400' };
const STATUS_CONFIG: Record<string, typeof DEFAULT_STATUS> = {
    planned: { label: 'Planned', icon: Clock, color: 'bg-amber-100 text-amber-800', borderColor: 'border-l-amber-400', tintBg: 'bg-amber-50/60', dot: 'bg-amber-500' },
    at_printer: { label: 'At Printer', icon: Printer, color: 'bg-orange-100 text-orange-800', borderColor: 'border-l-orange-400', tintBg: 'bg-orange-50/60', dot: 'bg-orange-500' },
    printing_done: { label: 'Printing Done', icon: CheckCircle, color: 'bg-blue-100 text-blue-800', borderColor: 'border-l-blue-400', tintBg: 'bg-blue-50/60', dot: 'bg-blue-500' },
    qc: { label: 'In QC', icon: ClipboardCheck, color: 'bg-cyan-100 text-cyan-800', borderColor: 'border-l-cyan-400', tintBg: 'bg-cyan-50/60', dot: 'bg-cyan-500' },
    handed_over: { label: 'Handed Over', icon: PackageCheck, color: 'bg-stone-200 text-stone-700', borderColor: 'border-l-stone-400', tintBg: 'bg-stone-50', dot: 'bg-stone-500' },
    dispatched: { label: 'Dispatched', icon: Truck, color: 'bg-green-100 text-green-800', borderColor: 'border-l-green-400', tintBg: 'bg-green-50/60', dot: 'bg-green-500' },
};

// A print run is a MANUFACTURING unit — one sheet, one machine, one printer.
// A dispatch is a DESTINATION unit — one client, one address, one e-way bill.
// 20 of 28 runs carry more than one client, so a run can never BE a dispatch:
// PP-00026's sheet goes to Maharashtra, Uttar Pradesh AND Bengal. The run's life
// therefore ends at `handed_over` and each client's consignment is dispatched
// per job on the Dispatch board, which already keys its records by job + client.
//
// `dispatched` survives for one case only: direct-to-client, where the printer
// ships and the run genuinely IS the shipment. That path is restricted to
// single-client runs (see handleDeliverySubmit) so one e-way bill is honest.
const NEXT_STATUS: Record<string, string | null> = {
    planned: 'at_printer',
    at_printer: 'printing_done',
    printing_done: null,   // delivery modal: warehouse -> qc, direct -> dispatched
    qc: 'handed_over',
    handed_over: null,     // terminal — the Dispatch board owns it from here
    dispatched: null,      // terminal — direct-to-client only
};

// Terminal states: the run is off the production floor and off the active board.
const ARCHIVED = ['handed_over', 'dispatched'];

// Rollback is ONE step, never a free jump: a mis-click is undone, a history is
// not rewritten. Every move back is written to print_run_status_history with a
// reason, and the jobs are deliberately NOT dragged backwards with it — the
// sync route's rank guard refuses to lower a job's stage, so if the dispatch
// team has already moved on, their work survives the correction.
const PREV_STATUS: Record<string, string | null> = {
    planned: null,
    at_printer: 'planned',
    printing_done: 'at_printer',
    qc: 'printing_done',
    handed_over: 'qc',
    dispatched: 'printing_done', // direct-to-client jumped from printing_done
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

    const [docsModal, setDocsModal] = useState<PrintRun | null>(null);

    // Moving a run BACKWARDS is a correction, not a normal step: the page is
    // open to anyone with can_plan_prints, which is not the same as admin.
    const isAdmin = profile?.role === 'admin';

    // Stage history for whichever run is open in the View modal.
    const [history, setHistory] = useState<StatusEvent[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Dispatch paperwork (invoice + e-way bill). Shared by the dispatch modal
    // and the later "Upload Docs" modal, so both routes record the same thing.
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [ewayFile, setEwayFile] = useState<File | null>(null);
    const [uploadingDocs, setUploadingDocs] = useState(false);

    // Job sheet image (the physical print job sheet / work order for this run).
    // Lives at print-run level — one sheet can carry several jobs, but there is
    // only ever one physical job sheet per run. Uploaded immediately on file
    // select (no separate file-picker state needed).
    const [uploadingJobSheet, setUploadingJobSheet] = useState(false);

    // Delivery modal state
    const [deliveryMode, setDeliveryMode] = useState<'warehouse' | 'direct_to_client'>('warehouse');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    // Goods photos (packaging / transport slip) snapped before a direct-to-client
    // dispatch — up to 4, uploaded immediately like the job sheet image so the
    // thumbnails are visible before Mark Dispatched is even clicked.
    const [directPhotos, setDirectPhotos] = useState<string[]>([]);
    const [uploadingDirectPhotos, setUploadingDirectPhotos] = useState(false);

    // Dispatch modal state
    const [ewayBill, setEwayBill] = useState('');
    const [invoiceRef, setInvoiceRef] = useState('');


    const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

    // Transporters

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
                    dispatch_date, invoice_reference, invoice_doc_url, eway_doc_url, job_sheet_url,
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
                invoice_doc_url: r.invoice_doc_url,
                eway_doc_url: r.eway_doc_url,
                job_sheet_url: r.job_sheet_url,
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




    useEffect(() => { fetchRuns(); }, [fetchRuns]);

    // ─── Status Update ─────────────────────────────────────
    // Returns true only if the run actually moved — callers must not close their
    // modal or clear their form on a false, or the operator loses their input and
    // never learns the write failed.
    const updateStatus = async (runId: string, newStatus: string, extraData?: Record<string, any>): Promise<boolean> => {
        setUpdating(runId);
        try {
            const { error } = await supabase
                .from('print_runs')
                .update({ status: newStatus, updated_at: new Date().toISOString(), ...extraData })
                .eq('id', runId);
            if (error) throw error;
            // Keep the Jobs board in sync: push this run's status onto its jobs.
            // A DB trigger (fn_sync_print_run_to_jobs) does this too, so a false
            // here is a warning rather than a failure — but say so, don't hide it.
            const synced = await syncRunJobsToStage(runId);
            if (!synced) toast.warning('Run updated, but the job board may be stale — refresh to check.');
            await fetchRuns();
            return true;
        } catch (err: any) {
            toast.error('Failed to update status: ' + (err.message || 'Unknown error'));
            return false;
        } finally {
            setUpdating(null);
        }
    };

    // ─── Dispatch paperwork upload ──────────────────────────
    // Invoice + e-way bill live in the `attachments` bucket (same one the
    // Dispatch screen already uses for delivery receipts), and the public URL
    // is stored on the run so it can be pulled up months later for GST/audit.
    const uploadDoc = async (runId: string, file: File, kind: 'invoice' | 'eway' | 'job-sheet' | 'dispatch-photo') => {
        // "invoice" (no dot) would otherwise make the extension "invoice".
        const dot = file.name.lastIndexOf('.');
        const ext = (dot > 0 ? file.name.slice(dot + 1) : 'pdf').toLowerCase();
        // Random suffix, not just Date.now() — several dispatch photos uploaded
        // back-to-back in the same millisecond used to collide and overwrite.
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `print-runs/${runId}/${kind}-${unique}.${ext}`;
        const { error } = await supabase.storage.from('attachments').upload(path, file);
        if (error) throw error;
        return supabase.storage.from('attachments').getPublicUrl(path).data?.publicUrl || null;
    };

    // A photo/doc URL we uploaded ourselves is safe to sniff by extension —
    // used to decide whether an uploaded file gets a real thumbnail or a
    // generic document icon (PDFs mostly).
    const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|heic|bmp|avif)(\?|$)/i.test(url);

    // A dispatched run with paperwork still missing — the chase list.
    const needsDocs = (r: PrintRun) =>
        r.status === 'dispatched' && (!r.invoice_doc_url || !r.eway_doc_url);

    // How many different clients ride on this one sheet. One invoice and one
    // e-way bill cannot cover three destinations, so this decides whether the
    // run may ship direct from the printer at all.
    const clientCount = (r: PrintRun) => {
        const names = (r.jobs || []).map(j => (j.client_name || '').trim());
        // A blank name is an UNKNOWN client, not the same client as its
        // neighbour. Dropping blanks would let a 2-client sheet with one missing
        // name read as single-client and slip past the direct-to-client guard.
        if (names.some(n => !n)) return Math.max(2, new Set(names.filter(Boolean)).size + 1);
        return new Set(names).size;
    };

    // Cancelling used to leave deliveryMode / address / photos set, so the
    // NEXT run opened in this modal inherited them — one Cancel on run A could
    // send run B straight past QC with run A's address and photos.
    const closeDeliveryModal = () => {
        setDeliveryModal(null);
        setDeliveryAddress('');
        setDeliveryMode('warehouse');
        setDirectPhotos([]);
    };

    // Goods photos (packaging / transport slip) for a direct-to-client dispatch —
    // uploaded immediately, same pattern as the job sheet image, capped at 4.
    const handleDirectPhotosUpload = async (files: FileList) => {
        if (!deliveryModal) return;
        const remaining = 4 - directPhotos.length;
        if (remaining <= 0) {
            toast.error('Maximum 4 photos.');
            return;
        }
        const toUpload = Array.from(files).slice(0, remaining);
        setUploadingDirectPhotos(true);
        try {
            const urls: string[] = [];
            for (const file of toUpload) {
                const url = await uploadDoc(deliveryModal.id, file, 'dispatch-photo');
                if (url) urls.push(url);
            }
            setDirectPhotos(prev => [...prev, ...urls]);
        } catch (err: any) {
            toast.error('Could not upload photo: ' + (err.message || 'Unknown error'));
        } finally {
            setUploadingDirectPhotos(false);
        }
    };

    // ─── Delivery Mode Handler ──────────────────────────────
    const handleDeliverySubmit = async () => {
        if (!deliveryModal) return;
        const data: Record<string, any> = {
            delivery_mode: deliveryMode,
        };
        if (deliveryMode === 'direct_to_client') {
            // Shipping direct records ONE address, ONE invoice and ONE e-way bill
            // on the run. That is only honest when the whole sheet goes to one
            // client; a 3-client sheet is 3 consignments and must go through the
            // Dispatch board, which keys its paperwork per job + client.
            const n = clientCount(deliveryModal);
            if (n > 1) {
                toast.error(`${deliveryModal.print_run_number} carries ${n} clients — that is ${n} consignments with ${n} e-way bills. Send it to the warehouse and dispatch each client separately.`);
                return;
            }
            data.delivery_address = deliveryAddress;
            data.dispatch_date = new Date().toISOString().split('T')[0];
            const ok = await updateStatus(deliveryModal.id, 'dispatched', data);
            if (!ok) return; // keep the modal open with the operator's input intact

            // Save remote QC record (photos). Direct-to-client is the normal way
            // this shop ships, not an exception that needs a typed-in reason — the
            // photos ARE the evidence. This is the ONLY trace that physical QC was
            // waived, so a silent failure here is not acceptable.
            try {
                const { error: qcErr } = await supabase.from('qc_records').insert({
                    print_run_id: deliveryModal.id,
                    qc_type: 'remote',
                    checklist: {},
                    result: 'passed',
                    notes: 'Direct to client — dispatched from printer, physical QC skipped.',
                    photos: directPhotos,
                    performed_by: profile?.id || null,
                    performed_by_name: profile?.full_name || 'Unknown',
                });
                if (qcErr) throw qcErr;
            } catch (err: any) {
                // Supabase returns { error } rather than throwing, so this used to
                // pass silently and the promised audit record never existed.
                toast.warning('Dispatched, but the QC-waiver record did not save: ' + (err.message || 'Unknown error'));
            }
        } else {
            // Warehouse path — the run moves to its OWN `qc` status. It used to be
            // re-written as 'printing_done', i.e. the status it already had, so the
            // card never changed and a warehouse run could never reach dispatch.
            // updateStatus() then syncs the linked jobs to quality_check.
            const ok = await updateStatus(deliveryModal.id, 'qc', data);
            if (!ok) return;
        }
        closeDeliveryModal();
    };

    // ─── Late paperwork (dispatched, docs arrive afterwards) ─
    const openDocsModal = (run: PrintRun) => {
        setInvoiceRef(run.invoice_reference || '');
        setEwayBill(run.eway_bill_number || '');
        setInvoiceFile(null);
        setEwayFile(null);
        setDocsModal(run);
    };

    const handleDocsSubmit = async () => {
        if (!docsModal) return;
        setUploadingDocs(true);
        try {
            const patch: Record<string, any> = {
                invoice_reference: invoiceRef || null,
                eway_bill_number: ewayBill || null,
                updated_at: new Date().toISOString(),
            };
            if (invoiceFile) patch.invoice_doc_url = await uploadDoc(docsModal.id, invoiceFile, 'invoice');
            if (ewayFile) patch.eway_doc_url = await uploadDoc(docsModal.id, ewayFile, 'eway');
            const { error } = await supabase.from('print_runs').update(patch).eq('id', docsModal.id);
            if (error) throw error;
            toast.success('Documents saved');
            setDocsModal(null);
            setInvoiceFile(null);
            setEwayFile(null);
            await fetchRuns();
        } catch (err: any) {
            toast.error('Could not save documents: ' + (err.message || 'Unknown error'));
        } finally {
            setUploadingDocs(false);
        }
    };

    // ─── Job sheet image (the physical print job sheet for this run) ──
    // One run = one physical sheet fed to the machine, so this lives on the
    // run, not per-job, even though a run can carry several jobs.
    const handleJobSheetUpload = async (file: File) => {
        if (!viewRun) return;
        setUploadingJobSheet(true);
        try {
            const url = await uploadDoc(viewRun.id, file, 'job-sheet');
            const { error } = await supabase.from('print_runs').update({ job_sheet_url: url, updated_at: new Date().toISOString() }).eq('id', viewRun.id);
            if (error) throw error;
            toast.success('Job sheet uploaded');
            setViewRun(prev => (prev ? { ...prev, job_sheet_url: url } : prev));
            setRuns(prev => prev.map(r => (r.id === viewRun.id ? { ...r, job_sheet_url: url } : r)));
        } catch (err: any) {
            toast.error('Could not upload job sheet: ' + (err.message || 'Unknown error'));
        } finally {
            setUploadingJobSheet(false);
        }
    };

    const deleteRun = async (runId: string) => {
        const run = runs.find(r => r.id === runId);
        const jobCount = run?.jobs?.length ?? 0;
        // Only jobs still sitting at the printing stage are sent back to Ready to
        // Print — that is what the revert endpoint is scoped to. A run already at
        // QC or handed over leaves its jobs exactly where they are, so promising
        // otherwise would be a lie the moment somebody deletes a finished sheet.
        // Only `at_printer`. The revert endpoint matches jobs whose current_stage
        // is still `printing`, and printing_done has already carried them on to
        // material_received (or quality_check on a warehouse run), so a sheet at
        // printing_done reverts nothing at all.
        const jobsComeBack = run?.status === 'at_printer';
        const { confirmed } = await confirm({
            title: `Delete ${run?.print_run_number || 'this print run'}?`,
            message: 'The sheet and its record are removed for good. The jobs on it survive.',
            consequences: [
                jobsComeBack
                    ? `The job${jobCount === 1 ? '' : 's'} on this sheet that are still at the printing stage go back to Ready to Print; any already carried further along stay where they are.`
                    : `The ${jobCount} job${jobCount === 1 ? '' : 's'} on this sheet stay at the stage they have already reached \u2014 deleting the sheet does not move them back.`,
                'The run\u2019s stage history goes with it \u2014 no record of who moved it or when.',
                'The only copy left is the weekly backup, which can be up to seven days old.',
            ],
            variant: 'danger',
            confirmLabel: 'Delete print run',
            requireExactInput: 'DELETE',
        });
        if (!confirmed) return;
        try {
            // Grab linked jobs before deleting so we can send them back to Ready to Print.
            const { data: linked, error: linkErr } = await supabase
                .from('print_run_jobs')
                .select('job_id')
                .eq('print_run_id', runId);
            if (linkErr) throw new Error(linkErr.message);
            const jobIds = (linked || []).map(r => r.job_id).filter(Boolean);
            // Delete the RUN only. print_run_jobs.print_run_id is ON DELETE
            // CASCADE, so the join rows go with it in one statement. Clearing
            // them first was the dangerous order: if the run delete then failed,
            // every job was already stripped off a sheet that still existed —
            // gone from the board and not back on Ready to Print either.
            // supabase-js returns its errors rather than throwing, so read them.
            const { error: runErr } = await supabase.from('print_runs').delete().eq('id', runId);
            if (runErr) throw new Error(runErr.message);
            const reverted = await revertJobsToReadyToPrint(jobIds);
            setViewRun(null);
            await fetchRuns();
            if (!reverted.ok) {
                toast.error('Print run deleted, but the jobs could not be sent back to Ready to Print. Check them on the Jobs board.');
            } else if (reverted.moved > 0) {
                toast.success(`Print run deleted. ${reverted.moved} job${reverted.moved === 1 ? '' : 's'} back on Ready to Print.`);
            } else {
                toast.success('Print run deleted');
            }
        } catch (err: any) {
            await fetchRuns();
            toast.error('Failed to delete print run: ' + (err.message || 'Unknown error'));
        }
    };

    // ─── Stage history ──────────────────────────────────────
    const historyReqRef = useRef<string | null>(null);

    // Remote-QC / dispatch photos (packaging, transport slip) for whichever run
    // is open in the View modal — pulled from qc_records so the thumbnails are
    // visible right where the run lives, not only on the separate Dispatch
    // History page.
    const [dispatchPhotos, setDispatchPhotos] = useState<string[]>([]);
    const dispatchPhotosReqRef = useRef<string | null>(null);
    const fetchDispatchPhotos = useCallback(async (runId: string) => {
        dispatchPhotosReqRef.current = runId;
        try {
            const { data, error } = await supabase
                .from('qc_records')
                .select('photos, created_at')
                .eq('print_run_id', runId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (dispatchPhotosReqRef.current !== runId) return;
            const all = (data || []).flatMap((r: any) => (Array.isArray(r.photos) ? r.photos : []));
            setDispatchPhotos(all);
        } catch {
            // Non-critical — the run view still works without these thumbnails.
            if (dispatchPhotosReqRef.current === runId) setDispatchPhotos([]);
        }
    }, []);
    const fetchHistory = useCallback(async (runId: string) => {
        // Open run A then run B quickly and A's slower response would land under
        // B's header, looking authoritative. Last request opened wins.
        historyReqRef.current = runId;
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('print_run_status_history')
                .select('id, from_status, to_status, is_rollback, reason, changed_by_name, created_at, profiles!print_run_status_history_changed_by_fkey(full_name)')
                .eq('print_run_id', runId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            if (historyReqRef.current !== runId) return;
            setHistory((data || []).map((r: any) => ({
                ...r,
                // The DB trigger records auth.uid() but cannot resolve a name,
                // so fall back to the joined profile.
                changed_by_name: r.changed_by_name || r.profiles?.full_name || null,
            })));
        } catch (err: any) {
            if (historyReqRef.current !== runId) return;
            toast.error('Could not load stage history: ' + (err.message || 'Unknown error'));
            setHistory([]);
        } finally {
            if (historyReqRef.current === runId) setHistoryLoading(false);
        }
    }, []);

    const openRun = (run: PrintRun) => {
        setViewRun(run);
        setHistory([]);
        fetchHistory(run.id);
        setDispatchPhotos([]);
        fetchDispatchPhotos(run.id);
    };

    // ─── Roll back one stage ────────────────────────────────
    // One atomic server-side move (fn_rollback_print_run): it re-checks the
    // step against the run's CURRENT status under a row lock, clears the
    // dispatch facts when leaving `dispatched`, and stamps the reason onto the
    // history row the trigger just wrote. Doing that from the browser meant
    // patching "the newest row", which under two operators could brand someone
    // else's forward move as a rollback.
    const rollBack = async (run: PrintRun) => {
        const prev = PREV_STATUS[run.status];
        if (!prev) return;
        if (!isAdmin) {
            toast.error('Only an admin can move a run back a stage.');
            return;
        }
        const prevLabel = (STATUS_CONFIG[prev] || DEFAULT_STATUS).label;
        const leavingDispatch = run.status === 'dispatched';
        const { confirmed, inputValue } = await confirm({
            title: `Move back to ${prevLabel}?`,
            message: `${run.print_run_number} goes from ${(STATUS_CONFIG[run.status] || DEFAULT_STATUS).label} back to ${prevLabel}, recorded with your name.`
                + ' Jobs the dispatch team has already moved further along stay where they are — only the run moves, so check the Jobs board afterwards.'
                + (leavingDispatch ? ' The transporter, e-way bill, invoice and uploaded documents on this run are cleared, because that dispatch is being undone.' : ''),
            confirmLabel: `Move back to ${prevLabel}`,
            variant: 'warning',
            showInput: true,
            inputRequired: true,
            inputPlaceholder: 'Why is this being moved back?',
        });
        if (!confirmed) return;

        setUpdating(run.id);
        try {
            const { error } = await supabase.rpc('fn_rollback_print_run', {
                p_run_id: run.id,
                p_to_status: prev,
                p_reason: inputValue || '',
            });
            if (error) throw error;

            // Undoing "At Printer" must also release the jobs, which the stage
            // map cannot express: planned deliberately implies nothing, and the
            // rank guard never lowers a stage.
            if (prev === 'planned') {
                const reverted = await revertJobsToReadyToPrint((run.jobs || []).map(j => j.job_id).filter(Boolean));
                if (!reverted.ok) {
                    toast.error('The run moved back, but its jobs were not released to Ready to Print. Check them on the Jobs board.');
                }
            } else {
                await syncRunJobsToStage(run.id);
            }
            await fetchRuns();
            toast.success(`${run.print_run_number} moved back to ${prevLabel}.`);
        } catch (err: any) {
            toast.error('Could not move it back: ' + (err.message || 'Unknown error'));
        } finally {
            setUpdating(null);
            setViewRun(null);
            setHistory([]);
        }
    };

    // ─── Hand over to Dispatch ──────────────────────────────
    // The sheet has been cut; there is no sheet any more, only parcels. The run
    // closes here and each client's consignment is dispatched on the Dispatch
    // board, which is keyed per job + client and already holds the transporter,
    // e-way bill, invoice and delivery receipt.
    const handOver = async (run: PrintRun) => {
        const n = clientCount(run);
        const { confirmed } = await confirm({
            title: 'Hand over to Dispatch',
            message: n > 1
                ? `${run.print_run_number} carries ${n} clients, so it ships as ${n} separate consignments. Handing over closes this run and archives it — the ${run.jobs.length} jobs continue on the Dispatch board, where each client gets its own transporter, e-way bill and invoice.`
                : `Handing over closes ${run.print_run_number} and archives it. Its ${run.jobs.length} job${run.jobs.length !== 1 ? 's' : ''} continue on the Dispatch board, where the consignment paperwork is recorded.`,
            confirmLabel: 'Hand over →',
        });
        if (!confirmed) return;
        await updateStatus(run.id, 'handed_over');
    };

    // ─── Handle next step button click ──────────────────────
    const handleNextStep = (run: PrintRun) => {
        if (run.status === 'printing_done') {
            // Show delivery mode modal
            setDeliveryModal(run);
        } else if (run.status === 'qc') {
            handOver(run);
        } else {
            const next = NEXT_STATUS[run.status];
            if (next) updateStatus(run.id, next);
        }
    };



    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const DONE_PRINTING = ['printing_done', 'qc', ...ARCHIVED];
    const overdueCount = runs.filter(r =>
        r.deadline &&
        new Date(r.deadline) < today &&
        !DONE_PRINTING.includes(r.status)
    ).length;

    // 'all' means all ACTIVE work. A handed-over run is history: it would
    // otherwise pile up here exactly like the 270-card job board did.
    const filteredRuns = filter === 'all' ? runs.filter(r => !ARCHIVED.includes(r.status))
        : filter === 'overdue'
            ? runs.filter(r => r.deadline && new Date(r.deadline) < today && !DONE_PRINTING.includes(r.status))
            : filter === 'docs_pending'
                ? runs.filter(needsDocs)
                // Both terminal states, so a fully-papered direct dispatch stays
                // reachable — otherwise it could be viewed from nowhere at all.
                : filter === 'closed'
                    ? runs.filter(r => ARCHIVED.includes(r.status))
                    : runs.filter(r => r.status === filter);

    // ?job=<id> — arrived from ⌘K's "where does this appear" list. A job isn't a
    // row here, it's a line inside a run, so highlight the RUN that carries it.
    const focusRunId = focusJobId
        ? runs.find(r => r.jobs?.some(j => j.job_id === focusJobId))?.id ?? null
        : null;
    const counts: Record<string, number> = {
        planned: runs.filter(r => r.status === 'planned').length,
        at_printer: runs.filter(r => r.status === 'at_printer').length,
        printing_done: runs.filter(r => r.status === 'printing_done').length,
        qc: runs.filter(r => r.status === 'qc').length,
        docs_pending: runs.filter(needsDocs).length,
        closed: runs.filter(r => ARCHIVED.includes(r.status)).length,
    };

    const formatDate = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getNextLabel = (status: string) => {
        if (status === 'printing_done') return 'Delivery →';
        if (status === 'qc') return 'Hand to Dispatch →';
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

            {/* Stat Cards — Job Queue style */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3">
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
                    onClick={() => setFilter(filter === 'qc' ? 'all' : 'qc')}
                    className={`text-left rounded-md p-2 md:p-3 border transition-all ${filter === 'qc'
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-cyan-50 border-cyan-200'}`}
                >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <ClipboardCheck className={`w-4 h-4 ${filter === 'qc' ? 'text-white' : 'text-cyan-700'}`} />
                        <span className={`text-xs font-medium ${filter === 'qc' ? 'text-white' : 'text-cyan-700'}`}>In QC</span>
                    </div>
                    <p className={`text-page-title ${filter === 'qc' ? 'text-white' : 'text-cyan-800'}`}>{counts.qc}</p>
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
                <button
                    onClick={() => setFilter(filter === 'closed' ? 'all' : 'closed')}
                    className={`text-left rounded-md p-2 md:p-3 border transition-all ${filter === 'closed'
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-muted border-border'}`}
                >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <PackageCheck className={`w-4 h-4 ${filter === 'closed' ? 'text-white' : 'text-foreground'}`} />
                        <span className={`text-xs font-medium ${filter === 'closed' ? 'text-white' : 'text-foreground'}`}>Closed</span>
                    </div>
                    <p className={`text-page-title ${filter === 'closed' ? 'text-white' : 'text-foreground'}`}>{counts.closed}</p>
                </button>
                <button
                    onClick={() => setFilter(filter === 'docs_pending' ? 'all' : 'docs_pending')}
                    className={`text-left rounded-md p-2 md:p-3 border transition-all ${filter === 'docs_pending'
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-amber-50 border-amber-200'}`}
                >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <FileText className={`w-4 h-4 ${filter === 'docs_pending' ? 'text-white' : 'text-amber-600'}`} />
                        <span className={`text-xs font-medium ${filter === 'docs_pending' ? 'text-white' : 'text-amber-700'}`}>Docs Pending</span>
                    </div>
                    <p className={`text-page-title ${filter === 'docs_pending' ? 'text-white' : 'text-amber-700'}`}>{counts.docs_pending}</p>
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
                        const isOverdue = run.deadline && new Date(run.deadline) < new Date() && !DONE_PRINTING.includes(run.status);
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
                                        {needsDocs(run) && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold uppercase">Docs Pending</span>
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
                                            {run.notes || [run.machine_name, run.sheet_size_label || run.sheet_size, run.material_name].filter(Boolean).join(' · ') || 'No specs'}
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
                                            onClick={() => openRun(run)}
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
                                        {run.status === 'dispatched' && !needsDocs(run) && (
                                            <span className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded text-xs font-medium border border-green-200 opacity-80">
                                                <CheckCircle className="w-3 h-3" /> Done
                                            </span>
                                        )}
                                        {needsDocs(run) && (
                                            <button
                                                onClick={() => openDocsModal(run)}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-medium hover:bg-amber-100 transition-colors"
                                            >
                                                <FileText className="w-3 h-3" />
                                                {!run.invoice_doc_url && !run.eway_doc_url
                                                    ? 'Upload Docs'
                                                    : !run.invoice_doc_url ? 'Add Invoice' : 'Add E-way Bill'}
                                            </button>
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
                                    {viewRun.status === 'dispatched' && (
                                        <div className="flex items-end gap-3 flex-wrap mt-2 pt-2 border-t border-gray-200">
                                            {viewRun.invoice_doc_url ? (
                                                <a href={viewRun.invoice_doc_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5">
                                                    {isImageUrl(viewRun.invoice_doc_url) ? (
                                                        <img src={viewRun.invoice_doc_url} alt="Invoice" className="w-10 h-10 object-cover rounded border border-gray-200 hover:border-gray-400 transition-colors" />
                                                    ) : (
                                                        <span className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:border-gray-400 transition-colors"><FileText size={16} /></span>
                                                    )}
                                                    <span className="text-[9px] text-gray-500">Invoice</span>
                                                </a>
                                            ) : (
                                                <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded">Invoice missing</span>
                                            )}
                                            {viewRun.eway_doc_url ? (
                                                <a href={viewRun.eway_doc_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5">
                                                    {isImageUrl(viewRun.eway_doc_url) ? (
                                                        <img src={viewRun.eway_doc_url} alt="E-way bill" className="w-10 h-10 object-cover rounded border border-gray-200 hover:border-gray-400 transition-colors" />
                                                    ) : (
                                                        <span className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:border-gray-400 transition-colors"><FileText size={16} /></span>
                                                    )}
                                                    <span className="text-[9px] text-gray-500">E-way Bill</span>
                                                </a>
                                            ) : (
                                                <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded">E-way bill missing</span>
                                            )}
                                            {needsDocs(viewRun) && (
                                                <button onClick={() => { setViewRun(null); openDocsModal(viewRun); }} className="ml-auto text-xs font-bold px-2.5 py-1 bg-gray-900 text-white rounded hover:bg-gray-800">
                                                    Upload
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {dispatchPhotos.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <p className="text-[10px] text-gray-400 mb-1">Goods Photos (packaging / transport slip)</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {dispatchPhotos.map((url, idx) => (
                                                    <a key={url + idx} href={url} target="_blank" rel="noopener noreferrer">
                                                        {isImageUrl(url) ? (
                                                            <img src={url} alt={`Goods photo ${idx + 1}`} className="w-10 h-10 object-cover rounded border border-gray-200 hover:border-gray-400 transition-colors" />
                                                        ) : (
                                                            <span className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:border-gray-400 transition-colors"><FileText size={16} /></span>
                                                        )}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}



                            {/* Stage history — every move, who made it, when */}
                            <div>
                                <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                                    <History size={12} /> Stage History
                                </p>
                                {historyLoading ? (
                                    <p className="text-xs text-gray-400">Loading…</p>
                                ) : history.length === 0 ? (
                                    <p className="text-xs text-gray-400">
                                        Nothing recorded yet — stage history starts from 25 Aug 2026.
                                        This run reached <strong>{(STATUS_CONFIG[viewRun.status] || DEFAULT_STATUS).label}</strong> before that.
                                    </p>
                                ) : (
                                    <div className="space-y-0">
                                        {history.map((h, i) => {
                                            const conf = STATUS_CONFIG[h.to_status] || DEFAULT_STATUS;
                                            return (
                                                <div key={h.id} className="flex gap-2.5">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${h.is_rollback ? 'bg-amber-500' : conf.dot}`} />
                                                        {i < history.length - 1 && <span className="w-px flex-1 bg-gray-200 my-0.5" />}
                                                    </div>
                                                    <div className="pb-3 min-w-0">
                                                        <p className="text-xs font-medium text-gray-900">
                                                            {h.is_rollback && <span className="text-amber-600 font-bold">↶ moved back to </span>}
                                                            {conf.label}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">
                                                            {new Date(h.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                                                        </p>
                                                        {h.reason && <p className="text-[10px] text-amber-700 mt-0.5 italic">&ldquo;{h.reason}&rdquo;</p>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Job sheet image — the physical print job sheet for this run */}
                            <div>
                                <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                                    <Camera size={12} /> Job Sheet
                                </p>
                                {viewRun.job_sheet_url ? (
                                    <div className="relative inline-block group">
                                        <a href={viewRun.job_sheet_url} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={viewRun.job_sheet_url}
                                                alt="Job sheet"
                                                className="max-h-48 rounded-md border border-gray-200 object-contain hover:border-gray-400 transition-colors"
                                            />
                                        </a>
                                        <label className="absolute bottom-1.5 right-1.5 text-[10px] font-medium px-2 py-1 bg-white/90 border border-gray-200 rounded cursor-pointer hover:bg-white shadow-sm">
                                            {uploadingJobSheet ? 'Uploading…' : 'Replace'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploadingJobSheet}
                                                onChange={e => { const f = e.target.files?.[0]; if (f) handleJobSheetUpload(f); e.target.value = ''; }}
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center gap-1.5 w-full h-28 border-2 border-dashed border-gray-200 rounded-md cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-600">
                                        <Camera size={18} />
                                        <span className="text-xs font-medium">{uploadingJobSheet ? 'Uploading…' : 'Upload job sheet image'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={uploadingJobSheet}
                                            onChange={e => { const f = e.target.files?.[0]; if (f) handleJobSheetUpload(f); e.target.value = ''; }}
                                        />
                                    </label>
                                )}
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
                                    {PREV_STATUS[viewRun.status] && (
                                        <button
                                            onClick={() => rollBack(viewRun)}
                                            disabled={updating === viewRun.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200 bg-amber-50 rounded-md hover:bg-amber-100 disabled:opacity-50"
                                            title={`Move back to ${(STATUS_CONFIG[PREV_STATUS[viewRun.status] as string] || DEFAULT_STATUS).label}`}
                                        >
                                            <Undo2 size={13} /> Move back
                                        </button>
                                    )}

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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeDeliveryModal}>
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
                                            Goods Photos (packaging / transport slip)
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {directPhotos.map((url, idx) => (
                                                <div key={url} className="relative group">
                                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={url}
                                                            alt={`Goods photo ${idx + 1}`}
                                                            className="w-16 h-16 object-cover rounded-md border border-gray-200 hover:border-gray-400 transition-colors"
                                                        />
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDirectPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        aria-label="Remove photo"
                                                    >×</button>
                                                </div>
                                            ))}
                                            {directPhotos.length < 4 && (
                                                <label className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 border-2 border-dashed border-gray-200 rounded-md cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-600">
                                                    {uploadingDirectPhotos ? (
                                                        <span className="text-[9px] font-medium">Uploading…</span>
                                                    ) : (
                                                        <>
                                                            <Camera size={16} />
                                                            <span className="text-[9px] font-medium">Add</span>
                                                        </>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        disabled={uploadingDirectPhotos}
                                                        onChange={e => { if (e.target.files?.length) handleDirectPhotosUpload(e.target.files); e.target.value = ''; }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{directPhotos.length}/4 · snap the packed goods or transport slip before dispatch</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-700 flex items-start gap-2">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <span>Physical QC will be skipped. A remote QC record will be saved with your name for traceability.</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={closeDeliveryModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md">Cancel</button>
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
            {/* DOCUMENTS MODAL (paperwork that arrives after dispatch) */}
            {/* ═══════════════════════════════════════════════════════ */}
            {docsModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDocsModal(null)}>
                    <div className="bg-white rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="bg-amber-500 px-4 py-3 rounded-t-lg">
                            <h2 className="text-white font-bold text-base">Dispatch Documents</h2>
                            <p className="text-white/80 text-xs">
                                {docsModal.print_run_number} · {docsModal.delivery_mode === 'direct_to_client' ? 'dispatched direct from printer' : 'dispatched from warehouse'}
                            </p>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Invoice Ref.</label>
                                    <input
                                        type="text"
                                        value={invoiceRef}
                                        onChange={e => setInvoiceRef(e.target.value)}
                                        placeholder="INV-XXXXX"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-amber-300 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">E-way Bill No.</label>
                                    <input
                                        type="text"
                                        value={ewayBill}
                                        onChange={e => setEwayBill(e.target.value)}
                                        placeholder="EWB-XXXXX"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-amber-300 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">Invoice File</label>
                                {docsModal.invoice_doc_url ? (
                                    <div className="flex items-center gap-2.5 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                                        <a href={docsModal.invoice_doc_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                            {isImageUrl(docsModal.invoice_doc_url) ? (
                                                <img src={docsModal.invoice_doc_url} alt="Invoice" className="w-9 h-9 object-cover rounded border border-green-200" />
                                            ) : (
                                                <span className="w-9 h-9 flex items-center justify-center rounded border border-green-200 bg-white text-green-600"><FileText size={16} /></span>
                                            )}
                                        </a>
                                        <a href={docsModal.invoice_doc_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-green-700 hover:underline flex-1">
                                            Already uploaded — open
                                        </a>
                                        <span className="text-[10px] text-green-600">✓</span>
                                    </div>
                                ) : (
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
                                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">E-way Bill File</label>
                                {docsModal.eway_doc_url ? (
                                    <div className="flex items-center gap-2.5 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                                        <a href={docsModal.eway_doc_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                            {isImageUrl(docsModal.eway_doc_url) ? (
                                                <img src={docsModal.eway_doc_url} alt="E-way bill" className="w-9 h-9 object-cover rounded border border-green-200" />
                                            ) : (
                                                <span className="w-9 h-9 flex items-center justify-center rounded border border-green-200 bg-white text-green-600"><FileText size={16} /></span>
                                            )}
                                        </a>
                                        <a href={docsModal.eway_doc_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-green-700 hover:underline flex-1">
                                            Already uploaded — open
                                        </a>
                                        <span className="text-[10px] text-green-600">✓</span>
                                    </div>
                                ) : (
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={e => setEwayFile(e.target.files?.[0] || null)}
                                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700"
                                    />
                                )}
                            </div>

                            <p className="text-[11px] text-gray-400">
                                Attach whichever has arrived — the run keeps its Docs Pending flag until both are in.
                            </p>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setDocsModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md">Cancel</button>
                                <button
                                    onClick={handleDocsSubmit}
                                    disabled={uploadingDocs}
                                    className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-md hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {uploadingDocs ? 'Saving...' : 'Save Documents'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
