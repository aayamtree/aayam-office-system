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
        console.log(`[Calendar] ${label || 'query'}: ${(data ?? []).length} items`);
        return (data ?? []) as T[];
    } catch (e: any) {
        console.warn(`[Calendar] ${label || 'query'} exception:`, e?.message);
        return [];
    }
}

/**
 * Fetch all time-bound business data for calendar display.
 * Admin sees everything system-wide; other roles see only their assigned items.
 * Each query is independent — a missing table won't break other data.
 */
export async function fetchCalendarBusinessData(
    startDate: string,
    endDate: string,
    userRole: string,
    userId: string
): Promise<CalendarItem[]> {
    /**
     * ROLE-BASED VISIBILITY RULES:
     *  Admin      → everything system-wide
     *  Marketing  → follow-ups (assigned), leads (assigned), quotation deadlines (created by / assigned)
     *  Designer   → their own job deadlines, design task deadlines
     *  Dispatch   → dispatches, job deadlines
     *  (others)   → only their own events
     */
    const isAdmin = userRole === 'admin';
    const isDesigner = userRole === 'designer';
    const isMarketing = userRole === 'marketing';
    const isDispatch = userRole === 'dispatch';
    const items: CalendarItem[] = [];

    // 1. Job deadlines
    //    Admin → all | Designer → their own | Dispatch → all | Marketing → NONE
    let jobsQuery = !isMarketing
        ? supabase.from('jobs')
            .select('id, job_number, project_name, client_deadline, current_stage, designer_id')
            .gte('client_deadline', startDate)
            .lte('client_deadline', endDate)
            .neq('current_stage', 'cancelled')
        : null;
    if (jobsQuery && isDesigner) {
        jobsQuery = jobsQuery.eq('designer_id', userId);
    }

    // 2. Follow-ups → Admin + Marketing only (not designers, not dispatch)
    let followUpsQuery = (isAdmin || isMarketing)
        ? supabase.from('follow_ups')
            .select('id, notes, follow_up_date, lead_id, done_by, assigned_to')
            .gte('follow_up_date', startDate)
            .lte('follow_up_date', endDate)
        : null;
    // Marketing: only their own follow-ups
    if (followUpsQuery && isMarketing) {
        followUpsQuery = followUpsQuery.eq('assigned_to', userId);
    }

    // 3. Dispatches → Admin + Dispatch role only (NOT marketing, NOT designers)
    const dispatchQuery = (isAdmin || isDispatch)
        ? supabase.from('dispatches')
            .select('id, dispatch_number, dispatch_date, status, job_id')
            .gte('dispatch_date', startDate)
            .lte('dispatch_date', endDate)
        : null;

    // 4. Invoices → Admin ONLY (financial data)
    const invoiceQuery = isAdmin
        ? supabase.from('invoices')
            .select('id, invoice_number, due_date, payment_status, total_amount')
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .neq('payment_status', 'paid')
        : null;

    // 5. Print Runs → Admin + Designers only (NOT marketing, NOT dispatch)
    const printRunQuery = (isAdmin || isDesigner)
        ? supabase.from('print_runs')
            .select('id, print_run_number, deadline, status')
            .gte('deadline', startDate)
            .lte('deadline', endDate)
            .neq('status', 'delivered')
        : null;

    // 6. Leads → Admin + Marketing only, marketing sees only their assigned leads
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
                link: '/admin/finance/invoices',
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
