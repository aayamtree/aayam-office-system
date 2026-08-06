// GET /api/zoho/transaction/[id] — the full detail for ONE bank transaction.
//
// WHY ON DEMAND
// Zoho's /banktransactions LIST gives date, payee, amount, reference and status
// — but not the things Satish actually wanted to see: which invoice a receipt
// was matched to, how it was received, any bank charges. Those only come from
// the per-transaction endpoint, one call each.
//
// Fetching them for all 227 transactions up front would be 227 calls for data
// nobody has asked to look at. So this runs when a row is clicked, and the
// result is cached back into the row's raw column so a second look is free.

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { zohoServiceClient, getAccessToken, getOrganizationId, zohoGet } from '@/lib/zoho-api';

export const dynamic = 'force-dynamic';

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
    if (!accessToken) {
        return NextResponse.json({ error: 'Zoho is not connected.' }, { status: 409 });
    }
    const orgId = await getOrganizationId(supabase, accessToken);
    if (!orgId) return NextResponse.json({ error: 'Could not read the organisation.' }, { status: 502 });

    const json = await zohoGet(accessToken, orgId, `/banktransactions/${id}`);
    const txn = json?.banktransaction || json?.bank_transaction;
    if (!txn) {
        return NextResponse.json({ error: 'Zoho had no detail for this transaction.' }, { status: 404 });
    }

    // Keep the richer copy — a second click costs nothing, and if Zoho is ever
    // unreachable the detail we already saw is still there.
    await supabase
        .from('zoho_bank_transactions')
        .update({ raw: txn })
        .eq('zoho_transaction_id', id);

    return NextResponse.json({ ok: true, transaction: txn });
}
