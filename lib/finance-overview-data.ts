// ═══════════════════════════════════════════════════════════════════════════
// FINANCE OVERVIEW — every figure on this page comes from Zoho
// ═══════════════════════════════════════════════════════════════════════════
//
// WHY THIS FILE WAS REWRITTEN (2026-09-01)
//
// This is the landing page of the finance section — the first screen anyone
// opens. It used to take its "bills due" card from Zoho and EVERY OTHER number
// from the app's own ledger: `invoices` (2 rows), `expenses` (0 rows, ever),
// `bank_transactions` (dead since 2026-07-29) and fn_finance_overview_pnl
// (journal entries, dead since 2026-08-05). One true figure surrounded by six
// stale ones, with nothing on screen to tell them apart. A confident wrong
// number reads as reassurance.
//
// Zoho is the book of record — Satish's explicit decision. So:
//   · what we BILLED      → zoho_documents, doc_type='invoice'
//   · what we are OWED    → the same, balance on sent/overdue (lib/receivables)
//   · what we OWE         → zoho_documents, doc_type='bill'   (lib/payables)
//   · what MOVED          → zoho_bank_transactions, the HDFC feed
//
// TWO THINGS THAT WOULD OTHERWISE BE READ BACKWARDS
//
// 1. In Zoho's bank feed `debit_or_credit` is written from the LEDGER's point of
//    view: debit = money IN, credit = money OUT. An outgoing payment is a CREDIT
//    row. Reading it the intuitive way would show spending as income.
// 2. `balance` is what is still unpaid. Summing `total` would count money
//    already collected as though it were still owed.
//
// AND ONE HONEST LIMIT, SURFACED ON THE PAGE RATHER THAN HIDDEN
//
// Zoho's automatic bank fetch is broken, so statements are uploaded by hand
// every few days. Whatever this page says about money MOVED is only true up to
// `bankFeedThrough`. That date is returned so the page can say so out loud
// instead of implying today's figures are complete.

import { createServerSupabase } from '@/lib/supabase-server';
import { isOwedBill } from '@/lib/payables';

/** Zoho invoice statuses that still owe us money. Matches lib/receivables.ts. */
const OWED_INVOICE_STATUSES = ['sent', 'overdue'];
/** Never counted as business activity, in either direction. */
const NOT_REAL = ['draft', 'void'];

export interface FinanceOverviewData {
    billedThisMonth: number;
    receivedThisMonth: number;
    paidOutThisMonth: number;
    outstandingTotal: number;

    billedLastMonth: number;
    receivedLastMonth: number;

    /** Invoice mix. `partial` = still owed but part-collected. */
    invoiceCounts: { pending: number; partial: number; paid: number; overdue: number };
    invoiceTotals: { pending: number; partial: number; paid: number; overdue: number };

    navStats: {
        invoices: { unpaid: number; overdueCount: number };
        payments: { receivedThisMonth: number };
        purchases: { pendingBills: number; billsAmount: number };
        expenses: { thisMonth: number; count: number };
    };

    /** 6 months: what we billed vs what actually reached the bank. */
    monthlyRevenue: { month: string; revenue: number; received: number; active: boolean }[];

    /** Cash-basis view of the fiscal year, from the bank feed. NOT a ledger P&L. */
    cashflow: {
        fyLabel: string;
        monthly: { label: string; income: number; expense: number }[];
        topExpenses: { name: string; amount: number }[];
        totalIncome: number;
        totalExpense: number;
        expenseCountFY: number;
    };

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

    overdueToday: number;

    /** How far the bank feed has actually reached. Null when it has never run. */
    bankFeedThrough: string | null;
    bankFeedDaysBehind: number | null;
    /** True when the fetch itself failed — so the page shows an error, not zeroes. */
    failed: boolean;
}

const EMPTY: FinanceOverviewData = {
    billedThisMonth: 0,
    receivedThisMonth: 0,
    paidOutThisMonth: 0,
    outstandingTotal: 0,
    billedLastMonth: 0,
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
    cashflow: { fyLabel: '', monthly: [], topExpenses: [], totalIncome: 0, totalExpense: 0, expenseCountFY: 0 },
    recentInvoices: [],
    overdueToday: 0,
    bankFeedThrough: null,
    bankFeedDaysBehind: null,
    failed: true,
};

const num = (v: unknown) => Number(v) || 0;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Indian fiscal year: 1 April to 31 March. */
function fiscalYearStart(now: Date): Date {
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(year, 3, 1);
}

export async function fetchFinanceOverview(): Promise<FinanceOverviewData> {
    const supabase = createServerSupabase();

    const now = new Date();
    const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastMonthStart = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const sixMonthsAgo = ymd(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    const fyStart = fiscalYearStart(now);
    const today = ymd(now);

    try {
        const [invoicesRes, billsRes, bankRes] = await Promise.all([
            // Every invoice back to the start of the fiscal year, plus anything
            // still owed however old — an invoice from March that is still
            // unpaid belongs on this page.
            supabase
                .from('zoho_documents')
                .select('id, doc_number, doc_date, due_date, customer_name, total, balance, status')
                .eq('doc_type', 'invoice')
                // Deliberately simple: "this fiscal year, OR still unpaid".
                // A nested and(...) filter is easy to get subtly wrong, and a
                // malformed filter is a 400 that blanks the whole page.
                // Paid invoices carry balance 0, so the second clause only adds
                // genuinely open ones; draft and void are dropped in JS below.
                .or(`doc_date.gte.${ymd(fyStart)},balance.gt.0`)
                .order('doc_date', { ascending: false })
                .limit(2000),

            supabase
                .from('zoho_documents')
                .select('customer_name, balance, status')
                .eq('doc_type', 'bill')
                .gt('balance', 0)
                .limit(2000),

            // The HDFC feed. debit = money in, credit = money out.
            supabase
                .from('zoho_bank_transactions')
                .select('amount, txn_date, debit_or_credit, offset_account_name, payee, description')
                .gte('txn_date', ymd(fyStart) < sixMonthsAgo ? ymd(fyStart) : sixMonthsAgo)
                .order('txn_date', { ascending: false })
                .limit(2000),
        ]);

        // A failed query must not render as ₹0 — that is the exact failure this
        // rewrite exists to remove.
        if (invoicesRes.error || billsRes.error || bankRes.error) {
            console.error('[finance-overview] query failed:',
                invoicesRes.error?.message || billsRes.error?.message || bankRes.error?.message);
            return EMPTY;
        }

        const invoices = invoicesRes.data || [];
        const bank = bankRes.data || [];

        // ── Invoices ──────────────────────────────────────────────────────
        const invoiceCounts = { pending: 0, partial: 0, paid: 0, overdue: 0 };
        const invoiceTotals = { pending: 0, partial: 0, paid: 0, overdue: 0 };
        let outstandingTotal = 0;
        let billedThisMonth = 0;
        let billedLastMonth = 0;
        let overdueToday = 0;

        for (const inv of invoices) {
            const status = String(inv.status || '').toLowerCase();
            if (NOT_REAL.includes(status)) continue;

            const total = num(inv.total);
            const balance = num(inv.balance);
            const owed = OWED_INVOICE_STATUSES.includes(status) && balance > 0;

            if (owed) {
                outstandingTotal += balance;
                // Part-collected is its own state: "they have paid something" is
                // a different conversation from "they have paid nothing".
                const bucket = balance < total ? 'partial' : (status === 'overdue' ? 'overdue' : 'pending');
                invoiceCounts[bucket]++;
                invoiceTotals[bucket] += total;
                if (status === 'overdue') overdueToday++;
            } else if (status === 'paid') {
                invoiceCounts.paid++;
                invoiceTotals.paid += total;
            }

            const date = String(inv.doc_date || '');
            if (date >= monthStart) billedThisMonth += total;
            else if (date >= lastMonthStart && date < monthStart) billedLastMonth += total;
        }

        // ── Bank movement ─────────────────────────────────────────────────
        const isIn = (r: any) => String(r.debit_or_credit || '').toLowerCase() === 'debit';
        const isOut = (r: any) => String(r.debit_or_credit || '').toLowerCase() === 'credit';

        const sumIn = (from: string, to?: string) => bank
            .filter((r) => isIn(r) && r.txn_date >= from && (!to || r.txn_date < to))
            .reduce((s, r) => s + num(r.amount), 0);
        const sumOut = (from: string, to?: string) => bank
            .filter((r) => isOut(r) && r.txn_date >= from && (!to || r.txn_date < to))
            .reduce((s, r) => s + num(r.amount), 0);

        const receivedThisMonth = sumIn(monthStart);
        const receivedLastMonth = sumIn(lastMonthStart, monthStart);
        const paidOutThisMonth = sumOut(monthStart);
        const paidOutCount = bank.filter((r) => isOut(r) && r.txn_date >= monthStart).length;

        const bankFeedThrough = bank.length > 0
            ? bank.reduce((max, r) => (r.txn_date > max ? r.txn_date : max), bank[0].txn_date as string)
            : null;
        const bankFeedDaysBehind = bankFeedThrough
            ? Math.max(0, Math.round(
                (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${bankFeedThrough}T00:00:00Z`)) / 86400000))
            : null;

        // ── Six months: billed vs actually received ───────────────────────
        const monthlyRevenue = [];
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const s = ymd(start), e = ymd(end);
            monthlyRevenue.push({
                month: start.toLocaleString('en', { month: 'short' }),
                revenue: invoices
                    .filter((inv) => !NOT_REAL.includes(String(inv.status || '').toLowerCase())
                        && String(inv.doc_date) >= s && String(inv.doc_date) < e)
                    .reduce((sum, inv) => sum + num(inv.total), 0),
                received: sumIn(s, e),
                active: i === 0,
            });
        }

        // ── Cash-basis fiscal year, straight off the feed ─────────────────
        // Named cashflow, not P&L, because it is money in and out of one bank
        // account — not revenue and cost. Cash kept outside the bank is not here.
        const fyStartStr = ymd(fyStart);
        const fyMonths: { label: string; income: number; expense: number }[] = [];
        for (let m = new Date(fyStart); m <= now; m.setMonth(m.getMonth() + 1)) {
            const start = new Date(m.getFullYear(), m.getMonth(), 1);
            const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
            fyMonths.push({
                label: start.toLocaleString('en', { month: 'short' }),
                income: sumIn(ymd(start), ymd(end)),
                expense: sumOut(ymd(start), ymd(end)),
            });
        }

        // What the money went ON. offset_account_name is the category Satish
        // himself assigned in Zoho, so this needs no guessing on our side.
        const byCategory = new Map<string, number>();
        for (const r of bank) {
            if (!isOut(r) || String(r.txn_date) < fyStartStr) continue;
            const name = String(r.offset_account_name || '').trim() || 'Not categorised in Zoho';
            byCategory.set(name, (byCategory.get(name) || 0) + num(r.amount));
        }
        const topExpenses = Array.from(byCategory.entries())
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 6);

        // ── Bills we owe ──────────────────────────────────────────────────
        const pendingBills = (billsRes.data || []).filter((b: any) => isOwedBill(b.status));
        const pendingBillsAmount = pendingBills.reduce((s: number, b: any) => s + num(b.balance), 0);

        // ── Recent invoices ───────────────────────────────────────────────
        const recentInvoices = invoices
            .filter((inv) => !NOT_REAL.includes(String(inv.status || '').toLowerCase()))
            .slice(0, 8)
            .map((inv) => ({
                id: String(inv.id),
                invoice_number: String(inv.doc_number || ''),
                client_name: String(inv.customer_name || ''),
                client_company: String(inv.customer_name || ''),
                total_amount: num(inv.total),
                amount_paid: Math.max(0, num(inv.total) - num(inv.balance)),
                payment_status: String(inv.status || ''),
                due_date: (inv.due_date as string) || null,
                invoice_date: String(inv.doc_date || ''),
            }));

        return {
            billedThisMonth,
            receivedThisMonth,
            paidOutThisMonth,
            outstandingTotal,
            billedLastMonth,
            receivedLastMonth,
            invoiceCounts,
            invoiceTotals,
            navStats: {
                invoices: {
                    unpaid: invoiceCounts.pending + invoiceCounts.partial + invoiceCounts.overdue,
                    overdueCount: invoiceCounts.overdue,
                },
                payments: { receivedThisMonth },
                purchases: { pendingBills: pendingBills.length, billsAmount: pendingBillsAmount },
                expenses: { thisMonth: paidOutThisMonth, count: paidOutCount },
            },
            monthlyRevenue,
            cashflow: {
                fyLabel: `FY ${fyStart.getFullYear()}-${String(fyStart.getFullYear() + 1).slice(2)}`,
                monthly: fyMonths,
                topExpenses,
                totalIncome: sumIn(fyStartStr),
                totalExpense: sumOut(fyStartStr),
                expenseCountFY: bank.filter((r) => isOut(r) && String(r.txn_date) >= fyStartStr).length,
            },
            recentInvoices,
            overdueToday,
            bankFeedThrough,
            bankFeedDaysBehind,
            failed: false,
        };
    } catch (err) {
        console.error('[finance-overview] fetch error:', err);
        return EMPTY;
    }
}
