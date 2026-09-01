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
//   · a screenshot with NO bank line after 3 days — the payment may have
//     failed, and "Request Accepted" was never a promise it wouldn't.
//   · a bank OUTFLOW with no screenshot — money left the account and nobody
//     announced it in the group.
//
// Cash is excluded from both lists. It never reaches a bank feed, so counting
// it as unconfirmed would fill the warning list with entries that can never be
// resolved — and a warning list nobody can clear is a warning list nobody reads.
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
    const staleCutoff = new Date();
    staleCutoff.setUTCDate(staleCutoff.getUTCDate() - STALE_DAYS);
    const { data: stale } = await db
        .from('payment_captures')
        .select('id, amount, txn_date, paid_to, paid_from, direction, gateway_status')
        .is('zoho_bank_transaction_id', null)
        .in('status', ['pending', 'confirmed'])
        .eq('needs_bank_match', true)
        .gte('txn_date', sinceIso)
        .lte('txn_date', staleCutoff.toISOString().slice(0, 10))
        .order('txn_date', { ascending: true })
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
            body: `A screenshot was shared but no matching line has appeared in the bank statement after ${STALE_DAYS} days. ` +
                `An accepted request can still fail — worth checking.\n\n${lines.join('\n')}` +
                ((stale || []).length > 8 ? `\n…and ${(stale || []).length - 8} more.` : ''),
            dedupe_key: `payment_unconfirmed_${new Date().toISOString().slice(0, 10)}`,
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
