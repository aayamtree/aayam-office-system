// GET /api/cron/reconcile-payment-captures — match payment screenshots against
// the HDFC bank feed, and surface the two exceptions that matter.
//
// WHY THIS RUNS AFTER zoho-bank-sync
// A screenshot arrives the moment a payment is made; the bank line arrives in
// Zoho hours or a day later. So captures are matched on a schedule, not once.
//
// WHAT IT IS FOR
// The matching is the small half. The valuable half is the two lists it
// produces, which nobody was watching before:
//   · a screenshot the statement has since covered and still not shown — the
//     payment may have failed, and "Request Accepted" was never a promise it
//     wouldn't. Measured against how far the FEED has reached, never against
//     today: statements arrive by hand in batches, and silence from a statement
//     that has not arrived is not evidence of anything.
//   · a bank OUTFLOW with no screenshot — money left the account and nobody
//     announced it in the group.
//   · CASH waiting to be entered in Zoho — no statement line will ever confirm
//     these, so they are not unconfirmed, they are unentered. Different problem,
//     different fix, its own list. Mixing them would fill the warning list with
//     entries nobody can ever clear, and a list nobody can clear is one nobody
//     reads.
//
// SAFETY
//  - Read-mostly. The only writes are to payment_captures (an inbox table).
//  - Never touches bank_transactions, vendor_payments, journals, or Zoho.
//  - Idempotent: a matched capture is skipped on every later run.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron } from '@/lib/api-auth';
import { tryMatch } from '@/lib/telegram-payment-capture';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STALE_DAYS = 3;
const STALE_LIMIT = 100;
const LOOKBACK_DAYS = 30;

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
    const sinceIso = since.toISOString().slice(0, 10);

    // ── 1. Match everything still unmatched ───────────────────────────────
    const { data: unmatched, error } = await db
        .from('payment_captures')
        .select('id, amount, txn_date, paid_to, paid_from, direction, reference_number, gateway_status, created_at')
        .is('zoho_bank_transaction_id', null)
        .in('status', ['pending', 'confirmed'])
        .eq('needs_bank_match', true)
        .gte('txn_date', sinceIso)
        .order('txn_date', { ascending: true })
        .limit(200);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let matched = 0;
    for (const capture of unmatched || []) {
        try {
            if (await tryMatch(db, capture.id)) matched++;
        } catch (err) {
            // One bad row must not stop the run.
            console.error('[reconcile] capture', capture.id, err);
        }
    }

    // ── 2. Screenshots the bank never confirmed ───────────────────────────
    // Re-read rather than filtering the array from before the matching loop.
    // That snapshot is stale by now, so a 4-day-old capture whose bank line
    // landed overnight was reported as "the bank never confirmed this" in the
    // same response that had just confirmed it.
    //
    // MEASURED AGAINST THE FEED, NOT AGAINST TODAY.
    // "Three days old" is the wrong question. The right one is "has the bank
    // statement reached this payment's date yet, and still not shown it?"
    // Zoho's automatic bank fetch is broken, so statements arrive by hand in
    // batches; counting days from today accused every payment made since the
    // last upload of having failed. Silence from a statement that has not
    // arrived is not evidence of anything.
    const { data: feedTip, error: feedErr } = await db
        .from('zoho_bank_transactions')
        .select('txn_date')
        .not('txn_date', 'is', null)
        .order('txn_date', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
    // A failed read and an empty feed both leave feedTip null, and they call for
    // opposite behaviour: an empty feed means "nothing can be confirmed", a
    // failed read means "we don't know anything, including that". Left merged,
    // one bad read would silently revert the cutoff to the today-minus-3 rule
    // this whole change exists to remove — false-accusing every payment made
    // since the last statement upload — while ALSO announcing that the bank
    // feed is empty. Two contradictory alerts in one run, both wrong.
    const feedReadFailed = Boolean(feedErr);
    if (feedErr) console.error('[reconcile] could not read the bank feed tip:', feedErr.message);
    const feedThrough: string | null = feedTip?.txn_date ?? null;

    const staleCutoff = new Date();
    staleCutoff.setUTCDate(staleCutoff.getUTCDate() - STALE_DAYS);
    // Whichever is EARLIER: the ordinary grace period, or how far the feed has
    // actually reached. A capture is only suspicious once its date is behind
    // both.
    const cutoffIso = [staleCutoff.toISOString().slice(0, 10), feedThrough]
        .filter((d): d is string => Boolean(d))
        .sort()[0];

    // If the feed has not reached even the start of the lookback window, the
    // two bounds cross and the query below can only ever return nothing — a
    // permanently empty warning list that still reports ok:true. The more
    // overdue the statement upload, the more completely the alarm would switch
    // itself off, so THAT is what gets reported instead.
    const feedBlind = !feedReadFailed && (!feedThrough || feedThrough < sinceIso);
    const { data: stale, error: staleErr } = feedReadFailed ? { data: [], error: null } : await db
        .from('payment_captures')
        .select('id, amount, txn_date, paid_to, paid_from, direction, gateway_status')
        .is('zoho_bank_transaction_id', null)
        .in('status', ['pending', 'confirmed'])
        .eq('needs_bank_match', true)
        .gte('txn_date', sinceIso)
        .lte('txn_date', cutoffIso)
        .order('txn_date', { ascending: true })
        .limit(STALE_LIMIT);

    // A screenshot whose date could not be read fell through every net: the
    // query above filters on txn_date, and NULL fails both bounds silently, so
    // a payment that may have failed sat in "needs attention" for ever with
    // nothing anywhere raising it. Its posting time is the only clock we have,
    // and it cannot be judged against the feed's reach — so it gets its own
    // list, which says exactly that.
    const datelessCutoff = new Date();
    datelessCutoff.setUTCDate(datelessCutoff.getUTCDate() - STALE_DAYS);
    const { data: dateless, error: datelessErr } = await db
        .from('payment_captures')
        .select('id, amount, paid_to, paid_from, direction, created_at')
        .is('zoho_bank_transaction_id', null)
        .in('status', ['pending', 'confirmed'])
        .eq('needs_bank_match', true)
        .is('txn_date', null)
        .lte('created_at', datelessCutoff.toISOString())
        .order('created_at', { ascending: true })
        .limit(STALE_LIMIT);

    // ── 3. Money that left with no screenshot ─────────────────────────────
    // In Zoho's feed a CREDIT is money leaving the account — see the note in
    // lib/payment-capture.ts. Reading it the intuitive way would list incoming
    // customer payments as "unannounced spending".
    const OUTFLOW_LIMIT = 500;
    const { data: outflows } = await db
        .from('zoho_bank_transactions')
        .select('id, amount, txn_date, description, payee, debit_or_credit')
        .gte('txn_date', sinceIso)
        .eq('debit_or_credit', 'credit')
        // Ordered newest-first so a truncated page is the most recent 500, and
        // the truncation is reported below. Without an order, which 500 rows
        // came back was arbitrary and real unannounced outflows could vanish
        // with no sign that anything had been left out.
        .order('txn_date', { ascending: false })
        .limit(OUTFLOW_LIMIT);

    // PostgREST caps an unbounded select at 1000 rows. Past 1000 matched
    // captures this set would quietly go incomplete, and bank lines that DO
    // have proof would start being reported as unannounced spending.
    const claimed = new Set<string>();
    let claimedTruncated = false;
    for (let page = 0; page < 20; page++) {
        const { data: rows } = await db
            .from('payment_captures')
            .select('zoho_bank_transaction_id')
            .not('zoho_bank_transaction_id', 'is', null)
            .order('zoho_bank_transaction_id', { ascending: true })
            .range(page * 1000, page * 1000 + 999);
        for (const r of rows || []) claimed.add(r.zoho_bank_transaction_id as string);
        if (!rows || rows.length < 1000) break;
        if (page === 19) claimedTruncated = true;
    }

    const unannounced = (outflows || []).filter((t) => !claimed.has(t.id));

    // ── 4. Tell a human ───────────────────────────────────────────────────
    // These two lists are the point of the whole feature, and until now they
    // existed only in an HTTP response body that nothing reads. They go into
    // the watchman outbox, which /api/cron/watchman delivers to Telegram.
    const notices: { kind: string; title: string; body: string; dedupe_key: string; app_path: string }[] = [];
    if ((stale || []).length > 0) {
        const lines = (stale || []).slice(0, 8).map((c) => {
            const who = (c.direction === 'in' ? c.paid_from : c.paid_to) || 'unknown';
            const verb = c.direction === 'in' ? 'from' : 'to';
            return `• ₹${Number(c.amount || 0).toLocaleString('en-IN')} ${verb} ${who} (${c.txn_date})` +
                (c.gateway_status ? ` — receipt said "${c.gateway_status}"` : '');
        });
        notices.push({
            // watchman_notices.kind is CHECK-constrained to
            // approval | decision | summary | alert. Anything else is rejected
            // with 23514 and the notice is never queued — which would have made
            // the most valuable half of this feature silently do nothing.
            kind: 'alert',
            title: `${(stale || []).length}${(stale || []).length === STALE_LIMIT ? '+' : ''} payment${(stale || []).length > 1 ? 's' : ''} the bank has not confirmed`,
            body: (feedThrough
                    ? `A screenshot was shared, and the newest line in the bank feed is now ` +
                      `${feedThrough} with no sign of it. `
                    : `A screenshot was shared and no matching bank line has appeared. `) +
                `An accepted request can still fail — worth checking.\n\n${lines.join('\n')}` +
                ((stale || []).length > 8 ? `\n…and ${(stale || []).length - 8} more.` : ''),
            dedupe_key: `payment_unconfirmed_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/payment-captures',
        });
    }
    if ((dateless || []).length > 0) {
        const n = (dateless || []).length;
        const lines = (dateless || []).slice(0, 8).map((c) => {
            const who = (c.direction === 'in' ? c.paid_from : c.paid_to) || 'unknown';
            const verb = c.direction === 'in' ? 'from' : 'to';
            return `• ₹${Number(c.amount || 0).toLocaleString('en-IN')} ${verb} ${who}` +
                ` (posted ${String(c.created_at).slice(0, 10)})`;
        });
        notices.push({
            kind: 'alert',
            title: `${n}${n === STALE_LIMIT ? '+' : ''} payment${n > 1 ? 's' : ''} with no readable date`,
            body: `The date could not be read off ${n > 1 ? 'these receipts' : 'this receipt'}, so ` +
                `nothing can check ${n > 1 ? 'them' : 'it'} against the statement — not even to say ` +
                `${n > 1 ? 'they are' : 'it is'} fine. Open the screenshot and set the date, or mark ` +
                `${n > 1 ? 'them' : 'it'} as cash.\n\n${lines.join('\n')}` +
                (n > 8 ? `\n…and ${n - 8} more.` : ''),
            dedupe_key: `payment_dateless_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/payment-captures',
        });
    }
    if (unannounced.length > 0) {
        const lines = unannounced.slice(0, 8).map(
            (t) => `• ₹${Number(t.amount || 0).toLocaleString('en-IN')} — ${t.payee || t.description || 'no payee'} (${t.txn_date})`
        );
        notices.push({
            kind: 'alert',
            title: `${unannounced.length} payment${unannounced.length > 1 ? 's' : ''} left the bank with no screenshot`,
            body: `These went out of the account in the last ${LOOKBACK_DAYS} days and nobody shared a proof in the payments group.` +
                `\n\n${lines.join('\n')}` +
                (unannounced.length > 8 ? `\n…and ${unannounced.length - 8} more.` : ''),
            dedupe_key: `payment_no_proof_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/payment-captures',
        });
    }
    if (feedReadFailed) {
        notices.push({
            kind: 'alert',
            title: `The bank check could not run`,
            body: `Reading the bank feed failed, so no payment was checked against the statement ` +
                `tonight. This is not a clean bill of health — it is a check that did not happen.`,
            dedupe_key: `payment_feed_unreadable_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/zoho',
        });
    }
    if (feedBlind) {
        notices.push({
            kind: 'alert',
            title: feedThrough
                ? `The bank statement is ${LOOKBACK_DAYS}+ days behind`
                : `No bank statement data at all`,
            body: feedThrough
                ? `The newest line in the bank feed is ${feedThrough}. Until a more recent statement ` +
                  `is uploaded to Zoho, no payment can be confirmed and this check cannot tell a failed ` +
                  `payment from an unrecorded one — so it is reporting nothing rather than a reassuring zero.`
                : `The bank feed is empty, so nothing can be confirmed and this check is blind. ` +
                  `Upload a statement to Zoho, or check the Zoho connection.`,
            dedupe_key: `payment_feed_blind_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/zoho',
        });
    }

    // ── Cash waiting to be entered in Zoho ────────────────────────────────
    // No bank line will ever appear for these, so they are not "unconfirmed" —
    // they are unentered, which is a different job with a different fix.
    const { data: toEnter, error: toEnterErr } = await db
        .from('payment_captures')
        .select('id, amount, txn_date, paid_to, paid_from, direction, payment_method')
        .eq('needs_bank_match', false)
        .is('entered_in_books_at', null)
        // A payment the statement already proves is booked in Zoho by the feed
        // itself. Listing it here would ask someone to enter it a second time,
        // in the book of record, by hand.
        .is('zoho_bank_transaction_id', null)
        .not('status', 'in', '(rejected,duplicate)')
        // Deliberately NO date bound: cash never ages out of needing to be
        // entered, and a typed entry ("gave 5000 cash to Ramesh") often has no
        // date at all — a .gte() would drop those silently. This must select
        // exactly what the page's isCashQueue() selects, or the Telegram count
        // and the on-screen badge will disagree and neither will be believed.
        .order('created_at', { ascending: true })
        .limit(STALE_LIMIT);

    if ((toEnter || []).length > 0) {
        const lines = (toEnter || []).slice(0, 8).map((c) => {
            const who = (c.direction === 'in' ? c.paid_from : c.paid_to) || 'unknown';
            const verb = c.direction === 'in' ? 'from' : 'to';
            // txn_date is nullable — a typed cash entry often carries no date.
            return `• ₹${Number(c.amount || 0).toLocaleString('en-IN')} ${verb} ${who}` +
                (c.txn_date ? ` (${c.txn_date})` : '');
        });
        notices.push({
            kind: 'alert',
            title: `${(toEnter || []).length}${(toEnter || []).length === STALE_LIMIT ? '+' : ''} payment${(toEnter || []).length > 1 ? 's' : ''} still to enter in Zoho`,
            body: `These were paid in cash or outside the bank account, so no statement line will ever ` +
                `confirm them. ` +
                `Enter them in Zoho and tick them off in Finance → Payment Captures.\n\n${lines.join('\n')}` +
                ((toEnter || []).length > 8 ? `\n…and ${(toEnter || []).length - 8} more.` : ''),
            dedupe_key: `payment_to_enter_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/payment-captures',
        });
    }

    // A failed query becomes null, becomes [], becomes "no notice", and the
    // route still answers ok:true. Silence must not be indistinguishable from
    // health — this is the whole thesis of the feature applied to itself.
    for (const [what, err] of [['stale list', staleErr], ['cash queue', toEnterErr], ['dateless list', datelessErr]] as const) {
        if (err) console.error(`[reconcile] ${what} query failed:`, err.message);
    }

    let notified = 0;
    for (const n of notices) {
        // Plain INSERT, not upsert. watchman_notices_open_dedupe_idx is a
        // PARTIAL unique index (dedupe_key, only where still pending or sent),
        // and ON CONFLICT cannot infer a partial index — an upsert here would
        // simply error. A 23505 is the dedupe doing its job: today's notice is
        // already queued, and this run has nothing new to add.
        const { error: noticeErr } = await db
            .from('watchman_notices')
            .insert({ ...n, status: 'pending' });
        if (!noticeErr) notified++;
        // 23505 = today's notice is already queued (the dedupe index doing its
        // job). Anything else is a real failure and must be visible in the logs.
        else if (noticeErr.code !== '23505') {
            // Never let a failed notice fail the reconciliation itself.
            console.error('[reconcile] notice not queued:', noticeErr.message);
        }
    }

    return NextResponse.json({
        ok: true,
        checked: (unmatched || []).length,
        matched,
        notified,
        bank_feed_latest_line: feedThrough,
        bank_feed_blind: feedBlind,
        query_errors: [staleErr?.message, toEnterErr?.message, feedErr?.message].filter(Boolean),
        cash_awaiting_entry: (toEnter || []).length,
        awaiting_bank_confirmation: (stale || []).map((c) => ({
            id: c.id,
            amount: c.amount,
            direction: c.direction,
            counterparty: c.direction === 'in' ? c.paid_from : c.paid_to,
            txn_date: c.txn_date,
            bank_said: c.gateway_status,
        })),
        bank_outflows_without_proof: unannounced.slice(0, 50).map((t) => ({
            id: t.id,
            amount: t.amount,
            date: t.txn_date,
            payee: t.payee || t.description,
        })),
        bank_outflows_without_proof_total: unannounced.length,
        // Say so when a list could not be read in full, rather than reporting a
        // short list as if it were the whole picture.
        truncated: {
            outflows: (outflows || []).length === OUTFLOW_LIMIT,
            stale: (stale || []).length === STALE_LIMIT,
            claimed: claimedTruncated,
        },
    });
}
