// API Route: /api/crm/clients/[id]/finance
//
// Returns one client's invoices, receipts and total received.
//
// Why this exists: the finance tables are being locked so only admins can read
// them directly (designers could previously read every vendor payment and bank
// transaction). Marketing still legitimately needs a client's payment position
// when they're on the phone to that client — so instead of leaving the tables
// open to everyone, this is a controlled door: admin + marketing only, one
// client at a time, and only the fields the CRM screens actually display.
//
// Uses the service role deliberately, which is why the role check above it
// matters. See lib/api-auth.ts.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
    // admin always passes; marketing is allowed here specifically.
    const gate = await requireRole(['marketing']);
    if (!gate.ok) return gate.response;

    const clientId = params.id;
    if (!clientId) {
        return NextResponse.json({ error: 'Client id is required' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    try {
        const [invoicesRes, paymentsRes, bankRes, cashRes] = await Promise.all([
            supabase
                .from('invoices')
                .select('id, invoice_number, invoice_date, due_date, total_amount, amount_paid, payment_status')
                .eq('client_id', clientId)
                .order('invoice_date', { ascending: false }),
            supabase
                .from('payments_received')
                .select('id, payment_number, payment_date, amount, payment_mode, reference_number, invoice_id')
                .eq('client_id', clientId)
                .order('payment_date', { ascending: false }),
            supabase
                .from('bank_transactions')
                .select('amount')
                .eq('client_id', clientId)
                .eq('is_verified', true),
            supabase
                .from('cash_transactions')
                .select('amount')
                .eq('client_id', clientId)
                .eq('transaction_type', 'in'),
        ]);

        const sum = (rows: { amount: number | null }[] | null) =>
            (rows || []).reduce((total, row) => total + Number(row.amount || 0), 0);

        return NextResponse.json({
            invoices: invoicesRes.data || [],
            payments: paymentsRes.data || [],
            received_total: sum(bankRes.data) + sum(cashRes.data),
        });
    } catch (error: any) {
        console.error('CRM client finance error:', error);
        return NextResponse.json({ error: 'Failed to load client finance data' }, { status: 500 });
    }
}
