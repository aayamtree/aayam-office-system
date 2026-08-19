// GET /api/zoho/transaction/[id] — the full detail for ONE bank transaction.
//
// WHY ON DEMAND
// Zoho's /banktransactions LIST gives date, payee, amount, reference and status
// — but not which invoice a receipt was matched to, how it was received, or any
// bank charges. Those only come from the per-transaction endpoint.
//
// WHY THIS ROUTE DIAGNOSES ITSELF
// Five separate assumptions about Zoho's API have now turned out wrong (the date
// filter, debit/credit direction, duplicate ids, settled statuses, and this
// route's own response shape). So rather than guessing the wrapper key a sixth
// time, it tries the plausible ones, then falls back to hunting the payload for
// an object carrying a transaction_id — and if it still cannot find one, it
// reports the HTTP status and the keys Zoho actually sent, instead of the
// useless "Zoho had no detail for this transaction."

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { zohoServiceClient, requestAccessToken, getOrganizationId, ZOHO_API } from '@/lib/zoho-api';

export const dynamic = 'force-dynamic';

/**
 * Find the entity anywhere in the response without knowing its key name.
 *
 * A customer payment is NOT shaped like a bank transaction: it carries
 * payment_id and an invoices[] array, no transaction_id at all. Recognising
 * only transaction_id meant Zoho answered "200 success" and this still reported
 * failure — the request was right and the reader was wrong.
 */
const ENTITY_MARKERS = [
    'transaction_id',
    'transaction_type',
    'payment_id',
    'expense_id',
    'invoice_id',
    'bill_id',
];

function findTransaction(payload: unknown): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;

    if (ENTITY_MARKERS.some((k) => obj[k])) return obj;

    for (const value of Object.values(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const hit = findTransaction(value);
            if (hit) return hit;
        }
    }
    return null;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const gate = await requireUser();
    if (!gate.ok) return gate.response;

    const { id } = await params;
    if (!id || !/^\d+$/.test(id)) {
        return NextResponse.json({ error: 'Bad transaction id' }, { status: 400 });
    }

    const supabase = zohoServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

    const token = await requestAccessToken(supabase);
    if (!token.ok) {
        // 409 only when it really is disconnected. A rate limit or a wobble is
        // 503 "come back later", because telling someone to re-authorise a
        // working connection is how you get a re-authorise loop.
        return NextResponse.json(
            { error: token.message, reason: token.reason },
            { status: token.reason === 'not_connected' ? 409 : 503 }
        );
    }
    const accessToken = token.token;

    const orgId = await getOrganizationId(supabase, accessToken);
    if (!orgId) return NextResponse.json({ error: 'Could not read the organisation.' }, { status: 502 });

    // WHICH ENDPOINT HOLDS THE DETAIL DEPENDS ON WHAT THE LINE *IS*.
    // /banktransactions/{id} answered "Transaction does not exist" for a matched
    // receipt, because Zoho does not keep it as a bank transaction at all — it
    // is a CUSTOMER PAYMENT, and that record is where the invoice number lives.
    // Rather than bet on one path again, try the ones that fit this row's type
    // and report every attempt if they all miss.
    const { data: row } = await supabase
        .from('zoho_bank_transactions')
        .select('transaction_type')
        .eq('zoho_transaction_id', id)
        .maybeSingle();

    const type = row?.transaction_type || '';
    // The LIST call is deliberately included as a probe. If /customerpayments/{id}
    // returns 401 but /customerpayments (list) succeeds, the permission is fine
    // and the ID is wrong; if BOTH 401, the scope really is missing. Six wrong
    // guesses in, one decisive test beats a seventh guess.
    const candidates: string[] =
        type === 'customer_payment'
            ? [`/customerpayments/${id}`, `/customerpayments`, `/banktransactions/${id}`]
            : type === 'vendor_payment'
              ? [`/vendorpayments/${id}`, `/banktransactions/${id}`]
              : type === 'expense' || type === 'card_payment'
                ? [`/expenses/${id}`, `/banktransactions/${id}`]
                : [`/banktransactions/${id}`, `/customerpayments/${id}`, `/expenses/${id}`];

    let txn: Record<string, unknown> | null = null;
    const attempts: { path: string; status: number; message?: string }[] = [];

    for (const path of candidates) {
        const res = await fetch(`${ZOHO_API}${path}?organization_id=${orgId}`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        let json: unknown = null;
        try {
            json = JSON.parse(await res.text());
        } catch {
            /* non-JSON body */
        }
        const message =
            json && typeof json === 'object'
                ? String((json as Record<string, unknown>).message ?? '')
                : '';
        attempts.push({ path, status: res.status, message: message || undefined });

        // The bare list probe is for diagnosis only — never treat some other
        // customer's payment as this row's detail.
        if (path === '/customerpayments') continue;

        const found = findTransaction(json);
        if (found) {
            txn = found;
            break;
        }
    }

    if (!txn) {
        console.error('[zoho/transaction] every endpoint missed', { id, type, attempts });
        return NextResponse.json(
            {
                error:
                    `Zoho has no record for this ${type || 'transaction'} at any of the ` +
                    `endpoints tried: ${attempts.map((a) => `${a.path} → ${a.status} ${a.message || ''}`).join('; ')}`,
                diagnostic: { transaction_type: type, attempts },
            },
            { status: 502 }
        );
    }

    await supabase
        .from('zoho_bank_transactions')
        .update({ raw: txn })
        .eq('zoho_transaction_id', id);

    return NextResponse.json({ ok: true, transaction: txn });
}
