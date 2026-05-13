import { createServerSupabase } from '@/lib/supabase-server';

export interface FinanceOverviewData {
    // KPI totals (this month)
    revenueThisMonth: number;
    receivedThisMonth: number;
    expensesThisMonth: number;
    outstandingTotal: number;

    // Month-over-month trend
    revenueLastMonth: number;
    receivedLastMonth: number;

    // Invoice breakdown
    invoiceCounts: { pending: number; partial: number; paid: number; overdue: number };
    invoiceTotals: { pending: number; partial: number; paid: number; overdue: number };

    // Smart nav card stats
    navStats: {
        invoices: { unpaid: number; overdueCount: number };
        payments: { receivedThisMonth: number };
        purchases: { pendingBills: number; billsAmount: number };
        expenses: { thisMonth: number; count: number };
    };

    // 6-month revenue chart
    monthlyRevenue: { month: string; revenue: number; received: number; active: boolean }[];

    // Recent invoices (last 8)
    recentInvoices: {
        id: string;
        invoice_number: string;
        client_name: string;
        client_company: string;
        total_amount: number;
        amount_paid: number;
        payment_status: string;
        due_date: string | null;
        invoice_date: string;
    }[];

    // Today's overdue count
    overdueToday: number;
}

const EMPTY: FinanceOverviewData = {
    revenueThisMonth: 0,
    receivedThisMonth: 0,
    expensesThisMonth: 0,
    outstandingTotal: 0,
    revenueLastMonth: 0,
    receivedLastMonth: 0,
    invoiceCounts: { pending: 0, partial: 0, paid: 0, overdue: 0 },
    invoiceTotals: { pending: 0, partial: 0, paid: 0, overdue: 0 },
    navStats: {
        invoices: { unpaid: 0, overdueCount: 0 },
        payments: { receivedThisMonth: 0 },
        purchases: { pendingBills: 0, billsAmount: 0 },
        expenses: { thisMonth: 0, count: 0 },
    },
    monthlyRevenue: [],
    recentInvoices: [],
    overdueToday: 0,
};

export async function fetchFinanceOverview(): Promise<FinanceOverviewData> {
    const supabase = createServerSupabase();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const today = now.toISOString().split('T')[0];
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

    const safe = async (fn: () => any, fallback: any) => {
        try { return await fn(); } catch { return fallback; }
    };

    try {
        const [
            allInvoicesRes,
            recentInvoicesRes,
            expensesThisMonthRes,
            expensesLastMonthRes,
            purchaseBillsRes,
            sixMonthSalesRes,
            bankExpensesThisMonthRes,
            bankExpensesLastMonthRes,
            bankIncomeThisMonthRes,
        ] = await Promise.all([
            // All invoices for stats
            safe(() => supabase
                .from('invoices')
                .select('id, invoice_number, total_amount, amount_paid, payment_status, due_date, invoice_date, created_at, client:clients(name, company)')
                .order('created_at', { ascending: false })
                .then(r => r), { data: [] } as any),

            // Recent 8 for the table
            safe(() => supabase
                .from('invoices')
                .select('id, invoice_number, total_amount, amount_paid, payment_status, due_date, invoice_date, client:clients(name, company)')
                .order('created_at', { ascending: false })
                .limit(8)
                .then(r => r), { data: [] } as any),

            // Expenses this month
            safe(() => supabase
                .from('expenses')
                .select('amount')
                .gte('expense_date', startOfMonth)
                .then(r => r), { data: [] } as any),

            // Expenses last month
            safe(() => supabase
                .from('expenses')
                .select('amount')
                .gte('expense_date', startOfLastMonth)
                .lt('expense_date', endOfLastMonth)
                .then(r => r), { data: [] } as any),

            // Purchase bills pending
            safe(() => supabase
                .from('purchase_bills')
                .select('id, total_amount, payment_status')
                .neq('payment_status', 'paid')
                .then(r => r), { data: [] } as any),

            // 6-month invoice data for chart
            safe(() => supabase
                .from('invoices')
                .select('total_amount, amount_paid, created_at')
                .gte('created_at', sixMonthsAgo)
                .then(r => r), { data: [] } as any),

            // Bank-verified expenses this month (salary, rent, utilities etc.)
            safe(() => supabase
                .from('bank_transactions')
                .select('amount, transaction_date')
                .eq('is_verified', true)
                .eq('categorization_type', 'expense')
                .eq('transaction_type', 'outflow')
                .gte('transaction_date', startOfMonth.split('T')[0])
                .then(r => r), { data: [] } as any),

            // Bank-verified expenses last month
            safe(() => supabase
                .from('bank_transactions')
                .select('amount, transaction_date')
                .eq('is_verified', true)
                .eq('categorization_type', 'expense')
                .eq('transaction_type', 'outflow')
                .gte('transaction_date', startOfLastMonth.split('T')[0])
                .lt('transaction_date', endOfLastMonth.split('T')[0])
                .then(r => r), { data: [] } as any),

            // Bank-verified income this month
            safe(() => supabase
                .from('bank_transactions')
                .select('amount, transaction_date')
                .eq('is_verified', true)
                .eq('categorization_type', 'income')
                .eq('transaction_type', 'inflow')
                .gte('transaction_date', startOfMonth.split('T')[0])
                .then(r => r), { data: [] } as any),
        ]);

        const allInvoices = allInvoicesRes.data || [];

        // Invoice breakdown
        const invoiceCounts = { pending: 0, partial: 0, paid: 0, overdue: 0 };
        const invoiceTotals = { pending: 0, partial: 0, paid: 0, overdue: 0 };
        let outstandingTotal = 0;
        let revenueThisMonth = 0;
        let receivedThisMonth = 0;
        let revenueLastMonth = 0;
        let receivedLastMonth = 0;

        for (const inv of allInvoices) {
            const status = inv.payment_status as keyof typeof invoiceCounts;
            if (status in invoiceCounts) {
                invoiceCounts[status]++;
                invoiceTotals[status] += inv.total_amount || 0;
            }
            if (status !== 'paid') {
                outstandingTotal += (inv.total_amount || 0) - (inv.amount_paid || 0);
            }
            // This month
            if (inv.created_at >= startOfMonth) {
                revenueThisMonth += inv.total_amount || 0;
                receivedThisMonth += inv.amount_paid || 0;
            }
            // Last month
            if (inv.created_at >= startOfLastMonth && inv.created_at < endOfLastMonth) {
                revenueLastMonth += inv.total_amount || 0;
                receivedLastMonth += inv.amount_paid || 0;
            }
        }

        // Expenses — manual + bank-verified
        const manualExpensesThisMonth = (expensesThisMonthRes.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
        const manualExpensesCount = (expensesThisMonthRes.data || []).length;
        const bankExpensesThisMonth = (bankExpensesThisMonthRes.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
        const bankExpensesCount = (bankExpensesThisMonthRes.data || []).length;
        const expensesThisMonth = manualExpensesThisMonth + bankExpensesThisMonth;
        const expensesThisMonthCount = manualExpensesCount + bankExpensesCount;

        // Bank-verified income (for cash received tracking)
        const bankIncomeThisMonth = (bankIncomeThisMonthRes.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);

        // Purchase bills
        const pendingBills = purchaseBillsRes.data || [];
        const pendingBillsAmount = pendingBills.reduce((s: number, b: any) => s + (b.total_amount || 0), 0);

        // Overdue today
        const overdueToday = allInvoices.filter((inv: any) =>
            inv.payment_status !== 'paid' && inv.due_date && inv.due_date < today
        ).length;

        // 6-month chart
        const sixMonthData = sixMonthSalesRes.data || [];
        const monthlyRevenue = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const monthLabel = monthStart.toLocaleString('en', { month: 'short' });
            const monthData = sixMonthData.filter((inv: any) => {
                const d = new Date(inv.created_at);
                return d >= monthStart && d < monthEnd;
            });
            monthlyRevenue.push({
                month: monthLabel,
                revenue: monthData.reduce((s: number, inv: any) => s + (inv.total_amount || 0), 0),
                received: monthData.reduce((s: number, inv: any) => s + (inv.amount_paid || 0), 0),
                active: i === 0,
            });
        }

        // Recent invoices
        const recentInvoices = (recentInvoicesRes.data || []).map((inv: any) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            client_name: inv.client?.name || '',
            client_company: inv.client?.company || '',
            total_amount: inv.total_amount || 0,
            amount_paid: inv.amount_paid || 0,
            payment_status: inv.payment_status,
            due_date: inv.due_date,
            invoice_date: inv.invoice_date,
        }));

        // Add bank income to received this month
        const totalReceivedThisMonth = receivedThisMonth + bankIncomeThisMonth;

        return {
            revenueThisMonth,
            receivedThisMonth: totalReceivedThisMonth,
            expensesThisMonth,
            outstandingTotal,
            revenueLastMonth,
            receivedLastMonth,
            invoiceCounts,
            invoiceTotals,
            navStats: {
                invoices: {
                    unpaid: invoiceCounts.pending + invoiceCounts.partial + invoiceCounts.overdue,
                    overdueCount: invoiceCounts.overdue,
                },
                payments: { receivedThisMonth: totalReceivedThisMonth },
                purchases: { pendingBills: pendingBills.length, billsAmount: pendingBillsAmount },
                expenses: { thisMonth: expensesThisMonth, count: expensesThisMonthCount },
            },
            monthlyRevenue,
            recentInvoices,
            overdueToday,
        };
    } catch (err) {
        console.error('Finance overview fetch error:', err);
        return EMPTY;
    }
}
