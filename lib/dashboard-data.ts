import { createServerSupabase } from './supabase-server';
import { TERMINAL_STAGES } from './job-workflow';
import { fetchCompleteness, NO_COMPLETENESS, type Completeness } from './completeness';

// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS FILE NOW IMPORTS job-workflow.ts  (2026-09-12)
//
// It never did, and that was the dashboard's biggest bug. lib/job-workflow.ts
// has always said `file_sent_client` is a TERMINAL stage — a design-only job
// is finished when the file reaches the client — and the Job Board files those
// jobs under Closed correctly.
//
// This file re-invented the test as "not delivered, not cancelled", which has
// never heard of `file_sent_client`. So 150 finished design jobs, 148 of them
// already closed by hand, marched back onto the front page every morning as
// live, late work: 174 "active" when 24 were live, 94 "delayed" when 13 were.
//
// The rule now has one home. Never write a stage list here again — import it.
// ═══════════════════════════════════════════════════════════════════════════

/** PostgREST `in` list built from the one true stage list, never hand-typed. */
const NOT_IN_PRODUCTION = `(${TERMINAL_STAGES.map(s => `"${s}"`).join(',')})`;

// Types for server-side dashboard data
export interface DashboardData {
    totalClients: number;
    activeJobs: number;
    totalRevenue: number;
    pendingPayments: number;
    pendingDispatches: number;
    leadsThisMonth: number;
    ordersThisMonth: number;
    pipeline: Record<string, number>;
    pipelineOverdue: Record<string, number>;
    alerts: {
        overduePayments: number;
        followUpsDue: number;
        lowStock: number;
        blockedJobs: number;
        blockedBreakdown: { feedback: number; payment: number };
    };
    todaysFocus: {
        jobsDue: number;
        jobsDelayed: number;
        jobsCompleted: number;
        paymentsDue: number;
    };
    vendorStats: {
        jobsAtVendor: number;
        dueToday: number;
        delayed: number;
    };
    salesPerformance: { month: string; value: number; active?: boolean }[];
    recentJobs: any[];
    /** What the records are missing, and what we hold. See lib/completeness.ts. */
    completeness: Completeness;
    // Month-over-month comparison data for KPI trend arrows
    lastMonthOrders: number;
    lastMonthRevenue: number;
    lastMonthActiveJobs: number;
}

const EMPTY: DashboardData = {
    totalClients: 0, activeJobs: 0, totalRevenue: 0, pendingPayments: 0,
    pendingDispatches: 0, leadsThisMonth: 0, ordersThisMonth: 0,
    pipeline: {}, pipelineOverdue: {},
    alerts: { overduePayments: 0, followUpsDue: 0, lowStock: 0, blockedJobs: 0, blockedBreakdown: { feedback: 0, payment: 0 } },
    todaysFocus: { jobsDue: 0, jobsDelayed: 0, jobsCompleted: 0, paymentsDue: 0 },
    vendorStats: { jobsAtVendor: 0, dueToday: 0, delayed: 0 },
    salesPerformance: [],
    recentJobs: [],
    completeness: NO_COMPLETENESS,
    lastMonthOrders: 0,
    lastMonthRevenue: 0,
    lastMonthActiveJobs: 0,
};

// Server-side fetcher — runs on the server, never in the browser
// OPTIMIZED: Reduced from 26 queries to ~10 by combining related data
export async function fetchDashboardData(): Promise<DashboardData> {
    const supabase = createServerSupabase();
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

    // 6 months ago for sales performance
    const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString();
    // Last month range
    const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch { return fallback; }
    };

    // Started before the block below so the strip's queries run ALONGSIDE the
    // rest, not after them. It never throws: one unreadable gap must not take
    // the whole dashboard down.
    const completenessPromise = fetchCompleteness(supabase, TERMINAL_STAGES)
        .catch(() => NO_COMPLETENESS);

    try {
        // ── OPTIMIZED: All queries in parallel, consolidated related ones ──
        const [
            clientsRes,
            // ONE big jobs query — get all active jobs with key fields for pipeline, overdue, focus, vendor
            activeJobsRes,
            // Revenue & pending — combined into one query
            financialsRes,
            // Orders this month
            ordersMonthRes,
            // Leads this month
            leadsMonthRes,
            // Jobs completed today
            completedTodayRes,
            // Alerts: overdue payments
            overduePaymentsRes,
            // Alerts: follow-ups (leads + follow_ups table combined)
            followUpsDueRes,
            followUpsTableRes,
            // Alerts: feedback pending
            feedbackPendingRes,
            // Sales performance — ONE query for all 6 months
            salesRes,
            // Recent jobs
            recentJobsRes,
            // Last month comparison
            lastMonthOrdersRes,
            lastMonthRevenueRes,
        ] = await Promise.all([
            // 1. Client count
            safe(async () => supabase.from('clients').select('id', { count: 'exact', head: true }), { count: 0 } as any),

            // 2. Active jobs with fields for pipeline, overdue, vendor, focus — ONE query replaces ~10 old queries
            safe(async () => supabase
                .from('jobs')
                .select('current_stage, client_deadline, internal_deadline, total_amount, amount_received, payment_status, updated_at')
                .not('current_stage', 'in', NOT_IN_PRODUCTION), { data: [] } as any),

            // 3. Financial totals (revenue this year)
            safe(async () => supabase
                .from('jobs')
                .select('total_amount')
                .not('current_stage', 'in', NOT_IN_PRODUCTION)
                .gte('created_at', startOfYear), { data: [] } as any),

            // 4. Orders this month
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth).neq('current_stage', 'cancelled'), { count: 0 } as any),

            // 5. Leads this month
            safe(async () => supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth), { count: 0 } as any),

            // 6. Jobs completed today
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'delivered').gte('updated_at', today), { count: 0 } as any),

            // 7. Overdue invoice payments
            safe(async () => supabase.from('invoices').select('id', { count: 'exact', head: true }).neq('payment_status', 'paid').not('due_date', 'is', null).lt('due_date', today), { count: 0 } as any),

            // 8. Follow-ups due (leads)
            safe(async () => supabase.from('leads').select('id', { count: 'exact', head: true }).not('next_follow_up', 'is', null).lte('next_follow_up', today).not('status', 'in', '("won","lost")'), { count: 0 } as any),

            // 9. Follow-ups due (follow_ups table)
            safe(async () => supabase.from('follow_ups').select('id', { count: 'exact', head: true }).not('follow_up_date', 'is', null).lte('follow_up_date', today), { count: 0 } as any),

            // 10. Feedback pending (approval stage)
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'approval'), { count: 0 } as any),

            // 11. Sales performance — ONE query for all 6 months instead of 6 separate queries
            safe(async () => supabase
                .from('jobs')
                .select('total_amount, created_at')
                .gte('created_at', sixMonthsAgo)
                .neq('current_stage', 'cancelled'), { data: [] } as any),

            // 12. Recent jobs for table
            safe(async () => supabase.from('jobs').select('id, job_number, project_name, current_stage, total_amount, client:clients(name)').order('created_at', { ascending: false }).limit(5), { data: [] } as any),

            // 13. Orders last month (for trend comparison)
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', startOfLastMonth).lt('created_at', endOfLastMonth).neq('current_stage', 'cancelled'), { count: 0 } as any),

            // 14. Revenue last month (for trend comparison)
            safe(async () => supabase.from('jobs').select('total_amount').gte('created_at', startOfLastMonth).lt('created_at', endOfLastMonth).neq('current_stage', 'cancelled'), { data: [] } as any),
        ]);

        // ── Process active jobs data (ONE query → many stats) ──
        const activeJobs = activeJobsRes.data || [];
        const pipeline: Record<string, number> = {};
        const pipelineOverdue: Record<string, number> = {};
        let pendingPayments = 0;
        let dispatchCount = 0;
        let jobsDueToday = 0;
        let jobsDelayed = 0;
        let vendorCount = 0;
        let vendorDueToday = 0;
        let vendorDelayed = 0;

        for (const job of activeJobs) {
            const stage = job.current_stage || 'new';

            // Pipeline count
            pipeline[stage] = (pipeline[stage] || 0) + 1;

            // Overdue pipeline
            if (job.client_deadline && job.client_deadline < today) {
                pipelineOverdue[stage] = (pipelineOverdue[stage] || 0) + 1;
            }

            // Pending payments
            if (job.payment_status !== 'paid') {
                pendingPayments += (job.total_amount || 0) - (job.amount_received || 0);
            }

            // Dispatch count
            if (stage === 'ready' || stage === 'packed') {
                dispatchCount++;
            }

            // Today's focus
            if (job.client_deadline === today) {
                jobsDueToday++;
            }
            if (job.client_deadline && job.client_deadline < today) {
                jobsDelayed++;
            }

            // Vendor stats
            if (stage === 'printing' || stage === 'finishing') {
                vendorCount++;
                if (job.internal_deadline === today) vendorDueToday++;
                if (job.internal_deadline && job.internal_deadline < today) vendorDelayed++;
            }
        }

        // ── Process financials ──
        const totalRevenue = (financialsRes.data || []).reduce((s: number, j: any) => s + (j.total_amount || 0), 0);

        // ── Process sales performance from ONE query ──
        const now = new Date();
        const salesPerformance: { month: string; value: number; active?: boolean }[] = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const monthLabel = monthStart.toLocaleString('en', { month: 'short' });
            const monthValue = (salesRes.data || [])
                .filter((j: any) => {
                    const d = new Date(j.created_at);
                    return d >= monthStart && d < monthEnd;
                })
                .reduce((s: number, j: any) => s + (j.total_amount || 0), 0);
            salesPerformance.push({ month: monthLabel, value: monthValue, active: i === 0 });
        }

        const feedbackCount = feedbackPendingRes.count || 0;

        return {
            totalClients: clientsRes.count || 0,
            activeJobs: activeJobs.length,
            totalRevenue,
            pendingPayments,
            pendingDispatches: dispatchCount,
            leadsThisMonth: leadsMonthRes.count || 0,
            ordersThisMonth: ordersMonthRes.count || 0,
            pipeline,
            pipelineOverdue,
            alerts: {
                overduePayments: overduePaymentsRes.count || 0,
                followUpsDue: (followUpsDueRes.count || 0) + (followUpsTableRes.count || 0),
                lowStock: 0,
                blockedJobs: feedbackCount,
                blockedBreakdown: { feedback: feedbackCount, payment: 0 },
            },
            todaysFocus: {
                jobsDue: jobsDueToday,
                jobsDelayed: jobsDelayed,
                jobsCompleted: completedTodayRes.count || 0,
                paymentsDue: 0,
            },
            vendorStats: {
                jobsAtVendor: vendorCount,
                dueToday: vendorDueToday,
                delayed: vendorDelayed,
            },
            salesPerformance,
            recentJobs: recentJobsRes.data || [],
            completeness: await completenessPromise,
            lastMonthOrders: lastMonthOrdersRes.count || 0,
            lastMonthRevenue: (lastMonthRevenueRes.data || []).reduce((s: number, j: any) => s + (j.total_amount || 0), 0),
            lastMonthActiveJobs: 0, // Snapshot stat — not tracked historically, use 0
        };
    } catch (error) {
        console.error('Server dashboard fetch error:', error);
        return EMPTY;
    }
}
