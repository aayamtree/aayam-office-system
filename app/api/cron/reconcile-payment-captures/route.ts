// GET /api/cron/reconcile-payment-captures — match payment screenshots against
// the HDFC bank feed, and surface the exceptions that matter.
//
// WHY THIS RUNS AFTER zoho-bank-sync
// A screenshot arrives the moment a payment is made; the bank line arrives in
// Zoho hours or a day later. So captures are matched on a schedule, not once.
//
// WHAT IT IS FOR
// The matching is the small half. The valuable half is the lists it produces,
// which nobody was watching before. Those lists now live in lib/finance-todo.ts
// because the "To Do" door shows the same four lists on screen, and a screen
// that disagrees with this message destroys trust in both. Read that file for
// what each list means and why they are separate.
//
// WHAT STAYS HERE
// The matching loop, and turning the lists into Telegram notices. Matching
// WRITES, so it must never move into anything a page can call.
//
// SAFETY
//  - Read-mostly. The only writes are to payment_captures (an inbox table).
//  - Never touches bank_transactions, vendor_payments, journals, or Zoho.
//  - Idempotent: a matched capture is skipped on every later run.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron } from '@/lib/api-auth';
import { tryMatch } from '@/lib/telegram-payment-capture';
import {
    getFinanceTodo, lookbackSince, counterparty, LOOKBACK_DAYS,
} from '@/lib/finance-todo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const sinceIso = lookbackSince();

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

    // ── 2. Read the lists, AFTER matching ─────────────────────────────────
    // Read fresh rather than filtering the array from before the matching loop.
    // That snapshot is stale by now, so a 4-day-old capture whose bank line
    // landed overnight was reported as "the bank never confirmed this" in the
    // same response that had just confirmed it.
    const todo = await getFinanceTodo(db);
    const { feedThrough, feedReadFailed, feedBlind, truncated } = todo;
    const stale = todo.awaitingBankConfirmation;
    const dateless = todo.dateless;
    const unannounced = todo.unannouncedOutflows;
    const toEnter = todo.cashToEnter;

    // A failed query becomes null, becomes [], becomes "no notice", and the
    // route still answers ok:true. Silence must not be indistinguishable from
    // health — this is the whole thesis of the feature applied to itself.
    for (const message of todo.errors) console.error('[reconcile]', message);

    // ── 3. Tell a human ───────────────────────────────────────────────────
    // These lists are the point of the whole feature, and until they were
    // queued here they existed only in an HTTP response body that nothing
    // reads. They go into the watchman outbox, which /api/cron/watchman
    // delivers to Telegram.
    const notices: { kind: string; title: string; body: string; dedupe_key: string; app_path: string }[] = [];

    if (stale.length > 0) {
        const lines = stale.slice(0, 8).map((c) => {
            const verb = c.direction === 'in' ? 'from' : 'to';
            return `• ₹${Number(c.amount || 0).toLocaleString('en-IN')} ${verb} ${counterparty(c)} (${c.txn_date})` +
                (c.gateway_status ? ` — receipt said "${c.gateway_status}"` : '');
        });
        notices.push({
            // watchman_notices.kind is CHECK-constrained to
            // approval | decision | summary | alert. Anything else is rejected
            // with 23514 and the notice is never queued — which would have made
            // the most valuable half of this feature silently do nothing.
            kind: 'alert',
            title: `${stale.length}${truncated.stale ? '+' : ''} payment${stale.length > 1 ? 's' : ''} the bank has not confirmed`,
            body: (feedThrough
                    ? `A screenshot was shared, and the newest line in the bank feed is now ` +
                      `${feedThrough} with no sign of it. `
                    : `A screenshot was shared and no matching bank line has appeared. `) +
                `An accepted request can still fail — worth checking.\n\n${lines.join('\n')}` +
                (stale.length > 8 ? `\n…and ${stale.length - 8} more.` : ''),
            dedupe_key: `payment_unconfirmed_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/to-do',
        });
    }

    if (dateless.length > 0) {
        const n = dateless.length;
        const lines = dateless.slice(0, 8).map((c) => {
            const verb = c.direction === 'in' ? 'from' : 'to';
            return `• ₹${Number(c.amount || 0).toLocaleString('en-IN')} ${verb} ${counterparty(c)}` +
                ` (posted ${String(c.created_at).slice(0, 10)})`;
        });
        notices.push({
            kind: 'alert',
            title: `${n}${truncated.dateless ? '+' : ''} payment${n > 1 ? 's' : ''} with no readable date`,
            body: `The date could not be read off ${n > 1 ? 'these receipts' : 'this receipt'}, so ` +
                `nothing can check ${n > 1 ? 'them' : 'it'} against the statement — not even to say ` +
                `${n > 1 ? 'they are' : 'it is'} fine. Open the screenshot and set the date, or mark ` +
                `${n > 1 ? 'them' : 'it'} as cash.\n\n${lines.join('\n')}` +
                (n > 8 ? `\n…and ${n - 8} more.` : ''),
            dedupe_key: `payment_dateless_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/to-do',
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
            app_path: '/admin/finance/to-do',
        });
    }

    if (feedReadFailed) {
        notices.push({
            kind: 'alert',
            title: `The bank check could not run`,
            body: `Reading the bank feed failed, so no payment was checked against the statement ` +
                `tonight. This is not a clean bill of health — it is a check that did not happen.`,
            dedupe_key: `payment_feed_unreadable_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/bank-cash',
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
            app_path: '/admin/finance/bank-cash',
        });
    }

    if (toEnter.length > 0) {
        const lines = toEnter.slice(0, 8).map((c) => {
            const verb = c.direction === 'in' ? 'from' : 'to';
            // txn_date is nullable — a typed cash entry often carries no date.
            return `• ₹${Number(c.amount || 0).toLocaleString('en-IN')} ${verb} ${counterparty(c)}` +
                (c.txn_date ? ` (${c.txn_date})` : '');
        });
        notices.push({
            kind: 'alert',
            title: `${toEnter.length}${truncated.cash ? '+' : ''} payment${toEnter.length > 1 ? 's' : ''} still to enter in Zoho`,
            body: `These were paid in cash or outside the bank account, so no statement line will ever ` +
                `confirm them. ` +
                `Enter them in Zoho and tick them off in Finance → To Do.\n\n${lines.join('\n')}` +
                (toEnter.length > 8 ? `\n…and ${toEnter.length - 8} more.` : ''),
            dedupe_key: `payment_to_enter_${new Date().toISOString().slice(0, 10)}`,
            app_path: '/admin/finance/to-do',
        });
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
        bank_feed_unreadable: feedReadFailed,
        query_errors: todo.errors,
        cash_awaiting_entry: toEnter.length,
        awaiting_bank_confirmation: stale.map((c) => ({
            id: c.id,
            amount: c.amount,
            direction: c.direction,
            counterparty: counterparty(c),
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
        truncated,
    });
}
