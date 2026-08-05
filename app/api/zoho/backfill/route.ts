// GET /api/zoho/backfill?from=2026-04-01 — pull historical data out of Zoho Books.
//
// WHY THIS EXISTS
// The webhook rules only fire when somebody creates or edits a document, so
// they capture the future, not the past. On the day the sync went live the app
// held exactly ONE invoice — the one that happened to be edited that afternoon
// — while the whole financial year sat in Zoho, invisible here. The bank cron
// has the same horizon problem: it only looks back 60 days.
//
// This route is the one-off that fills in the year. Admin-only and deliberately
// manual: it is not on a schedule, because re-reading a whole financial year
// every night would be a lot of API calls to rediscover nothing.
//
// SAFE TO RE-RUN
// Everything upserts on the Zoho id, so running it twice changes nothing and
// running it after a failure simply carries on. It is also CHUNKED: list pages
// are cheap, but line items need one call per document, so each invocation
// enriches a bounded number and reports whether more remain. Call it again
// until `remaining` reaches zero rather than risking a function timeout.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
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

/** How many documents to fetch full line items for per invocation. */
const DETAIL_BUDGET = 40;

function num(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
    if (typeof value === 'number') return String(value);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Walk a paginated Books list endpoint to the end (bounded).
 *
 * Stops early if a page contributes no ids we have not already seen. Without
 * that guard, an endpoint that quietly ignores `page` while still reporting
 * has_more_page would spin until the page cap, re-fetching the same rows —
 * which is exactly the shape of the 4,624-row first run.
 */
async function fetchAll(
    accessToken: string,
    orgId: string,
    path: string,
    listKey: string,
    idKey: string,
    params: Record<string, string>
): Promise<Record<string, unknown>[] | null> {
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 50) {
        const json = await zohoGet(accessToken, orgId, path, {
            ...params,
            per_page: '200',
            page: String(page),
        });
        if (!json) return null;
        const batch: Record<string, unknown>[] = json[listKey] || [];

        let fresh = 0;
        for (const row of batch) {
            const id = String(row[idKey] ?? '');
            if (!id || seen.has(id)) continue;
            seen.add(id);
            out.push(row);
            fresh += 1;
        }

        if (batch.length === 0 || fresh === 0) break;
        hasMore = Boolean(json.page_context?.has_more_page);
        page += 1;
    }
    return out;
}

export async function GET(request: NextRequest) {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const supabase = zohoServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

    // Default to the start of the current Indian financial year (1 April).
    const today = new Date();
    const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const from = request.nextUrl.searchParams.get('from') || `${fyStartYear}-04-01`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
        return NextResponse.json({ error: 'from must be YYYY-MM-DD' }, { status: 400 });
    }

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
        return NextResponse.json(
            { error: 'Zoho is not connected yet. Visit /api/zoho/oauth/start first.' },
            { status: 409 }
        );
    }
    const orgId = await getOrganizationId(supabase, accessToken);
    if (!orgId) return NextResponse.json({ error: 'Could not read organisation' }, { status: 502 });

    const now = new Date().toISOString();
    const result: Record<string, unknown> = { from };

    // ---- Invoices + quotes (summary from the list endpoints) -----------------
    for (const [docType, path, listKey, numberKey, idKey, dueKey] of [
        ['invoice', '/invoices', 'invoices', 'invoice_number', 'invoice_id', 'due_date'],
        ['estimate', '/estimates', 'estimates', 'estimate_number', 'estimate_id', 'expiry_date'],
    ] as const) {
        const rows = await fetchAll(accessToken, orgId, path, listKey, idKey, { date_start: from });
        if (rows === null) {
            await logSyncRun(supabase, 'backfill', false, 0, `${listKey} list failed`);
            return NextResponse.json({ error: `Could not fetch ${listKey}` }, { status: 502 });
        }
        const mapped = rows
            .map((d) => {
                const zohoId = str(d[idKey]);
                if (!zohoId) return null;
                return {
                    doc_type: docType,
                    zoho_id: zohoId,
                    doc_number: str(d[numberKey]),
                    customer_name: str(d.customer_name),
                    doc_date: str(d.date),
                    due_date: str(d[dueKey]),
                    status: str(d.status),
                    sub_total: num(d.sub_total),
                    tax_total: num(d.tax_total),
                    total: num(d.total),
                    balance: num(d.balance),
                    currency: str(d.currency_code) || 'INR',
                    last_synced_at: now,
                };
            })
            .filter(Boolean);

        if (mapped.length > 0) {
            // NOTE: line_items and raw are intentionally NOT written here. List
            // endpoints do not return line items, and blanking the richer data a
            // webhook already delivered would be a downgrade.
            const { error } = await supabase
                .from('zoho_documents')
                .upsert(dedupeBy(mapped as Record<string, unknown>[], 'doc_type', 'zoho_id'), {
                    onConflict: 'doc_type,zoho_id',
                });
            if (error) {
                await logSyncRun(supabase, 'backfill', false, mapped.length, error.message);
                return NextResponse.json({ error: 'Store failed' }, { status: 500 });
            }
        }
        result[listKey] = mapped.length;
    }

    // ---- Bank transactions ---------------------------------------------------
    // NOTE: /banktransactions ignored `date_after` — the first run came back with
    // everything from 2016. `date_start` is the parameter the other endpoints
    // honour, but the date is ALSO enforced below rather than trusted, because a
    // silently ignored filter is not something to find out about twice.
    const txnsRaw = await fetchAll(
        accessToken,
        orgId,
        '/banktransactions',
        'banktransactions',
        'transaction_id',
        { date_start: from }
    );
    const txns = txnsRaw?.filter((t) => {
        const d = str(t.date);
        return !d || d >= from;
    });
    if (!txns) {
        await logSyncRun(supabase, 'backfill', false, 0, 'banktransactions list failed');
        return NextResponse.json({ error: 'Could not fetch bank transactions' }, { status: 502 });
    }
    const mappedTxns = txns
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
                offset_account_name: str(t.offset_account_name) || str(t.category_name),
                currency: str(t.currency_code) || 'INR',
                raw: t,
                last_synced_at: now,
            };
        })
        .filter(Boolean);

    const uniqueTxns = dedupeBy(mappedTxns as Record<string, unknown>[], 'zoho_transaction_id');
    if (uniqueTxns.length > 0) {
        // Chunked: one statement carrying thousands of rows is both slow and the
        // kind of thing that trips statement limits on a bad day.
        for (let i = 0; i < uniqueTxns.length; i += 500) {
            const { error } = await supabase
                .from('zoho_bank_transactions')
                .upsert(uniqueTxns.slice(i, i + 500), { onConflict: 'zoho_transaction_id' });
            if (error) {
                await logSyncRun(supabase, 'backfill', false, uniqueTxns.length, error.message);
                return NextResponse.json({ error: `Store failed: ${error.message}` }, { status: 500 });
            }
        }
    }
    result.banktransactions = uniqueTxns.length;

    // ---- Enrich documents that still have no line items ----------------------
    // One API call per document, so bounded per invocation. Re-run until
    // `remaining` is 0.
    const { data: needDetail } = await supabase
        .from('zoho_documents')
        .select('id, doc_type, zoho_id')
        .is('line_items', null)
        .limit(DETAIL_BUDGET);

    let enriched = 0;
    for (const doc of needDetail || []) {
        const path = doc.doc_type === 'invoice' ? `/invoices/${doc.zoho_id}` : `/estimates/${doc.zoho_id}`;
        const json = await zohoGet(accessToken, orgId, path);
        const entity = json?.invoice || json?.estimate;
        if (!entity) continue;
        await supabase
            .from('zoho_documents')
            .update({ line_items: entity.line_items ?? null, raw: json, last_synced_at: now })
            .eq('id', doc.id);
        enriched += 1;
    }

    const { count: stillMissing } = await supabase
        .from('zoho_documents')
        .select('id', { count: 'exact', head: true })
        .is('line_items', null);

    result.enriched_with_line_items = enriched;
    result.remaining_without_line_items = stillMissing ?? 0;
    result.note =
        (stillMissing ?? 0) > 0
            ? 'Run this again to fetch the remaining line items.'
            : 'Complete — every document has its line items.';

    await logSyncRun(
        supabase,
        'backfill',
        true,
        Number(result.invoices || 0) + Number(result.estimates || 0) + mappedTxns.length,
        `from ${from}`
    );

    return NextResponse.json({ ok: true, ...result });
}
