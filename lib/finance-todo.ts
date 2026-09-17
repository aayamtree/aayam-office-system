// ═══════════════════════════════════════════════════════════════════════════
// THE FOUR LISTS OF UNFINISHED MONEY WORK — one definition, two readers.
// ═══════════════════════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS (2026-09-02, phase 4)
//
// These queries were written inside /api/cron/reconcile-payment-captures and
// nowhere else. The "To Do" door now shows the same four lists on screen, and
// a screen that disagrees with the nightly Telegram message destroys trust in
// both — you cannot act on a number when a second number contradicts it.
//
// The phase-3 note already warned that the cash-queue predicate was written
// three times (page, cron, index) and had to stay identical by hand. Adding a
// fourth copy for the To Do page would have made that worse. So the queries
// moved HERE, and the cron now calls them instead of holding its own. The cron
// keeps everything else it does — the matching loop and the Telegram notices —
// because a screen must never run matching: matching writes.
//
// Every comment below was carried over from the cron deliberately. They record
// bugs that were paid for once already, and each one is a rule, not a remark.
//
// WHAT THE FOUR LISTS ARE, AND WHY THEY ARE FOUR AND NOT ONE
//   1. awaitingBankConfirmation — a screenshot the statement has since covered
//      and still not shown. "Request Accepted" was never a promise it wouldn't
//      fail. Judged against how far the FEED has reached, never against today.
//   2. dateless — a receipt whose date could not be read. It belongs to no
//      other list, because every other list filters on txn_date and NULL fails
//      silently. Its own list, saying exactly that.
//   3. unannouncedOutflows — money left the bank and nobody posted a proof.
//   4. cashToEnter — cash and off-bank payments. No statement line will EVER
//      confirm these, so they are not unconfirmed, they are unentered. Mixing
//      them into list 1 would fill a warning list with entries nobody can ever
//      clear, and a list nobody can clear is one nobody reads.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

/** Ordinary grace period before an unmatched screenshot is worth a second look. */
export const STALE_DAYS = 3;
/** Cap on each capture list. A list at exactly this length is reported as "+". */
export const STALE_LIMIT = 100;
/** How far back any of this looks. Cash is the deliberate exception — see below. */
export const LOOKBACK_DAYS = 30;
/** Cap on bank outflows examined. Newest first, so a truncated page is recent. */
export const OUTFLOW_LIMIT = 500;

export interface StaleCapture {
    id: string;
    amount: number | null;
    txn_date: string | null;
    paid_to: string | null;
    paid_from: string | null;
    direction: 'in' | 'out';
    gateway_status: string | null;
}

export interface DatelessCapture {
    id: string;
    amount: number | null;
    paid_to: string | null;
    paid_from: string | null;
    direction: 'in' | 'out';
    created_at: string;
}

export interface UnannouncedOutflow {
    id: string;
    amount: number | null;
    txn_date: string | null;
    description: string | null;
    payee: string | null;
}

export interface CashToEnter {
    id: string;
    amount: number | null;
    txn_date: string | null;
    paid_to: string | null;
    paid_from: string | null;
    direction: 'in' | 'out';
    payment_method: string | null;
}

export interface FinanceTodo {
    /** Start of the lookback window, as a date string. */
    sinceIso: string;
    /** The newest line in the HDFC feed. Null when the feed is empty OR unread. */
    feedThrough: string | null;
    /**
     * The read itself failed. Kept apart from an empty feed on purpose: an empty
     * feed means "nothing can be confirmed", a failed read means "we don't know
     * anything, including that". Merged, one bad read silently reverts to the
     * today-minus-3 rule and false-accuses every payment made since the last
     * statement upload, while ALSO announcing an empty feed. Two contradictory
     * alerts in one run, both wrong.
     */
    feedReadFailed: boolean;
    /**
     * The feed has not even reached the start of the lookback window, so the
     * stale query's two bounds cross and it can only ever return nothing — a
     * permanently empty warning list that still looks healthy. The more overdue
     * the statement upload, the more completely the alarm switches itself off.
     * That is what gets reported instead.
     */
    feedBlind: boolean;
    awaitingBankConfirmation: StaleCapture[];
    dateless: DatelessCapture[];
    unannouncedOutflows: UnannouncedOutflow[];
    cashToEnter: CashToEnter[];
    truncated: { outflows: boolean; stale: boolean; claimed: boolean; cash: boolean; dateless: boolean };
    /**
     * WHICH list failed, not just that something did. A failed query returns an
     * empty array, and an empty array renders as "nothing to do" in green — the
     * strongest reassurance the screen can give, driven by a query nobody read.
     * Each flag lets its own tile stay neutral instead of turning green.
     */
    failed: { stale: boolean; dateless: boolean; outflows: boolean; cash: boolean };
    /** A failed query becomes null, becomes [], becomes "nothing to do". Never silent. */
    errors: string[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The start of the lookback window. UTC arithmetic, matching the cron exactly. */
export function lookbackSince(): string {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
    return ymd(since);
}

/**
 * How far the bank statement has actually reached.
 *
 * Everything that judges "the bank never confirmed this" measures from HERE,
 * not from today. Zoho's automatic bank fetch is broken, so statements are
 * uploaded by hand every few days; counting days from today accuses every
 * payment made since the last upload of having failed. Silence from a statement
 * that has not arrived is not evidence of anything.
 */
export async function getBankFeedTip(
    db: SupabaseClient,
): Promise<{ feedThrough: string | null; readFailed: boolean; error?: string }> {
    const { data, error } = await db
        .from('zoho_bank_transactions')
        .select('txn_date')
        .not('txn_date', 'is', null)
        .order('txn_date', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[finance-todo] could not read the bank feed tip:', error.message);
        return { feedThrough: null, readFailed: true, error: error.message };
    }
    return { feedThrough: (data?.txn_date as string) ?? null, readFailed: false };
}

/**
 * CASH AND OFF-BANK PAYMENTS WAITING TO BE TYPED INTO ZOHO.
 *
 * Exported on its own because two screens need this count and the cron needs
 * the rows, and the phase-3 note is explicit: this must select exactly what
 * isCashQueue() on the payment-captures page selects, or the Telegram count and
 * the on-screen badge disagree and neither is believed. One definition, every
 * caller — that is the whole reason this function is not inlined.
 *
 * Deliberately NO date bound: cash never ages out of needing to be entered, and
 * a typed entry ("gave 5000 cash to Ramesh") often has no date at all, so a
 * .gte() would drop exactly those rows silently.
 */
export async function getCashToEnter(
    db: SupabaseClient,
): Promise<{ data: CashToEnter[]; error: string | null; truncated: boolean }> {
    const { data, error } = await db
        .from('payment_captures')
        .select('id, amount, txn_date, paid_to, paid_from, direction, payment_method')
        .eq('needs_bank_match', false)
        .is('entered_in_books_at', null)
        // A payment the statement already proves is booked in Zoho by the feed
        // itself. Listing it here would ask someone to enter it a second time,
        // in the book of record, by hand.
        .is('zoho_bank_transaction_id', null)
        .not('status', 'in', '(rejected,duplicate)')
        .order('created_at', { ascending: true })
        .limit(STALE_LIMIT);

    if (error) {
        console.error('[finance-todo] cash queue failed:', error.message);
        return { data: [], error: error.message, truncated: false };
    }
    const rows = (data || []) as CashToEnter[];
    // At exactly the cap there are almost certainly more. Every screen that
    // shows this number must say "100+" — the payment-captures page counts the
    // same rows with a higher ceiling, and a bare "100" next to its "137" is the
    // disagreement this module exists to prevent.
    return { data: rows, error: null, truncated: rows.length === STALE_LIMIT };
}

/**
 * Every list of unfinished money work, in one call.
 *
 * Read-only. Nothing here writes, matches, or touches Zoho — the To Do screen
 * and the nightly cron both call it, and a screen must never run matching.
 */
export async function getFinanceTodo(db: SupabaseClient): Promise<FinanceTodo> {
    const errors: string[] = [];
    const sinceIso = lookbackSince();

    const tip = await getBankFeedTip(db);
    if (tip.error) errors.push(`bank feed: ${tip.error}`);
    const { feedThrough, readFailed: feedReadFailed } = tip;

    const staleCutoff = new Date();
    staleCutoff.setUTCDate(staleCutoff.getUTCDate() - STALE_DAYS);
    // Whichever is EARLIER: the ordinary grace period, or how far the feed has
    // actually reached. A capture is only suspicious once its date is behind both.
    const cutoffIso = [ymd(staleCutoff), feedThrough]
        .filter((d): d is string => Boolean(d))
        .sort()[0];

    const feedBlind = !feedReadFailed && (!feedThrough || feedThrough < sinceIso);

    // ── 1. Screenshots the bank never confirmed ───────────────────────────
    const staleRes = feedReadFailed
        ? { data: [] as StaleCapture[], error: null }
        : await db
            .from('payment_captures')
            .select('id, amount, txn_date, paid_to, paid_from, direction, gateway_status')
            .is('zoho_bank_transaction_id', null)
            .in('status', ['pending', 'confirmed'])
            .eq('needs_bank_match', true)
            .gte('txn_date', sinceIso)
            .lte('txn_date', cutoffIso)
            .order('txn_date', { ascending: true })
            .limit(STALE_LIMIT);
    if (staleRes.error) errors.push(`stale list: ${staleRes.error.message}`);

    // ── 2. Receipts with no readable date ─────────────────────────────────
    // These fall through every other net: the query above filters on txn_date,
    // and NULL fails both bounds silently. Their posting time is the only clock
    // we have, and it cannot be judged against the feed's reach.
    const datelessCutoff = new Date();
    datelessCutoff.setUTCDate(datelessCutoff.getUTCDate() - STALE_DAYS);
    const datelessRes = await db
        .from('payment_captures')
        .select('id, amount, paid_to, paid_from, direction, created_at')
        .is('zoho_bank_transaction_id', null)
        .in('status', ['pending', 'confirmed'])
        .eq('needs_bank_match', true)
        .is('txn_date', null)
        .lte('created_at', datelessCutoff.toISOString())
        .order('created_at', { ascending: true })
        .limit(STALE_LIMIT);
    if (datelessRes.error) errors.push(`dateless list: ${datelessRes.error.message}`);

    // ── 3. Money that left with no screenshot ─────────────────────────────
    // In Zoho's feed a CREDIT is money LEAVING the account — see the note in
    // lib/payment-capture.ts. Reading it the intuitive way would list incoming
    // customer payments as "unannounced spending".
    const outflowRes = await db
        .from('zoho_bank_transactions')
        .select('id, amount, txn_date, description, payee, debit_or_credit')
        .gte('txn_date', sinceIso)
        .eq('debit_or_credit', 'credit')
        // Newest first, so a truncated page is the most RECENT 500 and the
        // truncation is reported. Without an order, which 500 rows came back was
        // arbitrary and real unannounced outflows could vanish with no sign.
        .order('txn_date', { ascending: false })
        .limit(OUTFLOW_LIMIT);
    if (outflowRes.error) errors.push(`bank outflows: ${outflowRes.error.message}`);
    const outflows = outflowRes.data || [];

    // PostgREST caps an unbounded select at 1000 rows. Past 1000 matched
    // captures this set would quietly go incomplete, and bank lines that DO have
    // proof would start being reported as unannounced spending.
    const claimed = new Set<string>();
    let claimedTruncated = false;
    for (let page = 0; page < 20; page++) {
        const { data: rows, error: claimErr } = await db
            .from('payment_captures')
            .select('zoho_bank_transaction_id')
            .not('zoho_bank_transaction_id', 'is', null)
            .order('zoho_bank_transaction_id', { ascending: true })
            .range(page * 1000, page * 1000 + 999);
        if (claimErr) {
            // A failed page means the claimed set is INCOMPLETE, which turns
            // proven bank lines into false "no proof" accusations. Say so rather
            // than reporting a short set as the whole picture.
            errors.push(`matched-capture page ${page}: ${claimErr.message}`);
            claimedTruncated = true;
            break;
        }
        for (const r of rows || []) claimed.add(r.zoho_bank_transaction_id as string);
        if (!rows || rows.length < 1000) break;
        if (page === 19) claimedTruncated = true;
    }
    const unannouncedOutflows = outflows
        .filter((t) => !claimed.has(t.id as string))
        .map((t) => ({
            id: String(t.id),
            amount: t.amount as number | null,
            txn_date: (t.txn_date as string) ?? null,
            description: (t.description as string) ?? null,
            payee: (t.payee as string) ?? null,
        }));

    // ── 4. Cash waiting to be entered in Zoho ─────────────────────────────
    // This must select exactly what isCashQueue() on the payment-captures page
    // selects, or the Telegram count and the on-screen badge disagree and
    // neither is believed. Deliberately NO date bound: cash never ages out of
    // needing to be entered, and a typed entry ("gave 5000 cash to Ramesh")
    // often has no date at all — a .gte() would drop those silently.
    const cashRes = await getCashToEnter(db);
    if (cashRes.error) errors.push(`cash queue: ${cashRes.error}`);

    return {
        sinceIso,
        feedThrough,
        feedReadFailed,
        feedBlind,
        awaitingBankConfirmation: (staleRes.data || []) as StaleCapture[],
        dateless: (datelessRes.data || []) as DatelessCapture[],
        unannouncedOutflows,
        cashToEnter: cashRes.data,
        truncated: {
            outflows: outflows.length === OUTFLOW_LIMIT,
            stale: (staleRes.data || []).length === STALE_LIMIT,
            claimed: claimedTruncated,
            cash: cashRes.truncated,
            dateless: (datelessRes.data || []).length === STALE_LIMIT,
        },
        failed: {
            // A feed that could not be read means the stale list was never even
            // attempted — that is a check that did not happen, not a clean one.
            stale: Boolean(staleRes.error) || feedReadFailed,
            dateless: Boolean(datelessRes.error),
            outflows: Boolean(outflowRes.error) || claimedTruncated,
            cash: Boolean(cashRes.error),
        },
        errors,
    };
}

/** Who the money moved between, from whichever end applies. */
export function counterparty(c: {
    direction: 'in' | 'out';
    paid_to: string | null;
    paid_from: string | null;
}): string {
    return (c.direction === 'in' ? c.paid_from : c.paid_to) || 'unknown';
}

/** Total unfinished items — the number the To Do door badge shows. */
export function todoCount(t: FinanceTodo): number {
    return (
        t.awaitingBankConfirmation.length +
        t.dateless.length +
        t.unannouncedOutflows.length
    );
}
