import { createServerSupabase } from './supabase-server';

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
};

// Server-side fetcher — runs on the server, never in the browser
// All queries run in parallel for speed
export async function fetchDashboardData(): Promise<DashboardData> {
    const supabase = createServerSupabase();
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch { return fallback; }
    };

    try {
        // ── All queries in parallel ──
        const [
            clientsRes, activeJobsRes, revenueRes, pendingRes,
            ordersMonthRes, leadsMonthRes, dispatchesRes,
            pipelineRes, pipelineOverdueRes,
            jobsDueTodayRes, jobsDelayedRes, jobsCompletedRes,
            overduePaymentsRes, followUpsDueRes, followUpsTableRes, feedbackPendingRes,
            vendorRes, vendorDueTodayRes, vendorDelayedRes,
            recentJobsRes,
        ] = await Promise.all([
            // Core KPIs
            safe(async () => supabase.from('clients').select('id', { count: 'exact', head: true }), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).not('current_stage', 'in', '("delivered","cancelled")'), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('total_amount').not('current_stage', 'in', '("delivered","cancelled")').gte('created_at', startOfYear), { data: [] } as any),
            safe(async () => supabase.from('jobs').select('total_amount, amount_received').neq('payment_status', 'paid').not('current_stage', 'in', '("delivered","cancelled")'), { data: [] } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth).neq('current_stage', 'cancelled'), { count: 0 } as any),
            safe(async () => supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['ready', 'packed']), { count: 0 } as any),
            // Pipeline
            safe(async () => supabase.from('jobs').select('current_stage').not('current_stage', 'in', '("delivered","cancelled")'), { data: [] } as any),
            safe(async () => supabase.from('jobs').select('current_stage').not('current_stage', 'in', '("delivered","cancelled")').not('client_deadline', 'is', null).lt('client_deadline', today), { data: [] } as any),
            // Today's focus
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).not('current_stage', 'in', '("delivered","cancelled")').eq('client_deadline', today), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).not('current_stage', 'in', '("delivered","cancelled")').lt('client_deadline', today).not('client_deadline', 'is', null), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'delivered').gte('updated_at', today), { count: 0 } as any),
            // Alerts
            safe(async () => supabase.from('invoices').select('id', { count: 'exact', head: true }).neq('payment_status', 'paid').not('due_date', 'is', null).lt('due_date', today), { count: 0 } as any),
            safe(async () => supabase.from('leads').select('id', { count: 'exact', head: true }).not('next_follow_up', 'is', null).lte('next_follow_up', today).not('status', 'in', '("won","lost")'), { count: 0 } as any),
            safe(async () => supabase.from('follow_ups').select('id', { count: 'exact', head: true }).not('follow_up_date', 'is', null).lte('follow_up_date', today), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'approval'), { count: 0 } as any),
            // Vendor stats
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['printing', 'finishing']), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['printing', 'finishing']).eq('internal_deadline', today), { count: 0 } as any),
            safe(async () => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['printing', 'finishing']).not('internal_deadline', 'is', null).lt('internal_deadline', today), { count: 0 } as any),
            // Recent jobs for table
            safe(async () => supabase.from('jobs').select('id, job_number, project_name, current_stage, total_amount, client:clients(name)').order('created_at', { ascending: false }).limit(5), { data: [] } as any),
        ]);

        const totalRevenue = (revenueRes.data || []).reduce((s: number, j: any) => s + (j.total_amount || 0), 0);
        const pendingPayments = (pendingRes.data || []).reduce((s: number, j: any) => s + ((j.total_amount || 0) - (j.amount_received || 0)), 0);

        const pipeline: Record<string, number> = {};
        (pipelineRes.data || []).forEach((j: any) => { const s = j.current_stage || 'new'; pipeline[s] = (pipeline[s] || 0) + 1; });

        const pipelineOverdue: Record<string, number> = {};
        (pipelineOverdueRes.data || []).forEach((j: any) => { const s = j.current_stage || 'new'; pipelineOverdue[s] = (pipelineOverdue[s] || 0) + 1; });

        // Sales performance (monthly, last 6 months)
        let salesPerformance: { month: string; value: number; active?: boolean }[] = [];
        try {
            const now = new Date();
            const months: { start: Date; label: string; active: boolean }[] = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push({ start: d, label: d.toLocaleString('en', { month: 'short' }), active: i === 0 });
            }
            salesPerformance = await Promise.all(months.map(async (m) => {
                const end = new Date(m.start.getFullYear(), m.start.getMonth() + 1, 1);
                const { data } = await supabase.from('jobs').select('total_amount').gte('created_at', m.start.toISOString()).lt('created_at', end.toISOString()).neq('current_stage', 'cancelled');
                return { month: m.label, value: (data || []).reduce((s: number, j: any) => s + (j.total_amount || 0), 0), active: m.active };
            }));
        } catch { salesPerformance = []; }

        const feedbackCount = feedbackPendingRes.count || 0;

        return {
            totalClients: clientsRes.count || 0,
            activeJobs: activeJobsRes.count || 0,
            totalRevenue,
            pendingPayments,
            pendingDispatches: dispatchesRes.count || 0,
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
                jobsDue: jobsDueTodayRes.count || 0,
                jobsDelayed: jobsDelayedRes.count || 0,
                jobsCompleted: jobsCompletedRes.count || 0,
                paymentsDue: 0,
            },
            vendorStats: {
                jobsAtVendor: vendorRes.count || 0,
                dueToday: vendorDueTodayRes.count || 0,
                delayed: vendorDelayedRes.count || 0,
            },
            salesPerformance,
            recentJobs: recentJobsRes.data || [],
        };
    } catch (error) {
        console.error('Server dashboard fetch error:', error);
        return EMPTY;
    }
}
