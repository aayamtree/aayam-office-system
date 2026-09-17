// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE RECORDS ARE MISSING — one definition, every reader.
// ═══════════════════════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS (2026-09-12)
//
// Satish, on why the accounts are behind: "he maintains the accounts well but
// is unable to maintain them in our system." That is not a skill problem. A
// system that never shows what is missing cannot be maintained — you can only
// keep up with something that tells you where you are behind.
//
// Nowhere in the app did ₹71.3 lakh of uncategorised bank spend sit next to
// "no purchase bill entered in 40 days", so nobody connected them. They are
// the same fact: purchases are being paid and not booked. This file puts every
// such gap in one place, computes each one ONCE, and hands the same answer to
// the dashboard strip, the month-end close screen and the Telegram brief.
//
// THE RULES THIS FILE OBEYS
//
//  1. A FAILED QUERY IS NOT A CLEAN ONE. Every gap carries `failed`. When a
//     query errors the gap renders as "could not be checked", never as a calm
//     zero and never as green. Six defects of exactly that shape were found in
//     the finance phase-4 audit; this is the ratchet against a seventh.
//  2. NO TABLE OR COLUMN NAMES IN ANY LABEL. These strings are read by a
//     business owner and an accountant, not a developer. Same rule as
//     lib/health-message.ts.
//  3. MONEY FIRST, then time, then counts — the order a business owner scans.
//  4. STALENESS IS MEASURED, NEVER ASSUMED. Every balance carries the date it
//     was last true. A figure that stopped updating looks exactly like a figure
//     that went down, which is the most dangerous shape a number can take.
//
// WHAT IS DELIBERATELY *NOT* HERE
//   - Receivables. lib/receivables.ts already owns that definition and the
//     nightly brief reads it. A second copy here is exactly the disease.
//   - Profit or margin of any kind. Cash movement is not profit, and profit
//     needs stock, depreciation and accruals that only the CA applies.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Thresholds. Every one of these is a judgement, so it lives in one place ──
/** Purchase bills: how many days of no entry before this is worth shouting about. */
const BILLS_WARN_DAYS = 7;
const BILLS_BAD_DAYS = 14;
/** The bank feed is hand-uploaded while Zoho's auto-fetch is down. */
const FEED_WARN_DAYS = 3;
const FEED_BAD_DAYS = 7;
/** Our own cash book — the counter, the UPI accounts, cash in the drawer. */
const OWN_WARN_DAYS = 7;
const OWN_BAD_DAYS = 14;
/** Uncategorised money out. Any is bad; this is where it becomes urgent. */
const UNCAT_BAD_RUPEES = 100_000;
/** Unmatched receipts waiting in the inbox. */
const CAPTURES_WARN = 1;
const CAPTURES_BAD = 5;
/** Finished jobs nobody put a price on. */
const UNPRICED_WARN = 1;
const UNPRICED_BAD = 5;

/**
 * Hard row cap on any scan that adds figures up.
 *
 * PostgREST silently caps an unbounded select at its own default and returns
 * the slice with no warning — that is how fn_public_columns spent weeks
 * reporting 470 real columns as missing. So every counting query asks for an
 * exact count as well, and a short page is treated as UNREADABLE, never as a
 * smaller total. Raise this before the data reaches it, not after.
 */
const ROW_CAP = 5000;
const TRUNCATED_WHY = 'there is more data than this check can read in one pass';

/** True when the server holds more rows than it handed back. */
function truncated(rows: unknown[] | null, count: number | null | undefined): boolean {
    if (rows === null) return false;
    if (rows.length >= ROW_CAP) return true;
    return typeof count === 'number' && count > rows.length;
}

/**
 * ⚠ THE BLIND-READ RATCHET — the most important guard in this file.
 *
 * createServerSupabase() falls back to the ANON key when SUPABASE_SERVICE_ROLE_KEY
 * is missing. Every table this file reads has RLS granting SELECT to
 * `authenticated` only, and a denied read returns `data: []` with `error: null`.
 *
 * So on any deploy or preview without the service key, all six gaps would read
 * zero and the strip would print three emerald cells and "Every record is
 * written up" over ₹71 lakh of uncategorised spend. Green must be EARNED.
 *
 * Before trusting any emptiness, we read one row of something that cannot
 * legitimately be empty. If that comes back empty, we are blind, and every gap
 * is reported as unknown rather than clear.
 */
async function canSeeAnything(supabase: SupabaseClient): Promise<boolean> {
    const { count, error } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true });
    if (error) return false;
    return (count ?? 0) > 0;
}

export type Severity = 'ok' | 'warn' | 'bad' | 'unknown';

export interface Gap {
    key: string;
    /** Plain language. No table names, no column names. */
    label: string;
    /** The headline figure, already formatted. "—" when unknown. */
    value: string;
    /** The small line underneath. Says what to do, or what could not be read. */
    detail: string;
    severity: Severity;
    /** Where clicking goes. Every number on this page must open its own list. */
    href: string;
    /** True when the query did not answer. NEVER render this as ok. */
    failed: boolean;
    /** How many days behind, where the gap is measured in days. Null otherwise. */
    days?: number | null;
    /**
     * True when this gap is day-measured but has NO starting point at all —
     * no bill ever entered, no bank line ever loaded, no cash movement ever.
     * Worse than any number of days, and it must never be summarised as one.
     */
    neverStarted?: boolean;
}

export interface Holding {
    key: string;
    label: string;
    value: string;
    /** ISO date this balance was last moved, or null if never. */
    asOf: string | null;
    /** Days since asOf. null when unknown. */
    daysStale: number | null;
    severity: Severity;
    failed: boolean;
}

export interface Completeness {
    /** What we hold right now, each stamped with the date it was last true. */
    holdings: Holding[];
    /** What has not been recorded. */
    gaps: Gap[];
    /** Gaps that are not ok — the number the band's meter shows. */
    openCount: number;
    /** Gaps whose query failed. If this is non-zero the strip says so out loud. */
    failedCount: number;
    /** When this snapshot was taken. */
    checkedAt: string;
    /**
     * The single "how far behind are the books" number, for the headline bar.
     * The WORST of the day-measured gaps, never an average — books are only as
     * current as the thing that stopped first. Null when none could be read.
     */
    worstDaysBehind: number | 'never' | null;
    /** Severity of the gap that worstDaysBehind came from — so the headline
     *  never re-invents its own thresholds and disagrees with the strip. */
    worstDaysSeverity: Severity;
    /** True when the app could not read the records at all. Everything the
     *  strip and the headline show must be reported as unknown in that case. */
    blind: boolean;
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Indian format, no paise. Matches every other money figure in the app. */
export function inr(n: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    }).format(n);
}

/** Whole days between an ISO date and today. Null-safe, never negative-by-surprise. */
function daysSince(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return null;
    const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
    const now = new Date();
    const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((b - a) / 86_400_000);
}

/** "3 Aug" — short, human, no year unless it is not this year. */
function shortDate(iso: string | null): string {
    if (!iso) return 'never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'unknown';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
    });
}

/** A gap whose query did not answer. Never ok, never zero, always says why. */
function unreadable(key: string, label: string, href: string, why: string): Gap {
    return {
        key, label, href,
        value: '—',
        detail: `Could not be checked — ${why}`,
        severity: 'unknown',
        failed: true,
    };
}

function byDays(days: number | null, warn: number, bad: number): Severity {
    if (days === null) return 'unknown';
    if (days >= bad) return 'bad';
    if (days >= warn) return 'warn';
    return 'ok';
}

function byCount(n: number, warn: number, bad: number): Severity {
    if (n >= bad) return 'bad';
    if (n >= warn) return 'warn';
    return 'ok';
}

// ── the six gaps ───────────────────────────────────────────────────────────

/**
 * 1. Purchase bills not entered in Zoho.
 *
 * Measured from the newest bill DATE, not from when it was synced. The sync
 * runs daily and is healthy; it is the data entry that stops. Reading
 * last_synced_at here would have shown "today" and hidden the whole problem.
 */
async function billsNotEntered(supabase: SupabaseClient): Promise<Gap> {
    const href = '/admin/finance/money-out';
    const { data, error } = await supabase
        .from('zoho_documents')
        .select('doc_date')
        .eq('doc_type', 'bill')
        .not('doc_date', 'is', null)
        .order('doc_date', { ascending: false })
        .limit(1);

    if (error) return unreadable('bills', 'Purchase bills not entered', href, error.message);
    if (!data?.length) {
        return {
            key: 'bills', label: 'Purchase bills not entered', href,
            value: 'none ever', detail: 'No purchase bill has ever reached the books',
            severity: 'bad', failed: false, neverStarted: true,
        };
    }

    const last = data[0].doc_date as string;
    const days = daysSince(last);
    return {
        key: 'bills',
        label: 'Purchase bills not entered',
        value: days === null ? '—' : `${days} days`,
        detail: `Last bill dated ${shortDate(last)}`,
        severity: byDays(days, BILLS_WARN_DAYS, BILLS_BAD_DAYS),
        href,
        failed: false,
        days,
    };
}

/**
 * 2. Money that left the bank with no expense account against it.
 *
 * ⚠ ZOHO'S DIRECTION FLAG IS INVERTED. In zoho_bank_transactions,
 * debit_or_credit = 'credit' means money went OUT of our account. This cost a
 * day to find during the payment-capture work; do not "fix" it here.
 *
 * A transaction with no offset account is one nobody has told Zoho what it was
 * for. It still left the bank.
 */
async function uncategorisedSpend(supabase: SupabaseClient): Promise<Gap> {
    const href = '/admin/finance/bank-cash';
    // Every other reader in the codebase lowercases before comparing. If Zoho
    // ever emits "Credit", an .eq('credit') returns nothing and this cell would
    // print "all categorised" in green over ₹71 lakh. Fetch both and filter here.
    const { data, error, count } = await supabase
        .from('zoho_bank_transactions')
        .select('amount, offset_account_name, debit_or_credit', { count: 'exact' })
        .limit(ROW_CAP);

    if (error) return unreadable('uncategorised', 'Bank spend with no category', href, error.message);
    if (truncated(data, count)) {
        return unreadable('uncategorised', 'Bank spend with no category', href, TRUNCATED_WHY);
    }

    // ⚠ Zoho's flag is INVERTED: 'credit' means money went OUT of our account.
    const out = (data || []).filter(r => (r.debit_or_credit ?? '').toLowerCase() === 'credit');
    const open = out.filter(r => !((r.offset_account_name ?? '').trim()));
    const total = open.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    return {
        key: 'uncategorised',
        label: 'Bank spend with no category',
        value: total > 0 ? inr(total) : 'all categorised',
        detail: open.length
            ? `${open.length} payment${open.length === 1 ? '' : 's'} nobody has said what for`
            : 'Every payment out has an account against it',
        severity: total === 0 ? 'ok' : total >= UNCAT_BAD_RUPEES ? 'bad' : 'warn',
        href,
        failed: false,
    };
}

/**
 * 3. How far the bank statement has actually reached.
 *
 * Zoho's automatic fetch has been down since roughly mid-August, so every
 * statement is a manual upload. Anything that asks "has the bank confirmed
 * this yet" must compare against THIS date, never against today — otherwise
 * it reports every recent payment as unconfirmed.
 */
async function bankFeedReach(supabase: SupabaseClient): Promise<Gap> {
    const href = '/admin/finance/bank-cash';
    const { data, error } = await supabase
        .from('zoho_bank_transactions')
        .select('txn_date')
        .not('txn_date', 'is', null)
        .order('txn_date', { ascending: false })
        .limit(1);

    if (error) return unreadable('feed', 'Bank statement uploaded to', href, error.message);
    if (!data?.length) {
        return {
            key: 'feed', label: 'Bank statement uploaded to', href,
            value: 'nothing', detail: 'No bank line has ever been loaded',
            severity: 'bad', failed: false, neverStarted: true,
        };
    }

    const last = data[0].txn_date as string;
    const days = daysSince(last);
    return {
        key: 'feed',
        label: 'Bank statement uploaded to',
        value: shortDate(last),
        detail: days === null ? 'Date could not be read'
            : days <= 0 ? 'Up to date'
                : `${days} day${days === 1 ? '' : 's'} behind`,
        severity: byDays(days, FEED_WARN_DAYS, FEED_BAD_DAYS),
        href,
        failed: false,
        days,
    };
}

/**
 * 4. Receipts posted but never matched to a bank line.
 *
 * Only 'pending' counts. A rejected capture is RESOLVED — somebody looked at
 * it and said no. Counting rejected ones as outstanding fills the list with
 * items nobody can ever clear, and a list nobody can clear is one nobody reads.
 */
async function receiptsUnmatched(supabase: SupabaseClient): Promise<Gap> {
    const href = '/admin/finance/to-do';
    const { count, error } = await supabase
        .from('payment_captures')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    if (error) return unreadable('captures', 'Receipts not yet matched', href, error.message);

    const n = count || 0;
    return {
        key: 'captures',
        label: 'Receipts not yet matched',
        value: n === 0 ? 'all matched' : String(n),
        detail: n === 0
            ? 'Nothing waiting in the inbox'
            : 'Waiting for a bank line to confirm them',
        severity: byCount(n, CAPTURES_WARN, CAPTURES_BAD),
        href,
        failed: false,
    };
}

/**
 * 5. Finished work that nobody put a price on.
 *
 * Work is finished at a terminal stage — for a design-only job that is
 * "file sent to client", which is why this must agree with lib/job-workflow.ts
 * and not invent its own idea of finished.
 *
 * A job closed by hand is a decision (free work, a write-off) and is excluded.
 * A job marked paid is excluded. What is left is delivered work carrying no
 * amount at all: revenue earned and never asked for.
 */
async function jobsUnpriced(supabase: SupabaseClient, terminalStages: string[]): Promise<Gap> {
    const href = '/admin/jobs/queue';

    // TERMINAL_STAGES correctly contains 'cancelled' — a cancelled job has
    // nothing left to do. But cancelled is not FINISHED, and counting it here
    // would invent unbilled work out of jobs somebody deliberately dropped.
    const finished = terminalStages.filter(st => st !== 'cancelled');
    if (!finished.length) {
        return unreadable('unpriced', 'Finished jobs with no price', href, 'no finished stages defined');
    }

    const { data, error, count } = await supabase
        .from('jobs')
        .select('id, total_amount, payment_status, closed_manually_at', { count: 'exact' })
        .in('current_stage', finished)
        .limit(ROW_CAP);

    if (error) return unreadable('unpriced', 'Finished jobs with no price', href, error.message);
    if (truncated(data, count)) {
        return unreadable('unpriced', 'Finished jobs with no price', href, TRUNCATED_WHY);
    }

    const open = (data || []).filter(j =>
        !j.closed_manually_at &&
        (j.payment_status ?? '') !== 'paid' &&
        (Number(j.total_amount) || 0) === 0
    );

    return {
        key: 'unpriced',
        label: 'Finished jobs with no price',
        value: open.length === 0 ? 'all priced' : String(open.length),
        detail: open.length === 0
            ? 'Every finished job carries an amount'
            : 'Delivered, never costed, never billed',
        severity: byCount(open.length, UNPRICED_WARN, UNPRICED_BAD),
        href,
        failed: false,
    };
}

/**
 * 6. Our own bank book — the hand-kept mirror of the HDFC and savings accounts.
 *
 * These are the accounts kept by hand on the Bank Accounts screen, outside
 * Zoho's bank feed. They hold real balances, so a stale one is not an empty
 * one: it is a balance that stopped being true without saying so.
 *
 * This used to watch a second book as well — `cash_transactions`, the cash
 * drawer. That book was closed in September 2026: cash and UPI left this
 * system for Vyapar, the cash accounts were switched off and the table was
 * emptied. Watching it now would report a book that no longer exists as
 * permanently stale, so the check follows the bank book alone.
 */
async function ownBookStale(supabase: SupabaseClient): Promise<Gap> {
    const href = '/admin/finance/banks';

    const bankRes = await supabase.from('bank_transactions')
        .select('transaction_date')
        .not('transaction_date', 'is', null)
        .order('transaction_date', { ascending: false }).limit(1);

    if (bankRes.error) {
        return unreadable('ownbook', 'Bank book not written up', href, bankRes.error.message);
    }

    const bankLast = bankRes.data?.[0]?.transaction_date as string | undefined;

    if (!bankLast) {
        return {
            key: 'ownbook', label: 'Bank book not written up', href,
            value: 'never', detail: 'No bank movement has ever been entered',
            severity: 'bad', failed: false, neverStarted: true,
        };
    }

    const bankDays = daysSince(bankLast) ?? 0;

    return {
        key: 'ownbook',
        label: 'Bank book not written up',
        value: `${bankDays} days`,
        detail: `Last bank entry ${shortDate(bankLast)}`,
        severity: byDays(bankDays, OWN_WARN_DAYS, OWN_BAD_DAYS),
        href,
        failed: false,
        days: bankDays,
    };
}

// ── what we hold ───────────────────────────────────────────────────────────

/**
 * Cash on hand and every account balance, each stamped with the date it was
 * last moved.
 *
 * The balance and the date are ONE fact and are never separated. The Bank
 * Accounts screen currently shows a total with no date on it, which reads as
 * today's money when the newest entry behind it is weeks old.
 */
async function fetchHoldings(supabase: SupabaseClient): Promise<Holding[]> {
    const out: Holding[] = [];

    /** Newest real movement per account, from a ledger table. Null-safe. */
    async function newestByAccount(
        table: 'bank_transactions' | 'cash_transactions',
        fk: 'bank_account_id' | 'cash_account_id',
    ): Promise<{ map: Map<string, string>; readable: boolean }> {
        const { data, error, count } = await supabase
            .from(table)
            .select(`${fk}, transaction_date`, { count: 'exact' })
            .not('transaction_date', 'is', null)
            .order('transaction_date', { ascending: false })
            .limit(ROW_CAP);

        // ⚠ A truncated scan cannot answer "when did THIS account last move" —
        // an account whose newest row falls outside the page would be stamped
        // "never moved" while it moves every day. Unknown, not wrong.
        if (error || truncated(data, count)) return { map: new Map(), readable: false };

        const map = new Map<string, string>();
        for (const r of data || []) {
            const id = (r as Record<string, unknown>)[fk] as string | null;
            if (id && !map.has(id)) map.set(id, (r as { transaction_date: string }).transaction_date);
        }
        return { map, readable: true };
    }

    // ── cash in the drawer ────────────────────────────────────────────────
    // ⚠ NOT cash_accounts.updated_at. That column has no trigger behind it: a
    // rename bumps it and a cash receipt does not, so it is not a money date.
    // Verified live — one account showed updated_at 16 Jul while its newest
    // real movement was 13 Jul. A balance dated from an unrelated edit is the
    // live-numerator-over-dead-denominator bug in miniature.
    const [cashRes, cashTxn] = await Promise.all([
        supabase.from('cash_accounts')
            .select('id, name, current_balance, is_active')
            .eq('is_active', true)
            .limit(ROW_CAP),
        newestByAccount('cash_transactions', 'cash_account_id'),
    ]);

    if (cashRes.error) {
        out.push({
            key: 'cash', label: 'Cash on hand', value: '—',
            asOf: null, daysStale: null, severity: 'unknown', failed: true,
        });
    } else {
        const rows = cashRes.data || [];
        const total = rows.reduce((sum, r) => sum + (Number(r.current_balance) || 0), 0);
        // The total is only as fresh as its freshest part, and saying otherwise
        // would flatter it.
        const newest = rows
            .map(r => cashTxn.map.get(r.id as string))
            .filter((d): d is string => Boolean(d))
            .sort()
            .pop() ?? null;
        const days = cashTxn.readable ? daysSince(newest) : null;
        out.push({
            key: 'cash',
            label: 'Cash on hand',
            value: inr(total),
            asOf: cashTxn.readable ? newest : null,
            daysStale: days,
            severity: cashTxn.readable ? byDays(days, OWN_WARN_DAYS, OWN_BAD_DAYS) : 'unknown',
            failed: !cashTxn.readable,
        });
    }

    // ── bank and UPI accounts ─────────────────────────────────────────────
    // One tile each. A single "total balance" across a current account and two
    // UPI wallets answers no question anyone actually asks.
    const [bankRes, bankTxn] = await Promise.all([
        supabase.from('bank_accounts')
            .select('id, name, current_balance, account_type, is_active')
            .eq('is_active', true)
            .order('name')
            .limit(ROW_CAP),
        newestByAccount('bank_transactions', 'bank_account_id'),
    ]);

    if (bankRes.error) {
        out.push({
            key: 'banks', label: 'Bank & UPI', value: '—',
            asOf: null, daysStale: null, severity: 'unknown', failed: true,
        });
        return out;
    }

    for (const b of bankRes.data || []) {
        const bal = Number(b.current_balance) || 0;
        const asOf = bankTxn.map.get(b.id as string) ?? null;
        // Drop an account only when we can SEE that it is both empty and unused.
        // Dropping it on an unreadable scan would hide a real account.
        if (bal === 0 && bankTxn.readable && !asOf) continue;
        const days = bankTxn.readable ? daysSince(asOf) : null;
        out.push({
            key: `bank:${b.id}`,
            label: (b.name as string)?.trim() || 'Account',
            value: inr(bal),
            asOf: bankTxn.readable ? asOf : null,
            daysStale: days,
            severity: bankTxn.readable ? byDays(days, OWN_WARN_DAYS, OWN_BAD_DAYS) : 'unknown',
            failed: !bankTxn.readable,
        });
    }

    return out;
}

// ── the one entry point ────────────────────────────────────────────────────

/**
 * Everything the missing-records strip needs, in one call.
 *
 * `terminalStages` is passed in rather than imported so this file has no
 * opinion about the job pipeline — lib/job-workflow.ts owns that, and passing
 * it keeps there being exactly one definition of "finished".
 *
 * Every gap runs independently: one failing query must never take the strip
 * down with it, because a strip that vanishes tells you less than a strip with
 * one cell reading "could not be checked".
 */
export async function fetchCompleteness(
    supabase: SupabaseClient,
    terminalStages: string[],
): Promise<Completeness> {
    const [sighted, holdings, ...gaps] = await Promise.all([
        canSeeAnything(supabase).catch(() => false),
        fetchHoldings(supabase).catch((): Holding[] => ([{
            key: 'holdings', label: 'Balances', value: '—',
            asOf: null, daysStale: null, severity: 'unknown', failed: true,
        }])),
        // Money first, then time, then counts.
        uncategorisedSpend(supabase).catch(e => unreadable('uncategorised', 'Bank spend with no category', '/admin/finance/bank-cash', String(e))),
        billsNotEntered(supabase).catch(e => unreadable('bills', 'Purchase bills not entered', '/admin/finance/money-out', String(e))),
        ownBookStale(supabase).catch(e => unreadable('ownbook', 'Cash & UPI not written up', '/admin/finance/banks', String(e))),
        bankFeedReach(supabase).catch(e => unreadable('feed', 'Bank statement uploaded to', '/admin/finance/bank-cash', String(e))),
        jobsUnpriced(supabase, terminalStages).catch(e => unreadable('unpriced', 'Finished jobs with no price', '/admin/jobs/queue', String(e))),
        receiptsUnmatched(supabase).catch(e => unreadable('captures', 'Receipts not yet matched', '/admin/finance/to-do', String(e))),
    ]);

    // ⚠ If the sentinel read came back empty we are reading the database
    // blind — almost certainly RLS refusing an anon key — and every "zero"
    // above is a refusal, not a clean record. Rewrite the whole set as
    // unknown rather than print six green cells over a real backlog.
    const shown: Gap[] = sighted ? gaps : gaps.map(g => ({
        ...g,
        value: '—',
        detail: 'Could not be checked — the app could not read the records',
        severity: 'unknown' as Severity,
        failed: true,
    }));

    const holdingsShown: Holding[] = sighted ? holdings : holdings.map(h => ({
        ...h, value: '—', asOf: null, daysStale: null,
        severity: 'unknown' as Severity, failed: true,
    }));

    return {
        holdings: holdingsShown,
        gaps: shown,
        // 'unknown' counts as open. A gap we could not check is not one we closed.
        openCount: shown.filter(g => g.severity !== 'ok').length,
        // Holdings count too — a strip cannot say "everything is written up"
        // while a balance tile beside it reads "—".
        failedCount:
            shown.filter(g => g.failed).length +
            holdingsShown.filter(h => h.failed).length,
        checkedAt: new Date().toISOString(),
        ...(() => {
            const readable = shown.filter(g => !g.failed);
            // A book with no starting point beats any number of days.
            const never = readable.find(g => g.neverStarted);
            if (never) {
                return { worstDaysBehind: 'never' as const, worstDaysSeverity: never.severity };
            }
            const measured = readable.filter(g => typeof g.days === 'number');
            if (!measured.length) {
                return { worstDaysBehind: null, worstDaysSeverity: 'unknown' as Severity };
            }
            // The worst gap carries its OWN severity up. Each gap has its own
            // thresholds — the bank feed turns red at 7 days, the bills at 14 —
            // so re-thresholding the pooled number would put the headline and
            // the strip in visible disagreement.
            const worst = measured.reduce((a, b) => ((b.days as number) > (a.days as number) ? b : a));
            return { worstDaysBehind: worst.days as number, worstDaysSeverity: worst.severity };
        })(),
        blind: !sighted,
    };
}

/** Empty shape for a render that has no data yet. Deliberately all-unknown. */
export const NO_COMPLETENESS: Completeness = {
    holdings: [],
    gaps: [],
    openCount: 0,
    failedCount: 0,
    checkedAt: new Date(0).toISOString(),
    worstDaysBehind: null,
    worstDaysSeverity: 'unknown',
    blind: true,
};
