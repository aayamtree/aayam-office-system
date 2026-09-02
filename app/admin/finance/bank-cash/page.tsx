// BANK & CASH — what the bank shows, and what is still to enter.
//
// Two halves that must never be mixed up. The BANK half is Zoho's HDFC feed:
// evidence that money actually moved. The CASH half is payments that will never
// appear on any statement, so no feed can ever confirm them — they are not
// unconfirmed, they are unentered, and the fix is to type them into Zoho once.
//
// Zoho's automatic bank fetch is broken, so statements are uploaded by hand
// every few days. Everything the bank half says is only true up to the newest
// line in the feed, and this page says that out loud rather than implying that
// today's figures are complete.

import { createServerSupabase } from '@/lib/supabase-server';
import { getBankFeedTip, getCashToEnter } from '@/lib/finance-todo';
import BankCashClient from './BankCashClient';

export const revalidate = 0;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function BankCashPage() {
    const supabase = createServerSupabase();

    const now = new Date();
    const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    // 45 days back or the start of this month, whichever reaches further, so the
    // month totals are always complete even early in a month.
    const fortyFiveBack = ymd(new Date(now.getTime() - 45 * 86_400_000));
    const from = fortyFiveBack < monthStart ? fortyFiveBack : monthStart;

    const [tip, cash, linesRes, accountsRes] = await Promise.all([
        getBankFeedTip(supabase),
        getCashToEnter(supabase),
        supabase
            .from('zoho_bank_transactions')
            .select('id, amount, txn_date, debit_or_credit, payee, description, offset_account_name')
            .gte('txn_date', from)
            .order('txn_date', { ascending: false })
            .limit(300),
        supabase.from('bank_accounts').select('id', { count: 'exact', head: true }),
    ]);

    if (linesRes.error) console.error('[bank-cash] bank lines failed:', linesRes.error.message);

    return (
        <BankCashClient
            feedThrough={tip.feedThrough}
            feedReadFailed={tip.readFailed}
            lines={(linesRes.data || []) as any[]}
            linesError={linesRes.error?.message ?? null}
            monthStart={monthStart}
            cashToEnter={cash.data.length}
            cashTruncated={cash.truncated}
            cashError={cash.error}
            accountCount={accountsRes.count ?? null}
            today={ymd(now)}
        />
    );
}
