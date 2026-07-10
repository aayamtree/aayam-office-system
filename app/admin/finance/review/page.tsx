// Server Component — Financial Review (monthly / quarterly / yearly)
// Reads the posted ledger via fn_finance_period_review, always fresh.
import { createServerSupabase } from '@/lib/supabase-server';
import ReviewClient, { type MonthRow } from './ReviewClient';

export const revalidate = 0;

export default async function FinanceReviewPage() {
    const supabase = createServerSupabase();

    // Range = first posted journal entry → today
    let fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 11); // fallback: last 12 months
    try {
        const { data: firstJe } = await supabase
            .from('journal_entries')
            .select('entry_date')
            .eq('is_posted', true)
            .order('entry_date', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (firstJe?.entry_date) fromDate = new Date(firstJe.entry_date);
    } catch { /* keep fallback */ }

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    let rows: MonthRow[] = [];
    try {
        const { data } = await supabase.rpc('fn_finance_period_review', {
            p_from: fmt(fromDate),
            p_to: fmt(new Date()),
        });
        rows = (Array.isArray(data) ? data : []).map((r: any) => ({
            month_start: r.month_start,
            label: r.label,
            income: Number(r.income) || 0,
            collected: Number(r.collected) || 0,
            expense: Number(r.expense) || 0,
            income_breakdown: (r.income_breakdown || []).map((b: any) => ({ name: b.name, amount: Number(b.amount) || 0 })),
            expense_breakdown: (r.expense_breakdown || []).map((b: any) => ({ name: b.name, amount: Number(b.amount) || 0 })),
        }));
    } catch { /* render empty state */ }

    return <ReviewClient rows={rows} />;
}
