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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

    // Ticking a cash payment off as entered in Zoho. Only meaningful for cash:
    // everything else is confirmed by the bank feed, and letting a person mark
    // THOSE "entered" would be a human vouching for money movement, which is
    // the one thing this whole design refuses.
    // Was it really cash? The reader decides this from the receipt, and when it
    // gets it wrong the capture is stranded: no tick, because the app thinks a
    // bank line is coming, and no match, because none ever will. Correcting the
    // flag is the only honest exit — "Not a payment" would be a lie.
    if ('needs_bank_match' in body) patch.needs_bank_match = Boolean(body.needs_bank_match);

    if ('entered_in_books' in body) {
        if (body.entered_in_books) {
            patch.entered_in_books_at = new Date().toISOString();
            patch.entered_in_books_by = gate.user.id;
        } else {
            patch.entered_in_books_at = null;
            patch.entered_in_books_by = null;
        }
    }

    // Applied LAST, and deliberately so. When both flags arrive in one body,
    // whichever block ran second used to win, and {needs_bank_match:true,
    // entered_in_books:true} could leave a row both waiting for the bank AND
    // ticked off as entered — the one combination the schema says must never
    // exist, and the one the screen draws no button for, so nobody could
    // clear it. Moving a payment onto the bank side always drops a hand-made
    // tick: from then on only the statement may confirm it.
    if (patch.needs_bank_match === true) {
        patch.entered_in_books_at = null;
        patch.entered_in_books_by = null;
    }

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
        .from('payment_captures')
        .select('status, zoho_bank_transaction_id, needs_bank_match')
        .eq('id', id)
        .maybeSingle();
    if (!current) return NextResponse.json({ error: 'capture not found' }, { status: 404 });

    // Judged on the value this request LEAVES BEHIND, not the value the row
    // happens to hold now: testing `current` let a single body flip the flag
    // and tick the box in the same breath, straight past this guard.
    const effectiveNeedsBank = 'needs_bank_match' in patch
        ? patch.needs_bank_match === true
        : Boolean(current.needs_bank_match);
    if ('entered_in_books' in body && body.entered_in_books && effectiveNeedsBank) {
        return NextResponse.json({
            error: 'Only cash payments are ticked off by hand. This one will be confirmed by the bank statement.',
        }, { status: 400 });
    }

    // A payment the statement already proves is not cash, whatever anyone
    // clicks. The screen hides the button on those rows; the API has to refuse
    // it too, or a matched payment joins the "still to enter in Zoho" queue and
    // invites a second entry in the book of record for money already booked.
    if (current.zoho_bank_transaction_id && patch.needs_bank_match === false) {
        return NextResponse.json({
            error: 'The bank statement already confirms this payment, so it cannot be marked as cash.',
        }, { status: 409 });
    }

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

    // Only stamp the vouched-for-by trail when the person actually vouched for
    // something. Ticking "entered in Zoho" is a bookkeeping fact, not a
    // statement about who the payment belongs to.
    const vouched = ['vendor_id', 'client_id', 'zoho_document_id', 'status', 'notes']
        .some((k) => k in patch);
    if (vouched) {
        patch.confirmed_by = gate.user.id;
        patch.confirmed_at = new Date().toISOString();
    }

    const { error } = await db.from('payment_captures').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // A capture edited by hand may now be matchable (e.g. a corrected amount).
    let matched = false;
    try { matched = await tryMatch(db, id); } catch { /* matching is best-effort */ }

    const { data: fresh, error: readErr } = await db
        .from('payment_captures').select('*').eq('id', id).single();
    if (readErr) {
        // The write succeeded; only the read-back failed. Say exactly that,
        // rather than returning a null row the page would merge into nothing
        // while showing "Saved".
        console.error('[payment-captures] read-back failed:', readErr.message);
        return NextResponse.json({
            ok: true, matched, capture: null,
            warning: 'Saved, but the updated row could not be read back. Refresh to confirm.',
        });
    }
    // ── Activity trail ───────────────────────────────────────────────────────
    // Payment captures wrote nothing to activity_logs, so money being vouched
    // for, rejected or ticked into the books left no trace anywhere outside
    // this table. Fire-and-forget: a failed log must never fail the save.
    void logCaptureActivity(db, {
        userId: gate.user.id,
        captureId: id,
        before: current,
        after: fresh,
        askedFor: body,
    });

    // tryMatch can set status='duplicate' on its own when the bank line it
    // found is already claimed. That is a real finding, but the caller asked
    // for something else, and returning a plain ok:true made the screen say
    // "Saved" while the row silently left every list and lost its buttons.
    const note = (fresh.status !== current.status && !('status' in body))
        ? `Saved — but re-checking the bank statement marked this ${fresh.status}` +
          (fresh.status === 'duplicate' ? ': the matching bank line is already claimed by an earlier capture.' : '.')
        : null;
    return NextResponse.json({ ok: true, matched, capture: fresh, note });
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


// ─── Activity trail ──────────────────────────────────────────────────────────
/**
 * Write one activity_logs row describing what a person just did to a capture.
 *
 * Server-side and service-role, so it bypasses RLS — that is deliberate: the
 * log must record the action even when the actor could not read the log table.
 * Never awaited by the caller and never throws: a payment save must not fail
 * because its audit line did not write.
 */
async function logCaptureActivity(
    db: SupabaseClient,
    args: {
        userId: string;
        captureId: string;
        before: { status?: string | null } | null;
        after: Record<string, any>;
        askedFor: Record<string, any>;
    },
) {
    try {
        const { before, after, askedFor } = args;
        const amount = after.amount != null ? `₹${Number(after.amount).toLocaleString('en-IN')}` : 'an unstated amount';
        const who = after.paid_to || after.paid_from || 'an unnamed party';

        // Name the action by what actually changed, not by what was posted:
        // matching can move a row's status on its own.
        let action = 'Updated Payment Capture';
        if ('entered_in_books_at' in askedFor && after.entered_in_books_at) {
            action = 'Entered Payment In Books';
        } else if (before?.status !== after.status) {
            action = after.status === 'rejected' ? 'Rejected Payment Capture'
                : after.status === 'verified' ? 'Verified Payment Capture'
                : after.status === 'duplicate' ? 'Flagged Duplicate Payment Capture'
                : 'Updated Payment Capture';
        }

        await db.from('activity_logs').insert([{
            user_id: args.userId,
            action,
            entity_type: 'payment_capture',
            entity_id: args.captureId,
            description: `${amount} — ${who}`
                + (before?.status !== after.status ? ` (${before?.status ?? 'new'} → ${after.status})` : ''),
            metadata: {
                module: 'Finance',
                status_before: before?.status ?? null,
                status_after: after.status ?? null,
                amount: after.amount ?? null,
                bank_linked: Boolean(after.zoho_bank_transaction_id),
            },
        }]);
    } catch (e) {
        console.warn('[payment-captures] activity log failed:', e);
    }
}
