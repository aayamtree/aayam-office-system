// MONEY IN — who owes us, who paid, and against which invoice.
//
// Every figure is Zoho's. The app's own `invoices` table holds 2 rows and has
// been closed for writing since phase 2; Zoho holds 1,501. This door exists so
// that the question "who owes us money" has exactly one screen answering it.

import { createServerSupabase } from '@/lib/supabase-server';
import { getReceivables, type Receivables } from '@/lib/receivables';
import MoneyInClient from './MoneyInClient';

// Money figures must never be a cached copy: a payment entered a minute ago has
// to show up on the next load.
export const revalidate = 0;

export default async function MoneyInPage() {
    const supabase = createServerSupabase();

    let receivables: Receivables | null = null;
    let error: string | null = null;
    try {
        // getReceivables throws rather than returning an empty snapshot, because
        // an empty receivables list renders as "everyone has paid".
        receivables = await getReceivables(supabase);
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        console.error('[money-in] receivables failed:', error);
    }

    // The same count the sidebar badge uses, so the badge and the page agree:
    // design work sent to the client, billable, not yet paid.
    const { count: awaitingCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('current_stage', 'file_sent_client')
        .eq('design_billing', 'billable')
        .neq('payment_status', 'paid');

    return (
        <MoneyInClient
            receivables={receivables}
            error={error}
            awaitingCount={awaitingCount ?? null}
        />
    );
}
