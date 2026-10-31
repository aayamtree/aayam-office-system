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

import { ZOHO_SYNC_ENABLED, ZOHO_SYNC_OFF_REASON } from '@/lib/legacy-ledger';
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
    if (!ZOHO_SYNC_ENABLED) return NextResponse.json({ skipped: true, reason: ZOHO_SYNC_OFF_REASON });
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
    const warnings: string[] = [];

    // Pull one paginated list into `rows`. Zoho ignored `date_after` here and
    // returned a decade of history, so the window is enforced in code and
    // pagination stops once a page brings nothing new - otherwise this runs
    // twice a day re-reading ten years.
    const pull = async (extra: Record<string, string>): Promise<boolean> => {
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 20) {
            const json = await zohoGet(accessToken, orgId, '/banktransactions', {
                date_start: dateAfter,
                per_page: '200',
                page: String(page),
                ...extra,
            });
            if (!json) return false;
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
        return true;
    };

    // ---- Pass 1: everything already IN the books -----------------------------
    if (!(await pull({}))) {
        await logSyncRun(supabase, 'bank', false, 0, 'banktransactions list failed');
        return NextResponse.json({ error: 'Zoho fetch failed' }, { status: 502 });
    }

    // ---- Pass 2: the statement lines nobody has categorised yet ---------------
    // The default list returns ONLY categorized / matched / manually_added. A
    // line Satish has not dealt with comes back only for filter_by=
    // Status.Uncategorized, and only when the account is named - without
    // account_id Zoho answers "The account does not exist."
    //
    // What used to sit here was a GET on /banktransactions/uncategorized, a LIST
    // endpoint Zoho does not serve (only /uncategorized/{id}/... actions). The
    // response had no `banktransactions` key, the code read it as an empty array,
    // and it added nothing - twice a day for weeks, logging ok every time. The
    // app showed bank data to 15 September and 0 uncategorised while Zoho's own
    // Banking screen showed the 27th and counted 49 on the same account.
    //
    // Status.Uncategorized rather than Status.All on purpose: Status.All would
    // also drag in `excluded` lines, which were excluded deliberately, and
    // isSettled() would then report each one as needing attention.
    const accountsJson = await zohoGet(accessToken, orgId, '/bankaccounts', { per_page: '200' });
    const bankAccountIds = accountsJson
        ? ((accountsJson.bankaccounts || []) as Record<string, unknown>[])
              .map((a) => str(a.account_id))
              .filter(Boolean) as string[]
        // Fall back to the accounts that appeared in pass 1. Narrower - an account
        // whose only recent lines are uncategorised is invisible to it - but far
        // better than skipping pass 2 altogether.
        : (Array.from(new Set(rows.map((t) => str(t.account_id)).filter(Boolean))) as string[]);
    if (!accountsJson) warnings.push('bankaccounts list failed; used accounts seen in pass 1');

    for (const accountId of bankAccountIds) {
        const ok = await pull({ account_id: accountId, filter_by: 'Status.Uncategorized' });
        // Additive, so one bad account must not lose the rows already gathered -
        // but it is recorded, because silence here is the bug this pass exists to
        // fix.
        if (!ok) warnings.push(`uncategorised fetch failed for account ${accountId}`);
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

    await logSyncRun(supabase, 'bank', true, unique.length, warnings.join(' | ') || undefined);
    return NextResponse.json({ ok: true, fetched: unique.length, since: dateAfter, warnings });
}
