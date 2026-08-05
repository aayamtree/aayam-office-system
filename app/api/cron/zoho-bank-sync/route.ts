// GET /api/cron/zoho-bank-sync — pull the HDFC bank feed out of Zoho Books.
//
// WHY A PULL AND NOT A WEBHOOK
// Invoices and quotes change because a person edits them, so a workflow rule
// can fire. Bank lines appear because Zoho's HDFC feed dropped them in — no
// user action, nothing for a rule to hang on. So we go and get them.
//
// WHY THIS MATTERS
// Satish was downloading the HDFC statement, pasting it into the app and
// categorising a second time, having already categorised the same lines in
// Zoho. This route removes the second pass: the category he assigns in Zoho
// (the offset account on the entry) comes across with the transaction.
//
// SAFETY
//  - Read-only scopes. This cannot alter the books.
//  - Upsert on zoho_transaction_id, so re-running is harmless and a re-
//    categorised line updates in place rather than duplicating.
//  - Every run is written to zoho_sync_runs, including failures. A sync that
//    quietly stopped six weeks ago looks exactly like a quiet month otherwise.

import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/api-auth';
import {
    zohoServiceClient,
    getAccessToken,
    getOrganizationId,
    zohoGet,
    logSyncRun,
    dedupeBy,
} from '@/lib/zoho-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Zoho returns numbers as numbers or strings depending on the field; be tolerant. */
function num(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
    if (typeof value === 'number') return String(value);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;

    const supabase = zohoServiceClient();
    if (!supabase) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
        await logSyncRun(supabase, 'bank', false, 0, 'No access token — Zoho not connected');
        return NextResponse.json(
            { error: 'Zoho is not connected. An admin should open /api/zoho/oauth/start.' },
            { status: 409 }
        );
    }

    const orgId = await getOrganizationId(supabase, accessToken);
    if (!orgId) {
        await logSyncRun(supabase, 'bank', false, 0, 'Could not resolve organization_id');
        return NextResponse.json({ error: 'Could not read the Zoho organisation.' }, { status: 502 });
    }

    // Look back 60 days each run. Comfortably covers a missed week, a late bank
    // feed, or a line categorised long after it landed, without ever paging
    // through years of history.
    const from = new Date();
    from.setDate(from.getDate() - 60);
    const dateAfter = from.toISOString().slice(0, 10);

    const rows: Record<string, unknown>[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
        const json = await zohoGet(accessToken, orgId, '/banktransactions', {
            date_after: dateAfter,
            per_page: '200',
            page: String(page),
        });
        if (!json) {
            await logSyncRun(supabase, 'bank', false, rows.length, `Fetch failed on page ${page}`);
            return NextResponse.json({ error: 'Zoho fetch failed' }, { status: 502 });
        }
        const batch = json.banktransactions || [];
        rows.push(...batch);
        hasMore = Boolean(json.page_context?.has_more_page);
        page += 1;
    }

    const now = new Date().toISOString();
    const mapped = rows
        .map((t) => {
            const id = str(t.transaction_id);
            if (!id) return null;
            return {
                zoho_transaction_id: id,
                txn_date: str(t.date),
                amount: num(t.amount),
                debit_or_credit: str(t.debit_or_credit),
                transaction_type: str(t.transaction_type),
                status: str(t.status),
                is_categorized:
                    typeof t.is_categorized === 'boolean' ? t.is_categorized : str(t.status) === 'categorized',
                description: str(t.description),
                reference_number: str(t.reference_number),
                payee: str(t.payee) || str(t.customer_name) || str(t.vendor_name),
                account_id: str(t.account_id),
                account_name: str(t.account_name),
                // The other side of the entry — this IS the category Satish assigned.
                offset_account_name: str(t.offset_account_name) || str(t.category_name),
                currency: str(t.currency_code) || 'INR',
                raw: t,
                last_synced_at: now,
            };
        })
        .filter(Boolean);

    // Zoho repeats ids across pages and for both sides of a transfer; one upsert
    // statement may not carry the same conflict key twice.
    const unique = dedupeBy(mapped as Record<string, unknown>[], 'zoho_transaction_id');
    if (unique.length > 0) {
        for (let i = 0; i < unique.length; i += 500) {
            const { error } = await supabase
                .from('zoho_bank_transactions')
                .upsert(unique.slice(i, i + 500), { onConflict: 'zoho_transaction_id' });
            if (error) {
                await logSyncRun(supabase, 'bank', false, unique.length, error.message);
                return NextResponse.json({ error: `Store failed: ${error.message}` }, { status: 500 });
            }
        }
    }

    await logSyncRun(supabase, 'bank', true, unique.length);
    return NextResponse.json({ ok: true, fetched: unique.length, since: dateAfter });
}
