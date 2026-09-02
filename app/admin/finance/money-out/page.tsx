// MONEY OUT — who we owe, what we paid, and to which vendor.
//
// Bills come from Zoho. The app's own `purchase_bills` table holds 5 rows and
// has been closed for writing since phase 2; Zoho holds 608. Vendor master data
// is the app's own and stays that way — it was deliberately left open.

import { createServerSupabase } from '@/lib/supabase-server';
import { getPayables, ageingBuckets, type Payables } from '@/lib/payables';
import MoneyOutClient from './MoneyOutClient';

export const revalidate = 0;

export default async function MoneyOutPage() {
    const supabase = createServerSupabase();

    let payables: Payables | null = null;
    let error: string | null = null;
    try {
        // Throws rather than returning an empty snapshot: "we owe nobody" is the
        // most expensive thing this system could say the week before a payment run.
        payables = await getPayables(supabase);
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        console.error('[money-out] payables failed:', error);
    }

    const { count: vendorCount } = await supabase
        .from('vendors')
        .select('id', { count: 'exact', head: true });

    return (
        <MoneyOutClient
            payables={payables}
            ageing={payables ? ageingBuckets(payables) : []}
            error={error}
            vendorCount={vendorCount ?? null}
        />
    );
}
