// PATCH /api/finance/payment-captures — a person's decision on a captured
// payment screenshot: which vendor, which bill, keep or reject.
//
// WHY A SERVICE-ROLE ROUTE AND NOT A BROWSER WRITE
// Project rule: a browser write silently downgrades to `anon` when the
// Supabase session lapses, and RLS then refuses it without an error the user
// ever sees. Finance decisions are the last place that is acceptable.
//
// WHAT THIS DELIBERATELY CANNOT DO
// It cannot mark a capture 'verified'. Only a matching line in the bank feed
// does that. A person can say which vendor a screenshot belongs to; nobody
// can tell the system the money actually moved.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import { tryMatch } from '@/lib/telegram-payment-capture';

export const dynamic = 'force-dynamic';

const HUMAN_STATUSES = ['pending', 'confirmed', 'rejected', 'duplicate'];

export async function PATCH(request: NextRequest) {
    const gate = await requireRole(['finance', 'account']);
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => null);
    const id: string | undefined = body?.id;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const patch: Record<string, unknown> = {};
    if ('vendor_id' in body) patch.vendor_id = body.vendor_id || null;
    if ('client_id' in body) patch.client_id = body.client_id || null;
    if ('zoho_document_id' in body) patch.zoho_document_id = body.zoho_document_id || null;
    if ('purchase_bill_id' in body) patch.purchase_bill_id = body.purchase_bill_id || null;
    if ('notes' in body) patch.notes = body.notes || null;

    if ('status' in body) {
        if (!HUMAN_STATUSES.includes(body.status)) {
            return NextResponse.json(
                { error: `status must be one of ${HUMAN_STATUSES.join(', ')} — 'verified' is set by the bank feed only` },
                { status: 400 }
            );
        }
        patch.status = body.status;
    }

    // Naming the other party is a human vouching for the CONTEXT, never for the
    // money. Only a matching bank line can make a capture 'verified'.
    if ((patch.vendor_id || patch.client_id) && !patch.status) patch.status = 'confirmed';

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }

    const { data: current } = await db
        .from('payment_captures').select('status, zoho_bank_transaction_id').eq('id', id).maybeSingle();
    if (!current) return NextResponse.json({ error: 'capture not found' }, { status: 404 });

    // Once the bank statement proves a payment, no status edit may undo it.
    // This used to intercept only the literal 'confirmed', so "Not a payment"
    // on a verified row set status='rejected' while the bank link stayed —
    // the payment then existed nowhere: hidden from the review screen, skipped
    // by duplicate detection, and still counted as proven by the cron.
    // Refused outright, not quietly dropped. Silently discarding the status
    // while saving the rest returned {ok:true} and the caller was told "Saved"
    // for a change that never happened.
    if (current.zoho_bank_transaction_id && 'status' in body) {
        return NextResponse.json({
            error: 'The bank statement confirms this payment. Unlink the bank line before changing its status.',
        }, { status: 409 });
    }
    // An automatic 'confirmed' that rode along with a vendor change is not a
    // status change the caller asked for, so it is dropped rather than refused.
    if (current.zoho_bank_transaction_id) delete patch.status;

    patch.confirmed_by = gate.user.id;
    patch.confirmed_at = new Date().toISOString();

    const { error } = await db.from('payment_captures').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // A capture edited by hand may now be matchable (e.g. a corrected amount).
    let matched = false;
    try { matched = await tryMatch(db, id); } catch { /* matching is best-effort */ }

    const { data: fresh } = await db.from('payment_captures').select('*').eq('id', id).single();
    return NextResponse.json({ ok: true, matched, capture: fresh });
}

/** POST { action: 'rematch' } — re-run bank matching for one capture, or all. */
export async function POST(request: NextRequest) {
    const gate = await requireRole(['finance', 'account']);
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    if (body?.action !== 'rematch') {
        return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    let ids: string[] = [];
    if (body.id) {
        ids = [body.id];
    } else {
        const { data } = await db
            .from('payment_captures')
            .select('id')
            .is('zoho_bank_transaction_id', null)
            .in('status', ['pending', 'confirmed'])
            .eq('needs_bank_match', true)
            .limit(200);
        ids = (data || []).map((r) => r.id);
    }

    let matched = 0;
    for (const id of ids) {
        try { if (await tryMatch(db, id)) matched++; } catch { /* keep going */ }
    }
    return NextResponse.json({ ok: true, checked: ids.length, matched });
}
