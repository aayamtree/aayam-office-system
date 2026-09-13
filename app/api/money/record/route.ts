// POST /api/money/record — record a cash or UPI receipt, or a cash payment out.
//
// WHY THIS EXISTS (2026-09-13)
// The app's cash and UPI balances were last moved in July, and the dashboard
// said so: "Cash & UPI not written up — 61 days". Not because anything was
// broken, but because there was nowhere to record a receipt. The Banks page
// could move money BETWEEN our own accounts and nothing else, so "Ramesh paid
// 5,000 by UPI" had no home and the balances drifted.
//
// WHAT ONE SAVE DOES — TWO WRITES, ONE MEANING
//  1. THE CASH BOOK. A row in cash_transactions or bank_transactions. Both
//     tables have a balance trigger, so the account moves and its as-of date
//     becomes today. This is what closes the gap on the dashboard.
//  2. THE QUEUE. A row in payment_captures, which lands in the existing
//     "cash to enter" list on the To Do door and stays there until somebody
//     books it in Zoho. Without this a payment could be recorded here and
//     forgotten in the real books — the same silent gap, moved one step.
//
// WHAT IT DOES NOT DO
// It never writes to Zoho, never marks anything booked, and never touches the
// abandoned ledger (journal_entries, vendor_payments). Zoho stays the book of
// record; this queues work for it. Same rule as the Telegram capture inbox.
//
// WHY HDFC IS REFUSED
// Zoho's bank feed already carries the HDFC current account. Recording an
// entry here as well would make the same payment exist twice — the double
// count the finance architecture forbids. bank_accounts.fed_by_zoho marks
// those accounts and this route rejects them, so a stale client cannot slip
// one through even if the dropdown is out of date.
//
// PARTIAL FAILURE
// The two writes are not one transaction — PostgREST has no client-side
// transaction. So the cash book is written FIRST and the queue second: if the
// queue write fails, the money is still recorded and the response says the
// reminder is missing, which is recoverable. The reverse order would leave a
// reminder for money nobody recorded.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type Direction = 'in' | 'out';

interface Body {
    direction?: Direction;
    amount?: number;
    date?: string;
    /** One of these two, never both. */
    cashAccountId?: string | null;
    bankAccountId?: string | null;
    /** Free text — the client or vendor as the person entering it knows them. */
    counterparty?: string;
    method?: 'cash' | 'upi' | 'cheque' | 'other';
    note?: string;
}

/** Today in IST as a plain date — the office day, not UTC's. */
function todayIST(): string {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 - now.getTimezoneOffset()) * 60_000);
    return ist.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
    // ── who is asking ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const auth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
            },
        }
    );

    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const { data: profile } = await auth
        .from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();

    // No finance role exists yet — Satish deferred it until the new accountant
    // arrives. Until then this is admin-only, deliberately.
    if (profile?.role !== 'admin') {
        return NextResponse.json(
            { error: 'Only an admin can record money at the moment.' }, { status: 403 }
        );
    }

    const body = (await request.json().catch(() => ({}))) as Body;

    // ── validate, in the words the person will read ────────────────────────
    const direction: Direction = body.direction === 'out' ? 'out' : 'in';
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 });
    }
    // Two decimal places, and no silent rounding of a big number by floats.
    const value = Math.round(amount * 100) / 100;
    if (value > 100_000_000) {
        return NextResponse.json({ error: 'That amount looks wrong — over ₹10 crore.' }, { status: 400 });
    }

    const date = (body.date || todayIST()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'Pick a valid date.' }, { status: 400 });
    }
    // A receipt cannot have happened tomorrow.
    if (date > todayIST()) {
        return NextResponse.json({ error: 'That date is in the future.' }, { status: 400 });
    }

    const cashAccountId = body.cashAccountId || null;
    const bankAccountId = body.bankAccountId || null;
    if (Boolean(cashAccountId) === Boolean(bankAccountId)) {
        return NextResponse.json({ error: 'Choose one account.' }, { status: 400 });
    }

    const counterparty = (body.counterparty || '').trim().slice(0, 200);
    const note = (body.note || '').trim().slice(0, 500);
    const method = body.method || (cashAccountId ? 'cash' : 'upi');

    // ── service role for the writes: a lapsed browser session must not turn
    //    a recorded payment into a silent RLS refusal ────────────────────────
    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    let accountLabel = '';

    // ── write 1: the cash book ─────────────────────────────────────────────
    if (bankAccountId) {
        const { data: acct, error: acctErr } = await db
            .from('bank_accounts')
            .select('id, name, is_active, fed_by_zoho')
            .eq('id', bankAccountId)
            .maybeSingle();

        if (acctErr || !acct) {
            return NextResponse.json({ error: 'That account was not found.' }, { status: 400 });
        }
        if (!acct.is_active) {
            return NextResponse.json({ error: 'That account is closed.' }, { status: 400 });
        }
        // The guard lives HERE, not only in the dropdown. A stale page, a
        // bookmark or a second tab all still reach this route.
        if (acct.fed_by_zoho) {
            return NextResponse.json({
                error: `${acct.name} comes from Zoho's bank feed automatically — recording it here would count the same payment twice.`,
            }, { status: 400 });
        }

        accountLabel = (acct.name as string)?.trim() || 'Account';
        const { error } = await db.from('bank_transactions').insert({
            bank_account_id: bankAccountId,
            transaction_date: date,
            transaction_type: direction === 'in' ? 'inflow' : 'outflow',
            amount: value,
            description: note || (direction === 'in' ? 'Receipt' : 'Payment'),
            payment_method: method,
            payee_name: counterparty || null,
        });
        if (error) {
            return NextResponse.json({ error: `Could not record it: ${error.message}` }, { status: 500 });
        }
    } else {
        const { data: acct, error: acctErr } = await db
            .from('cash_accounts')
            .select('id, name, is_active')
            .eq('id', cashAccountId)
            .maybeSingle();

        if (acctErr || !acct) {
            return NextResponse.json({ error: 'That account was not found.' }, { status: 400 });
        }
        if (!acct.is_active) {
            return NextResponse.json({ error: 'That account is closed.' }, { status: 400 });
        }

        accountLabel = (acct.name as string)?.trim() || 'Cash';
        const { error } = await db.from('cash_transactions').insert({
            cash_account_id: cashAccountId,
            transaction_date: date,
            transaction_type: direction,
            amount: value,
            description: note || (direction === 'in' ? 'Receipt' : 'Payment'),
            created_by: user.id,
        });
        if (error) {
            return NextResponse.json({ error: `Could not record it: ${error.message}` }, { status: 500 });
        }
    }

    // ── write 2: the reminder that Zoho still needs this ───────────────────
    // needs_bank_match is FALSE by design: none of these accounts appear on
    // Zoho's bank feed, so no statement line will ever confirm them. That is
    // exactly what puts the row in the "cash to enter" queue rather than the
    // "awaiting bank confirmation" one — a list nobody can clear is a list
    // nobody reads. See lib/finance-todo.ts.
    const { error: queueErr } = await db.from('payment_captures').insert({
        source: 'manual',
        entry_kind: 'manual',
        direction,
        amount: value,
        txn_date: date,
        payment_method: method,
        paid_from: direction === 'in' ? (counterparty || null) : accountLabel,
        paid_to: direction === 'in' ? accountLabel : (counterparty || null),
        status: 'pending',
        needs_bank_match: false,
        posted_by_profile_id: user.id,
        posted_by_label: (profile as { full_name?: string } | null)?.full_name || 'Admin',
        notes: note || null,
        raw_text: note || null,
    });

    // The money IS recorded even if this failed. Say so plainly rather than
    // reporting a failure that would invite someone to enter it twice.
    if (queueErr) {
        return NextResponse.json({
            ok: true,
            warning: 'Recorded, and the balance is updated — but it could not be added to the To Do list, so remember to enter it in Zoho.',
            detail: queueErr.message,
        });
    }

    // ── the log. With more than one person touching money this is a control,
    //    not a debugging aid. Never silently skipped.
    // ⚠ activity_logs.details is JSONB, not text. The readable sentence goes in
    //   `description`; the structured copy goes in `details`.
    await db.from('activity_logs').insert({
        user_id: user.id,
        action: 'money_recorded',
        module: 'finance',
        user_name: (profile as { full_name?: string } | null)?.full_name || null,
        entity_type: direction === 'in' ? 'receipt' : 'payment',
        description: `${direction === 'in' ? 'Received' : 'Paid'} ₹${value.toLocaleString('en-IN')} ${direction === 'in' ? 'into' : 'from'} ${accountLabel}${counterparty ? ` (${counterparty})` : ''} on ${date}`,
        details: { direction, amount: value, date, account: accountLabel, counterparty: counterparty || null, method },
    }).then(() => undefined, () => undefined);

    return NextResponse.json({ ok: true, account: accountLabel, amount: value, date });
}
