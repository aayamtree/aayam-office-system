// GET /api/cron/zoho-invoice-sync — pull every invoice out of Zoho Books.
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

    const rows: Record<string, unknown>[] = [];
    let page = 1;
    let hasMore = true;

    try {
        while (hasMore && page <= MAX_PAGES) {
            const json = await zohoGet(accessToken, orgId, '/invoices', {
                page: String(page),
                per_page: String(PER_PAGE),
                sort_column: 'date',
                sort_order: 'D',
            });
            if (!json) throw new Error(`invoice list failed on page ${page}`);

            const batch = (json.invoices || []) as any[];
            for (const inv of batch) {
                const zohoId = str(inv.invoice_id);
                if (!zohoId) continue;
                rows.push({
                    doc_type: 'invoice',
                    zoho_id: zohoId,
                    doc_number: str(inv.invoice_number),
                    customer_name: str(inv.customer_name),
                    doc_date: str(inv.date),
                    due_date: str(inv.due_date),
                    status: str(inv.status),
                    sub_total: num(inv.sub_total),
                    tax_total: num(inv.tax_total),
                    total: num(inv.total),
                    balance: num(inv.balance),
                    currency: str(inv.currency_code),
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
            await logSyncRun(supabase, 'invoices', true, 0, 'no invoices returned');
            return NextResponse.json({ ok: true, fetched: 0, upserted: 0 });
        }

        // Zoho can repeat a row across page boundaries; Postgres refuses a
        // statement that carries the same conflict key twice.
        const unique = dedupeBy(rows, 'doc_type', 'zoho_id');

        const { error } = await supabase
            .from('zoho_documents')
            .upsert(unique, { onConflict: 'doc_type,zoho_id' });
        if (error) throw new Error(`upsert failed: ${error.message}`);

        await logSyncRun(supabase, 'invoices', true, unique.length);
        return NextResponse.json({
            ok: true,
            fetched: rows.length,
            upserted: unique.length,
            pages: page - 1,
        });
    } catch (err: any) {
        const message = err?.message || 'unknown error';
        // Log the failure before returning: a sync that dies silently looks
        // identical to a quiet week, and this one guards the money figures.
        await logSyncRun(supabase, 'invoices', false, rows.length, message);
        console.error('[zoho-invoice-sync]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return runJob(request);
}
