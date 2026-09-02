/**
 * "Where does this record actually live?"
 *
 * A job doesn't sit in one place — the same job is a card in Design Studio, a
 * line in the Print Planner, a row on Dispatch, an invoice in Finance and a
 * version in the Product Library. Searching for it and being dropped on ONE of
 * those is a guess about which one the person wanted.
 *
 * These helpers ask the database which of those places this particular record
 * is genuinely in, so the palette can offer real destinations. Nothing here is
 * inferred from the stage alone where a related row can be checked instead: a
 * link that leads to "not found" is worse than no link.
 */

import { supabase } from '@/lib/supabase';
import { getStageName, getStagePhase } from '@/lib/job-workflow';

export interface RecordLocation {
    /** Stable key for React and for de-duping. */
    key: string;
    /** Where it is, in the words used in the sidebar. */
    label: string;
    /** Why it's there — stage, invoice number, run number. May be empty. */
    detail: string;
    href: string;
}

/** Stages the Design Studio task board actually lists. Mirrors JOBS_QUERY_OPTIONS
 *  in app/admin/designers/tasks/page.tsx — if that list changes, change this. */
const DESIGN_BOARD_STAGES = [
    'new', 'awaiting_admin', 'file_check', 'designing', 'approval',
    'pre_print_qc', 'print_file_ready', 'file_sent_client',
];

/** Stages that put a job on the production floor. */
const PRODUCTION_STAGES = [
    'file_received', 'ready_to_print', 'printing', 'material_received',
    'finishing', 'quality_check', 'ready',
];

const DISPATCH_STAGES = ['quality_check', 'ready', 'dispatched', 'delivered'];

/**
 * Every place a job can be opened, filtered to the ones it's really in.
 * One round of parallel queries; only called when the user expands a result,
 * so it costs nothing on a normal search.
 */
export async function getJobLocations(jobId: string): Promise<RecordLocation[]> {
    const [jobRes, invoiceRes, printRunRes, qcRes, productRes, paymentRes] = await Promise.all([
        supabase.from('jobs')
            .select('id, job_number, current_stage, job_type, client_id, clients(name, company)')
            .eq('id', jobId).maybeSingle(),
        supabase.from('invoices').select('id, invoice_number, payment_status').eq('job_id', jobId).limit(1),
        supabase.from('print_run_jobs').select('id, print_run_id').eq('job_id', jobId).limit(1),
        supabase.from('qc_records').select('id').eq('job_id', jobId).limit(1),
        supabase.from('product_versions').select('id, product_id').eq('job_id', jobId).limit(1),
        supabase.from('payments_received').select('id').eq('job_id', jobId).limit(1),
    ]);

    const job: any = jobRes.data;
    if (!job) return [];

    const stage: string = job.current_stage || '';
    const locations: RecordLocation[] = [];

    // The job's own page is always a valid destination and always first.
    locations.push({
        key: 'job',
        label: 'Job page',
        detail: getStageName(stage) || 'No stage',
        href: `/admin/jobs/${jobId}`,
    });

    // Design Studio — only if the board would actually list this stage. The
    // ?task= handler already redirects to the job page when it can't find it,
    // but offering a link we know leads nowhere is still misleading.
    if (DESIGN_BOARD_STAGES.includes(stage)) {
        locations.push({
            key: 'design',
            label: 'Design Studio',
            detail: getStagePhase(stage) === 'design' ? 'On the task board' : 'Listed on the board',
            href: `/admin/designers/tasks?task=${jobId}`,
        });
    }

    if (PRODUCTION_STAGES.includes(stage)) {
        locations.push({
            key: 'production',
            label: 'Production Queue',
            detail: getStageName(stage) || '',
            href: `/admin/production-queue?job=${jobId}`,
        });
    }

    // Print Planner — a real print_run_jobs row, not a guess from the stage.
    if (printRunRes.data?.length) {
        locations.push({
            key: 'print',
            label: 'Print Planner',
            detail: 'In a print run',
            href: `/admin/print-runs?job=${jobId}`,
        });
    }

    if (qcRes.data?.length || DISPATCH_STAGES.includes(stage)) {
        locations.push({
            key: 'dispatch',
            label: 'Dispatch',
            detail: qcRes.data?.length ? 'QC recorded' : getStageName(stage) || '',
            href: `/admin/dispatch?job=${jobId}`,
        });
    }

    const invoice: any = invoiceRes.data?.[0];
    if (invoice) {
        locations.push({
            key: 'invoice',
            label: 'Invoice',
            detail: `${invoice.invoice_number || 'Draft'} · ${invoice.payment_status || 'pending'}`,
            // Money In groups by CUSTOMER and shows no invoice numbers, and the
            // ?open= parameter was read by nothing. Zoho is where an invoice
            // actually lives now.
            href: `/admin/finance/zoho`,
        });
    }

    if (paymentRes.data?.length) {
        locations.push({
            key: 'payments',
            label: 'Payments',
            detail: 'Payment recorded',
            href: `/admin/finance/bank-cash`,
        });
    }

    const version: any = productRes.data?.[0];
    if (version?.product_id) {
        locations.push({
            key: 'library',
            label: 'Product Library',
            detail: 'Saved as a version',
            href: `/admin/library/${version.product_id}`,
        });
    }

    if (job.client_id) {
        const client: any = Array.isArray(job.clients) ? job.clients[0] : job.clients;
        locations.push({
            key: 'client',
            label: 'Client',
            detail: client?.company || client?.name || '',
            href: `/admin/crm/clients/${job.client_id}`,
        });
    }

    return locations;
}

/** Where a client record shows up. */
export async function getClientLocations(clientId: string): Promise<RecordLocation[]> {
    const [jobsRes, invoicesRes] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    ]);

    const locations: RecordLocation[] = [{
        key: 'client',
        label: 'Client page',
        detail: 'Profile, history and balance',
        href: `/admin/crm/clients/${clientId}`,
    }];

    if (jobsRes.count) {
        locations.push({
            key: 'jobs',
            label: 'Jobs',
            detail: `${jobsRes.count} job${jobsRes.count === 1 ? '' : 's'}`,
            href: `/admin/jobs?client=${clientId}`,
        });
    }

    if (invoicesRes.count) {
        locations.push({
            key: 'invoices',
            label: 'Invoices',
            detail: `${invoicesRes.count} invoice${invoicesRes.count === 1 ? '' : 's'}`,
            href: `/admin/finance/money-in`,
        });
    }

    return locations;
}

/**
 * Dispatcher. Leads, invoices and quotations live in exactly one place each, so
 * they return nothing — the palette treats an empty list as "just open it".
 */
export async function getRecordLocations(
    type: string,
    id: string,
): Promise<RecordLocation[]> {
    try {
        if (type === 'job') return await getJobLocations(id);
        if (type === 'client') return await getClientLocations(id);
        return [];
    } catch (err) {
        console.error('Could not work out where this record lives:', err);
        return [];
    }
}
