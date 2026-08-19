// GET /api/cron/zoho-invoice-sync — pull every invoice AND bill out of Zoho Books.
//
// WHY THIS EXISTS
// Invoices reach us by workflow webhook, which fires when a person edits the
// document. Recording a PAYMENT is not that kind of edit — the money is applied
// against the invoice and the status flips on its own — so the webhook does not
// fire and our copy keeps saying `overdue` after the customer has paid.
//
// The evidence: on 15 Aug not one `paid` invoice had been touched since 7 Aug,
// while `sent` and `draft` rows had synced within a day. Eight days of payments
// were invisible, which means the ₹48.5 lakh the morning brief now reports could
// be overstated by whatever came in during that window.
//
// So we stop waiting to be told and go and look. Same shape as zoho-bank-sync:
// read-only, upsert on (doc_type, zoho_id), every run logged.
//
// BILLS RIDE ALONG (19 Aug)
// Exactly the same argument applies to what we OWE: paying a vendor bill in
// Zoho flips its status without anyone editing the document, so a webhook-only
// bill would sit here reading `overdue` forever. Bills are pulled in the same
// run, logged separately, and a failure on one does not abandon the other —
// stale payables and stale receivables are two different lies.
//
// SAFETY
//  - Read-only scopes. This cannot alter the books.
//  - Upsert only touches the fields the list endpoint returns, so `line_items`
//    and `raw` written by the webhook survive an update untouched.
//  - Every run is written to zoho_sync_runs, failures included. A sync that
//    quietly stopped is exactly what this route exists to prevent.

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

/** Zoho paginates at 200; walk until it says there is no more. */
const PER_PAGE = 200;
const MAX_PAGES = 25; // 5,000 invoices — a hard stop so a bad has_more_page can't spin

async function runJob(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return gate.response;

    const supabase = zohoServiceClient();
    if (!supabase) {
        return NextResponse.json({ error: 'Supabase service client unavailable' }, { status: 500 });
    }

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
        await logSyncRun(supabase, 'invoices', false, 0, 'no access token — reconnect Zoho');
        return NextResponse.json({ error: 'Zoho not connected' }, { status: 502 });
    }

    const orgId = await getOrganizationId(supabase, accessToken);
    if (!orgId) {
        await logSyncRun(supabase, 'invoices', false, 0, 'no organization_id');
        return NextResponse.json({ error: 'No Zoho organization' }, { status: 502 });
    }

    // doc_type, endpoint, list key, id field, number field, sync-run label.
    const SOURCES = [
        ['invoice', '/invoices', 'invoices', 'invoice_id', 'invoice_number', 'invoices'],
        ['bill', '/bills', 'bills', 'bill_id', 'bill_number', 'bills'],
    ] as const;

    const summary: Record<string, unknown> = {};
    const failures: string[] = [];

    for (const [docType, path, listKey, idKey, numberKey, logKind] of SOURCES) {
        const rows: Record<string, unknown>[] = [];
        let page = 1;
        let hasMore = true;

        try {
            while (hasMore && page <= MAX_PAGES) {
                const json = await zohoGet(accessToken, orgId, path, {
                    page: String(page),
                    per_page: String(PER_PAGE),
                    sort_column: 'date',
                    sort_order: 'D',
                });
                if (!json) throw new Error(`${listKey} list failed on page ${page}`);

                const batch = (json[listKey] || []) as any[];
                for (const doc of batch) {
                    const zohoId = str(doc[idKey]);
                    if (!zohoId) continue;
                    rows.push({
                        doc_type: docType,
                        zoho_id: zohoId,
                        doc_number: str(doc[numberKey]),
                        // Invoices carry customer_name, bills carry vendor_name.
                        // One column, one meaning: the other side of the document.
                        customer_name: str(doc.customer_name) || str(doc.vendor_name),
                        doc_date: str(doc.date),
                        due_date: str(doc.due_date),
                        status: str(doc.status),
                        sub_total: num(doc.sub_total),
                        tax_total: num(doc.tax_total),
                        total: num(doc.total),
                        balance: num(doc.balance),
                        currency: str(doc.currency_code),
                        // line_items and raw are deliberately NOT sent. The list
                        // endpoint does not return them, and including them as null
                        // would wipe the detail the webhook already stored.
                        last_synced_at: new Date().toISOString(),
                    });
                }

                hasMore = Boolean(json.page_context?.has_more_page) && batch.length > 0;
                page++;
            }

            if (!rows.length) {
                await logSyncRun(supabase, logKind, true, 0, `no ${listKey} returned`);
                summary[listKey] = 0;
                continue;
            }

            // Zoho can repeat a row across page boundaries; Postgres refuses a
            // statement that carries the same conflict key twice.
            const unique = dedupeBy(rows, 'doc_type', 'zoho_id');

            const { error } = await supabase
                .from('zoho_documents')
                .upsert(unique, { onConflict: 'doc_type,zoho_id' });
            if (error) throw new Error(`upsert failed: ${error.message}`);

            await logSyncRun(supabase, logKind, true, unique.length);
            summary[listKey] = unique.length;
        } catch (err: any) {
            const message = err?.message || 'unknown error';
            // Log the failure before moving on: a sync that dies silently looks
            // identical to a quiet week, and this one guards the money figures.
            // The other source still runs — losing bills must not also cost us
            // a day of invoice updates.
            await logSyncRun(supabase, logKind, false, rows.length, message);
            console.error(`[zoho-invoice-sync:${listKey}]`, message);
            failures.push(`${listKey}: ${message}`);
        }
    }

    if (failures.length === SOURCES.length) {
        return NextResponse.json({ error: failures.join(' | ') }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        ...summary,
        ...(failures.length ? { partial_failure: failures } : {}),
    });
}

export async function GET(request: NextRequest) {
    return runJob(request);
}
