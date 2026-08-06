// GET /api/zoho/sync-accounts — pull Zoho's Chart of Accounts and share it as
// the app's category list.
//
// WHY THIS IS ITS OWN ROUTE
// It started life inside /api/zoho/backfill, which was a mistake: that route
// already walks a financial year of invoices, quotes and thousands of bank
// lines, and adding this tipped it past the 60s function limit. The browser
// then got an HTML timeout page instead of JSON and reported "Could not reach
// the server" — a confusing symptom for a simple cause.
//
// A chart of accounts is small and changes rarely. It deserves a fast route of
// its own, not a passenger seat on the slowest job in the system.
//
// WHY THE APP NEEDS THESE AT ALL
// The HDFC feed reaches Zoho, so bank spending is categorised there. Cash and
// UPI never touch that account, so the app records those — and for the two to
// report together they must use the SAME category names.

import { NextResponse } from 'next/server';
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

/** Account types that are CATEGORIES. Bank/cash/credit-card are accounts, not
 *  categories, and would only clutter the picker. */
const CATEGORY_TYPES = ['expense', 'other_expense', 'cost_of_goods_sold', 'income', 'other_income'];

function str(value: unknown): string | null {
    if (typeof value === 'number') return String(value);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET() {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const supabase = zohoServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
        return NextResponse.json(
            { error: 'Zoho is not connected. Visit /api/zoho/oauth/start first.' },
            { status: 409 }
        );
    }
    const orgId = await getOrganizationId(supabase, accessToken);
    if (!orgId) return NextResponse.json({ error: 'Could not read the Zoho organisation.' }, { status: 502 });

    // Walk the pages, stopping as soon as one brings nothing new — Zoho has
    // repeated ids and ignored paging parameters before now.
    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
        const json = await zohoGet(accessToken, orgId, '/chartofaccounts', {
            per_page: '200',
            page: String(page),
        });
        if (!json) {
            await logSyncRun(supabase, 'accounts', false, rows.length, `Fetch failed on page ${page}`);
            return NextResponse.json({ error: 'Could not fetch the chart of accounts.' }, { status: 502 });
        }
        const batch: Record<string, unknown>[] = json.chartofaccounts || json.chart_of_accounts || [];
        let fresh = 0;
        for (const row of batch) {
            const id = str(row.account_id);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            rows.push(row);
            fresh += 1;
        }
        if (batch.length === 0 || fresh === 0) break;
        hasMore = Boolean(json.page_context?.has_more_page);
        page += 1;
    }

    if (rows.length === 0) {
        await logSyncRun(supabase, 'accounts', false, 0, 'Zoho returned no accounts');
        return NextResponse.json(
            { error: 'Zoho returned no accounts. Check the ZohoBooks.settings.READ scope was granted.' },
            { status: 502 }
        );
    }

    const now = new Date().toISOString();

    // 1. The full mirror — every account, whatever its type.
    const mapped = dedupeBy(
        rows.map((a) => ({
            zoho_account_id: String(a.account_id),
            account_name: str(a.account_name),
            account_type: str(a.account_type),
            account_code: str(a.account_code),
            description: str(a.description),
            is_active: typeof a.is_active === 'boolean' ? a.is_active : null,
            raw: a,
            last_synced_at: now,
        })),
        'zoho_account_id'
    );

    const { error: accErr } = await supabase
        .from('zoho_accounts')
        .upsert(mapped, { onConflict: 'zoho_account_id' });
    if (accErr) {
        await logSyncRun(supabase, 'accounts', false, mapped.length, accErr.message);
        return NextResponse.json({ error: `Store failed: ${accErr.message}` }, { status: 500 });
    }

    // 2. The expense/income ones become shared categories. Upsert on
    //    zoho_account_id: a rename in Zoho updates in place, and app-created
    //    categories (null zoho_account_id) are never touched.
    const categories = mapped
        .filter((a) => CATEGORY_TYPES.includes(String(a.account_type || '')))
        .map((a) => ({
            zoho_account_id: a.zoho_account_id,
            name: a.account_name,
            description: a.description,
            is_active: a.is_active ?? true,
            source: 'zoho',
        }));

    let categoriesSynced = 0;
    if (categories.length > 0) {
        const { error: catErr } = await supabase
            .from('expense_categories')
            .upsert(categories, { onConflict: 'zoho_account_id' });
        if (catErr) {
            await logSyncRun(supabase, 'accounts', false, mapped.length, catErr.message);
            return NextResponse.json({ error: `Category sync failed: ${catErr.message}` }, { status: 500 });
        }
        categoriesSynced = categories.length;
    }

    await logSyncRun(supabase, 'accounts', true, mapped.length, `${categoriesSynced} categories`);

    return NextResponse.json({
        ok: true,
        accounts_mirrored: mapped.length,
        categories_shared: categoriesSynced,
        account_types: Array.from(new Set(mapped.map((a) => a.account_type))).filter(Boolean),
    });
}
