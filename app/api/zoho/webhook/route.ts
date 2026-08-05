// POST /api/zoho/webhook — receive invoices & estimates from Zoho Books.
//
// WHY THIS EXISTS
// Invoicing happens in Zoho Books because the HDFC bank feed lives there.
// This app runs the work (jobs, dispatch, alerts) and needs to SEE those
// documents without anyone retyping them. Zoho workflow rules fire a webhook
// at this route whenever an invoice or estimate is created or edited; we
// upsert it into zoho_documents. Zoho stays the source of truth — the app
// never writes back.
//
// DESIGN NOTES
//  - Auth: the URL must carry ?key=<secret>. The secret lives in
//    zoho_sync_config (service role only), NOT in an env var, so rotating it
//    is a DB update with no redeploy.
//  - Zoho sends different shapes depending on how the workflow webhook is
//    configured: raw JSON body ({invoice:{...}} / {estimate:{...}} / bare
//    entity), or form-encoded with a JSONString field. parseBody handles all.
//  - Upsert on (doc_type, zoho_id): edits update in place, retries are safe.
//  - Never throws HTML errors back at Zoho — always JSON, correct status
//    codes, and details in the server log.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function serviceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

/** Accept raw JSON, {invoice}/{estimate} wrappers, or form JSONString. */
async function parseBody(request: NextRequest): Promise<Record<string, unknown> | null> {
    const contentType = request.headers.get('content-type') || '';
    try {
        if (contentType.includes('application/json')) {
            return await request.json();
        }
        // Zoho often posts form-encoded with a JSONString parameter.
        const text = await request.text();
        const params = new URLSearchParams(text);
        const jsonString = params.get('JSONString') || params.get('jsonstring');
        if (jsonString) return JSON.parse(jsonString);
        // Last resort: maybe the body is JSON without the header.
        return JSON.parse(text);
    } catch {
        return null;
    }
}

type Extracted = {
    docType: 'invoice' | 'estimate';
    zohoId: string;
    docNumber: string | null;
    customerName: string | null;
    docDate: string | null;
    dueDate: string | null;
    status: string | null;
    subTotal: number | null;
    taxTotal: number | null;
    total: number | null;
    balance: number | null;
    currency: string | null;
    lineItems: unknown;
};

function num(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Find the entity in whatever wrapper Zoho used and map its fields. */
function extract(payload: Record<string, unknown>): Extracted | null {
    const wrapped =
        (payload.invoice as Record<string, unknown> | undefined) ||
        (payload.estimate as Record<string, unknown> | undefined) ||
        payload;

    const isInvoice = 'invoice_id' in wrapped || 'invoice_number' in wrapped;
    const isEstimate = 'estimate_id' in wrapped || 'estimate_number' in wrapped;
    if (!isInvoice && !isEstimate) return null;

    const docType = isInvoice ? 'invoice' : 'estimate';
    const zohoId = str(wrapped[isInvoice ? 'invoice_id' : 'estimate_id']);
    if (!zohoId) return null;

    return {
        docType,
        zohoId,
        docNumber: str(wrapped[isInvoice ? 'invoice_number' : 'estimate_number']),
        customerName: str(wrapped.customer_name),
        docDate: str(wrapped.date),
        dueDate: str(isInvoice ? wrapped.due_date : wrapped.expiry_date),
        status: str(wrapped.status),
        subTotal: num(wrapped.sub_total),
        taxTotal: num(wrapped.tax_total),
        total: num(wrapped.total),
        balance: num(wrapped.balance),
        currency: str(wrapped.currency_code) || 'INR',
        lineItems: wrapped.line_items ?? null,
    };
}

export async function POST(request: NextRequest) {
    const supabase = serviceClient();
    if (!supabase) {
        console.error('[zoho/webhook] SUPABASE_SERVICE_ROLE_KEY missing');
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify the shared secret carried in the URL.
    const key = request.nextUrl.searchParams.get('key') || '';
    const { data: secretRow, error: secretError } = await supabase
        .from('zoho_sync_config')
        .select('value')
        .eq('key', 'webhook_secret')
        .single();
    if (secretError || !secretRow || !key || key !== secretRow.value) {
        console.error('[zoho/webhook] rejected: bad or missing key');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await parseBody(request);
    if (!payload) {
        console.error('[zoho/webhook] unparseable body');
        return NextResponse.json({ error: 'Unparseable body' }, { status: 400 });
    }

    const doc = extract(payload);
    if (!doc) {
        console.error('[zoho/webhook] no invoice/estimate found in payload:', Object.keys(payload));
        return NextResponse.json({ error: 'No invoice or estimate in payload' }, { status: 422 });
    }

    const { error } = await supabase
        .from('zoho_documents')
        .upsert(
            {
                doc_type: doc.docType,
                zoho_id: doc.zohoId,
                doc_number: doc.docNumber,
                customer_name: doc.customerName,
                doc_date: doc.docDate,
                due_date: doc.dueDate,
                status: doc.status,
                sub_total: doc.subTotal,
                tax_total: doc.taxTotal,
                total: doc.total,
                balance: doc.balance,
                currency: doc.currency,
                line_items: doc.lineItems,
                raw: payload,
                last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'doc_type,zoho_id' }
        );

    if (error) {
        console.error('[zoho/webhook] upsert failed:', error.message);
        return NextResponse.json({ error: 'Store failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, doc_type: doc.docType, number: doc.docNumber });
}
