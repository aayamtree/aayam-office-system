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
    requestAccessToken,
    getOrganizationId,
    zohoGet,
    logSyncRun,
    dedupeBy,
    isSettled,
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

    const token = await requestAccessToken(supabase);
    if (!token.ok) {
        await logSyncRun(supabase, 'bank', false, 0, `${token.reason}: ${token.message}`);
        return NextResponse.json(
            { error: token.message, reason: token.reason },
            { status: token.reason === 'not_connected' ? 409 : 503 }
        );
    }
    const accessToken = token.token;

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
    const seenIds = new Set<string>();

    // TWO PASSES, and the second one is the whole point.
    //
    // The default /banktransactions list returns only lines that are already IN
    // the books - categorized, matched or manually_added. A statement line
    // nobody has dealt with yet is returned ONLY when `filter_by` asks for it.
    // Without the second pass every uncategorised line is invisible here, which
    // is exactly how this app came to show 15 September while Zoho's own Banking
    // screen showed the 27th and counted 49 uncategorised on the same account.
    //
    // What used to sit here instead was a GET on /banktransactions/uncategorized.
    // Zoho serves no such LIST endpoint (only /uncategorized/{id}/... actions),
    // so the call came back without a `banktransactions` key, the code read
    // `json.banktransactions || []`, and it silently added nothing - twice a day,
    // for weeks, while reporting ok.
    //
    // Status.Uncategorized rather than Status.All on purpose: Status.All would
    // also drag in `excluded` lines, which Satish excluded deliberately, and
    // isSettled() would then show each one as "not yet categorised".
    const passes: Record<string, string>[] = [{}, { filter_by: 'Status.Uncategorized' }];

    for (const extra of passes) {
        let page = 1;
        let hasMore = true;

        // Zoho ignored `date_after` here and returned a decade of history, so the
        // window is enforced in code below and pagination stops once a page brings
        // nothing new - otherwise this runs twice a day re-reading ten years.
        while (hasMore && page <= 20) {
            const json = await zohoGet(accessToken, orgId, '/banktransactions', {
                date_start: dateAfter,
                per_page: '200',
                page: String(page),
                ...extra,
            });
            if (!json) {
                await logSyncRun(supabase, 'bank', false, rows.length, `Fetch failed on page ${page}`);
                return NextResponse.json({ error: 'Zoho fetch failed' }, { status: 502 });
            }
            const batch: Record<string, unknown>[] = json.banktransactions || [];

            let fresh = 0;
            for (const row of batch) {
                const id = str(row.transaction_id);
                if (!id || seenIds.has(id)) continue;
                seenIds.add(id);
                const d = str(row.date);
                if (d && d < dateAfter) continue;
                rows.push(row);
                fresh += 1;
            }

            if (batch.length === 0 || fresh === 0) break;
            hasMore = Boolean(json.page_context?.has_more_page);
            page += 1;
        }
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
                // 'matched' and 'manually_added' are settled too — see isSettled().
                is_categorized: isSettled(t.status),
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
