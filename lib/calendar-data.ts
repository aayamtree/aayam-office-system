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

/**
 * Fetch all time-bound business data for calendar display.
 * Admin sees everything system-wide; other roles see only their assigned items.
 */
export async function fetchCalendarBusinessData(
    startDate: string,
    endDate: string,
    userRole: string,
    userId: string
): Promise<CalendarItem[]> {
    const isAdmin = userRole === 'admin';
    const items: CalendarItem[] = [];

    try {
        // 1. Job deadlines
        let jobsQuery = supabase.from('jobs')
            .select('id, job_number, project_name, client_deadline, current_stage, designer_id')
            .gte('client_deadline', startDate)
            .lte('client_deadline', endDate)
            .neq('current_stage', 'cancelled');
        if (!isAdmin) {
            jobsQuery = jobsQuery.eq('designer_id', userId);
        }

        // 2. Follow-ups
        let followUpsQuery = supabase.from('follow_ups')
            .select('id, description, follow_up_date, status, assigned_to')
            .gte('follow_up_date', startDate)
            .lte('follow_up_date', endDate);
        if (!isAdmin) {
            followUpsQuery = followUpsQuery.eq('assigned_to', userId);
        }

        // 3. Dispatches
        let dispatchQuery = supabase.from('dispatches')
            .select('id, dispatch_date, status, job_id')
            .gte('dispatch_date', startDate)
            .lte('dispatch_date', endDate);

        // 4. Invoices (due dates for unpaid)
        let invoiceQuery = supabase.from('invoices')
            .select('id, invoice_number, due_date, payment_status, total_amount')
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .neq('payment_status', 'paid');

        // 5. Print Runs (deadlines for non-delivered)
        let printRunQuery = supabase.from('print_runs')
            .select('id, print_run_number, deadline, status')
            .gte('deadline', startDate)
            .lte('deadline', endDate)
            .neq('status', 'delivered');

        // 6. Leads (deadlines)
        let leadsQuery = supabase.from('leads')
            .select('id, lead_number, name, company, deadline, status, assigned_to')
            .gte('deadline', startDate)
            .lte('deadline', endDate);
        if (!isAdmin) {
            leadsQuery = leadsQuery.eq('assigned_to', userId);
        }

        // Execute all queries in parallel
        const [jobsRes, followUpsRes, dispatchRes, invoiceRes, printRunRes, leadsRes] = await Promise.all([
            jobsQuery, followUpsQuery, dispatchQuery, invoiceQuery, printRunQuery, leadsQuery,
        ]);

        // Job deadlines
        jobsRes.data?.forEach(j => {
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
        followUpsRes.data?.forEach(f => {
            if (f.follow_up_date) {
                items.push({
                    id: `followup-${f.id}`,
                    title: `📞 ${f.description || 'Follow-up'}`,
                    date: f.follow_up_date.split('T')[0],
                    type: 'followup',
                    status: f.status,
                    color: 'bg-blue-100 text-blue-800',
                    link: '/admin/marketing/follow-ups',
                });
            }
        });

        // Dispatches
        dispatchRes.data?.forEach(d => {
            if (d.dispatch_date) {
                items.push({
                    id: `dispatch-${d.id}`,
                    title: `🚚 Dispatch`,
                    date: d.dispatch_date.split('T')[0],
                    type: 'dispatch',
                    status: d.status,
                    color: 'bg-green-100 text-green-800',
                    link: '/admin/dispatch',
                });
            }
        });

        // Invoices
        invoiceRes.data?.forEach(inv => {
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
        printRunRes.data?.forEach(pr => {
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
        leadsRes.data?.forEach(l => {
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
    } catch (err) {
        console.error('Error fetching calendar business data:', err);
    }

    return items;
}
