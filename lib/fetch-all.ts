// Supabase returns at most 1,000 rows per request. This walks every page so a
// growing orders / payments table never gets silently cut off.
export async function fetchAll(
    db: any,
    table: string,
    columns: string,
    orderBy = 'id',
): Promise<Record<string, any>[]> {
    const PAGE = 1000;
    const out: Record<string, any>[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from(table).select(columns).order(orderBy, { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }
    return out;
}

// Only the columns the receivables maths needs.
export const JOB_COLS = 'id, client_id, job_number, project_name, created_at, subtotal, total_amount, invoice_amount, invoice_gst_rate, invoice_gst_amount, invoice_total, pending_amount, quantity, product_category, job_type';
export const CLIENT_COLS = 'id, name, company, address, city, state, pincode, phone, gstin';
