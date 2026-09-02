// Server Component — fetches all finance overview data server-side
// No 'use client' — this runs on the server, renders instantly with real data
import { fetchFinanceOverview } from '@/lib/finance-overview-data';
import { createServerSupabase } from '@/lib/supabase-server';
import { getCashToEnter } from '@/lib/finance-todo';
import FinanceClient from './FinanceClient';

// Always render fresh: finance figures must reflect a just-logged expense/payment
// immediately, not a cached copy up to a minute old.
export const revalidate = 0;

export default async function FinancePage() {
    const [data, cash] = await Promise.all([
        fetchFinanceOverview(),
        // The one shared definition of the cash queue — the same rows the
        // nightly Telegram message counts. A second definition here would drift,
        // and two disagreeing counts get neither believed.
        getCashToEnter(createServerSupabase()),
    ]);

    return (
        <FinanceClient
            data={data}
            // A failed count must not render as a confident "0 cash to enter".
            cashToEnter={cash.error ? null : cash.data.length}
            cashTruncated={cash.truncated}
        />
    );
}
