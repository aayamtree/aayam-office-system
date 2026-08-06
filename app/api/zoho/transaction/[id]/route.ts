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
import { zohoServiceClient, getAccessToken, getOrganizationId, ZOHO_API } from '@/lib/zoho-api';

export const dynamic = 'force-dynamic';

/** Find the entity anywhere in the response without knowing its key name. */
function findTransaction(payload: unknown): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;

    if (obj.transaction_id || obj.transaction_type) return obj;

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

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) return NextResponse.json({ error: 'Zoho is not connected.' }, { status: 409 });

    const orgId = await getOrganizationId(supabase, accessToken);
    if (!orgId) return NextResponse.json({ error: 'Could not read the organisation.' }, { status: 502 });

    // Fetched directly rather than through zohoGet() so the HTTP status and
    // Zoho's own message survive to the error response.
    const url = `${ZOHO_API}/banktransactions/${id}?organization_id=${orgId}`;
    const res = await fetch(url, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    let json: unknown = null;
    let bodyText = '';
    try {
        bodyText = await res.text();
        json = JSON.parse(bodyText);
    } catch {
        // leave json null; bodyText carries whatever came back
    }

    const txn = findTransaction(json);

    if (!txn) {
        const zohoMessage =
            (json && typeof json === 'object' && (json as Record<string, unknown>).message) || null;
        const keys = json && typeof json === 'object' ? Object.keys(json as object) : [];
        console.error('[zoho/transaction] no entity found', {
            httpStatus: res.status,
            zohoMessage,
            keys,
        });
        return NextResponse.json(
            {
                error: zohoMessage
                    ? `Zoho said: ${zohoMessage}`
                    : `Zoho replied ${res.status} with no transaction in it.`,
                // Kept so the next surprise is diagnosable from the screen rather
                // than from a log nobody will read.
                diagnostic: { httpStatus: res.status, keys, sample: bodyText.slice(0, 300) },
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
