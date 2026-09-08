import { supabase } from '@/lib/supabase';

export interface CalendarItem {
    id: string;
    title: string;
    date: string; // yyyy-MM-dd
    type: 'event' | 'deadline' | 'followup' | 'dispatch' | 'invoice' | 'printrun' | 'lead';
    status?: string;
    color: string;
    link?: string;
}

/** Safe query helper — returns empty array on any error (missing table, bad column, etc.) */
async function safeQuery<T>(queryBuilder: any, label?: string): Promise<T[]> {
    try {
        const { data, error } = await queryBuilder;
        if (error) {
            console.warn(`[Calendar] ${label || 'query'} failed:`, error.message);
            return [];
        }
        return (data ?? []) as T[];
    } catch (e: any) {
        console.warn(`[Calendar] ${label || 'query'} exception:`, e?.message);
        return [];
    }
}

/**
 * Fetch all time-bound business data for calendar display.
 * Admin sees everything system-wide; other roles see only their relevant items.
 * Each query is independent — a missing table won't break other data.
 *
 * ROLE-BASED VISIBILITY RULES:
 *  admin     → everything system-wide
 *  finance   → all job deadlines + invoices (billing context)
 *  designer  → only their own assigned jobs + print runs
 *  dispatch  → dispatches + print-related job deadlines (Print / Design+Print only, NOT design-only)
 *              + print runs (they need to know when jobs leave print)
 *  marketing → follow-ups (own), leads (own) — no job deadlines, no dispatch
 *  cmyk      → print-related job deadlines + print runs (like dispatch, print-side only)
 *  (others)  → only their own events
 */
export async function fetchCalendarBusinessData(
    startDate: string,
    endDate: string,
    userRole: string,
    userId: string
): Promise<CalendarItem[]> {
    const isAdmin    = userRole === 'admin';
    const isDesigner = userRole === 'designer';
    const isMarketing = userRole === 'marketing';
    const isDispatch = userRole === 'dispatch';
    const isFinance  = userRole === 'finance';
    const isCmyk     = userRole === 'cmyk';
    const items: CalendarItem[] = [];

    // ── 1. Job deadlines ────────────────────────────────────────────────────
    // Admin / Finance → ALL jobs
    // Designer        → only their assigned jobs (any type)
    // Dispatch / CMYK → Print and Design+Print jobs ONLY (not design-only)
    // Marketing       → NONE
    const wantsJobs = isAdmin || isFinance || isDesigner || isDispatch || isCmyk;
    let jobsQuery = wantsJobs
        ? supabase.from('jobs')
            .select('id, job_number, project_name, client_deadline, current_stage, designer_id, job_type')
            .gte('client_deadline', startDate)
            .lte('client_deadline', endDate)
            .neq('current_stage', 'cancelled')
        : null;

    if (jobsQuery) {
        if (isDesigner) {
            // Designer sees only their own jobs
            jobsQuery = jobsQuery.eq('designer_id', userId);
        } else if (isDispatch || isCmyk) {
            // Dispatch / CMYK: exclude pure design jobs — they never reach a press
            // or a box, so they must not sit in a dispatch calendar.
            //
            // This used to test the single literal 'Design', which was the word
            // Design Studio's New Project form wrote. After the 2026-09-08 rename
            // those 182 jobs say 'Design Only', so a one-word test would have
            // matched nothing and put every design job in front of dispatch and
            // CMYK. Both spellings are excluded: the master name for everything
            // from now on, and the old one for anything that predates the rename
            // or arrives from an unmigrated source.
            jobsQuery = jobsQuery
                .neq('job_type', 'Design Only')
                .neq('job_type', 'Design');
        }
        // Admin and Finance: no extra filter — see all
    }

    // ── 2. Follow-ups → Admin + Marketing only ──────────────────────────────
    let followUpsQuery = (isAdmin || isMarketing)
        ? supabase.from('follow_ups')
            .select('id, notes, follow_up_date, lead_id, done_by, assigned_to')
            .gte('follow_up_date', startDate)
            .lte('follow_up_date', endDate)
        : null;
    if (followUpsQuery && isMarketing) {
        followUpsQuery = followUpsQuery.eq('assigned_to', userId);
    }

    // ── 3. Dispatches → Admin + Dispatch only ───────────────────────────────
    const dispatchQuery = (isAdmin || isDispatch)
        ? supabase.from('dispatches')
            .select('id, dispatch_number, dispatch_date, status, job_id')
            .gte('dispatch_date', startDate)
            .lte('dispatch_date', endDate)
        : null;

    // ── 4. Invoices → Admin + Finance (financial data) ──────────────────────
    const invoiceQuery = (isAdmin || isFinance)
        ? supabase.from('invoices')
            .select('id, invoice_number, due_date, payment_status, total_amount')
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .neq('payment_status', 'paid')
        : null;

    // ── 5. Print Runs → Admin + Designer + Dispatch + CMYK ──────────────────
    // Dispatch and CMYK need to know when print jobs finish / are ready
    const printRunQuery = (isAdmin || isDesigner || isDispatch || isCmyk)
        ? supabase.from('print_runs')
            .select('id, print_run_number, deadline, status')
            .gte('deadline', startDate)
            .lte('deadline', endDate)
            // Was .neq('status','delivered') — a value print_runs_status_check has
    // never allowed, so it excluded nothing and finished runs kept showing as
    // live deadline items on everyone's calendar.
    .not('status', 'in', '("handed_over","dispatched")')
        : null;

    // ── 6. Leads → Admin + Marketing only ───────────────────────────────────
    let leadsQuery = (isAdmin || isMarketing)
        ? supabase.from('leads')
            .select('id, lead_number, name, company, deadline, status, assigned_to')
            .gte('deadline', startDate)
            .lte('deadline', endDate)
        : null;
    if (leadsQuery && isMarketing) {
        leadsQuery = leadsQuery.eq('assigned_to', userId);
    }

    // Execute all queries in parallel — each is safe (returns [] on failure)
    const [jobs, followUps, dispatches, invoices, printRuns, leads] = await Promise.all([
        jobsQuery ? safeQuery<any>(jobsQuery, 'jobs') : Promise.resolve([]),
        followUpsQuery ? safeQuery<any>(followUpsQuery, 'follow_ups') : Promise.resolve([]),
        dispatchQuery ? safeQuery<any>(dispatchQuery, 'dispatches') : Promise.resolve([]),
        invoiceQuery ? safeQuery<any>(invoiceQuery, 'invoices') : Promise.resolve([]),
        printRunQuery ? safeQuery<any>(printRunQuery, 'print_runs') : Promise.resolve([]),
        leadsQuery ? safeQuery<any>(leadsQuery, 'leads') : Promise.resolve([]),
    ]);

    // Job deadlines
    jobs.forEach(j => {
        if (j.client_deadline) {
            items.push({
                id: `job-${j.id}`,
                title: `📦 ${j.job_number || 'Job'}: ${j.project_name || 'Untitled'}`,
                date: j.client_deadline.split('T')[0],
                type: 'deadline',
                status: j.current_stage,
                color: 'bg-amber-100 text-amber-800',
                link: '/admin/jobs',
            });
        }
    });

    // Follow-ups
    followUps.forEach(f => {
        if (f.follow_up_date) {
            items.push({
                id: `followup-${f.id}`,
                title: `📞 ${f.notes || 'Follow-up'}`,
                date: f.follow_up_date.split('T')[0],
                type: 'followup',
                status: f.done_by ? 'completed' : 'pending',
                color: 'bg-blue-100 text-blue-800',
                link: '/admin/marketing/follow-ups',
            });
        }
    });

    // Dispatches
    dispatches.forEach(d => {
        if (d.dispatch_date) {
            items.push({
                id: `dispatch-${d.id}`,
                title: `🚚 ${d.dispatch_number || 'Dispatch'}`,
                date: d.dispatch_date.split('T')[0],
                type: 'dispatch',
                status: d.status,
                color: 'bg-green-100 text-green-800',
                link: '/admin/dispatch',
            });
        }
    });

    // Invoices
    invoices.forEach(inv => {
        if (inv.due_date) {
            const amount = inv.total_amount ? ` ₹${Number(inv.total_amount).toLocaleString()}` : '';
            items.push({
                id: `invoice-${inv.id}`,
                title: `🧾 ${inv.invoice_number || 'Invoice'}${amount}`,
                date: inv.due_date.split('T')[0],
                type: 'invoice',
                status: inv.payment_status,
                color: 'bg-rose-100 text-rose-800',
                link: '/admin/finance/money-in',
            });
        }
    });

    // Print Runs
    printRuns.forEach(pr => {
        if (pr.deadline) {
            items.push({
                id: `printrun-${pr.id}`,
                title: `🖨️ ${pr.print_run_number || 'Print Run'}`,
                date: pr.deadline.split('T')[0],
                type: 'printrun',
                status: pr.status,
                color: 'bg-orange-100 text-orange-800',
                link: '/admin/print-runs',
            });
        }
    });

    // Leads
    leads.forEach(l => {
        if (l.deadline) {
            items.push({
                id: `lead-${l.id}`,
                title: `🎯 ${l.lead_number || 'Lead'}: ${l.company || l.name || 'Unknown'}`,
                date: l.deadline.split('T')[0],
                type: 'lead',
                status: l.status,
                color: 'bg-purple-100 text-purple-800',
                link: '/admin/marketing/leads',
            });
        }
    });

    return items;
}
