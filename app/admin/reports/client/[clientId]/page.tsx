'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Phone, Mail, MapPin, Building2, Scale, FileText, CreditCard, Banknote, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { refuseLegacyWrite } from '@/lib/legacy-ledger';

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

type LedgerRow = {
    id: string;
    date: string;
    type: 'invoice' | 'payment';
    paymentMode: 'bank' | 'cash' | null;
    description: string;
    subLabel: string;
    isAdvance: boolean;
    ref: string;
    debit: number;
    credit: number;
    balance: number;
};

export default function ClientStatementPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const router = useRouter();

    const [client, setClient] = useState<any>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [bankTxns, setBankTxns] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<Record<string, string>>({});
    const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);


    // Default: current financial year
    const fyStart = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-04-01`
        : `${new Date().getFullYear() - 1}-04-01`;
    const [dateFrom, setDateFrom] = useState(fyStart);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        if (!clientId) return;
        setLoading(true);
        const [
            { data: clientData },
            { data: jobData },
            { data: txnData },
            { data: bankData },
            { data: catData },
        ] = await Promise.all([
            supabase.from('clients').select('*').eq('id', clientId).single(),
            supabase.from('jobs').select('id, job_number, project_name, order_date, total_amount, amount_received, current_stage').eq('client_id', clientId).order('order_date', { ascending: true }),
            supabase.from('bank_transactions').select('id, transaction_date, amount, description, reference_number, bank_account_id, income_category_id').eq('client_id', clientId).eq('is_verified', true).order('transaction_date', { ascending: true }),
            supabase.from('bank_accounts').select('id, name'),
            supabase.from('income_categories').select('id, name'),
        ]);
        if (clientData) setClient(clientData);
        if (jobData) setJobs(jobData);
        if (txnData) setBankTxns(txnData);
        if (bankData) setBankAccounts(Object.fromEntries(bankData.map((b: any) => [b.id, b.name])));
        if (catData) setCategoryMap(Object.fromEntries(catData.map((c: any) => [c.id, c.name])));
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [clientId]);

    const ledger: LedgerRow[] = useMemo(() => {
        const rows: Omit<LedgerRow, 'balance'>[] = [];

        // Opening balance — brought forward from previous FY
        if (client?.opening_balance && Number(client.opening_balance) > 0) {
            const d = client.opening_balance_date || dateFrom;
            if (d >= dateFrom && d <= dateTo) {
                const obType = client.opening_balance_type || 'debit';
                rows.push({
                    id: 'opening',
                    date: d,
                    type: obType === 'debit' ? 'invoice' : 'payment',
                    paymentMode: null,
                    description: 'Opening Balance',
                    subLabel: obType === 'debit'
                        ? 'Receivable brought forward — client owes from last year'
                        : 'Credit brought forward — advance / overpayment from last year',
                    isAdvance: obType === 'credit',
                    ref: '',
                    debit: obType === 'debit' ? Number(client.opening_balance) : 0,
                    credit: obType === 'credit' ? Number(client.opening_balance) : 0,
                });
            }
        }

        // Jobs → invoice rows (debit)
        jobs.forEach(job => {
            const d = (job.order_date || '').split('T')[0];
            if (d < dateFrom || d > dateTo) return;
            rows.push({
                id: `job-${job.id}`,
                date: d,
                type: 'invoice',
                paymentMode: null,
                description: job.project_name || 'Job',
                subLabel: `Invoice · ${job.job_number || ''}`,
                isAdvance: false,
                ref: job.job_number || '',
                debit: Number(job.total_amount) || 0,
                credit: 0,
            });
        });

        // Bank payments → credit rows
        bankTxns.forEach(txn => {
            const d = txn.transaction_date || '';
            if (d < dateFrom || d > dateTo) return;
            const catName = txn.income_category_id ? (categoryMap[txn.income_category_id] || 'Payment Received') : 'Payment Received';
            const isAdv = catName.toLowerCase().includes('advance');
            rows.push({
                id: `txn-${txn.id}`,
                date: d,
                type: 'payment',
                paymentMode: 'bank',
                description: txn.description || 'Payment Received',
                subLabel: catName,
                isAdvance: isAdv,
                ref: txn.reference_number || (txn.bank_account_id ? bankAccounts[txn.bank_account_id] : ''),
                debit: 0,
                credit: Number(txn.amount) || 0,
            });
        });

        // Sort by date
        rows.sort((a, b) => a.date.localeCompare(b.date));

        // Running balance
        let balance = 0;
        return rows.map(row => {
            balance += row.debit - row.credit;
            return { ...row, balance };
        });
    }, [jobs, bankTxns, dateFrom, dateTo, bankAccounts, categoryMap]);

    const totalBilled = ledger.reduce((s, r) => s + r.debit, 0);
    const totalReceived = ledger.reduce((s, r) => s + r.credit, 0);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-gray-500">Loading statement…</p>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500">Client not found.</p>
                    <button onClick={() => router.back()} className="mt-4 text-sm underline text-gray-500">Go back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top bar */}
            <div className="bg-white border-b px-4 md:px-6 py-3 flex items-center justify-between print:hidden sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-md">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="font-bold text-gray-900 text-sm">Transaction History</h1>
                        <p className="text-xs text-gray-500">{client.company || client.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
                    >
                        <Printer className="w-4 h-4" /> Print / PDF
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
                {/* Client header */}
                <div className="bg-white rounded-lg border p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-xl">{(client.company || client.name)?.charAt(0)}</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{client.company || client.name}</h2>
                                {client.company && <p className="text-sm text-gray-500">{client.name}</p>}
                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                    {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
                                    {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
                                    {client.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{client.city}, {client.state}</span>}
                                    {client.gstin && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />GSTIN: {client.gstin}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                            <p className="font-semibold text-gray-900">Period</p>
                            <p>{fmtDate(dateFrom)} – {fmtDate(dateTo)}</p>
                            <p className="text-xs mt-1">Generated {fmtDate(new Date().toISOString().split('T')[0])}</p>
                        </div>
                    </div>
                </div>

                {/* Date filters */}
                <div className="flex items-center gap-3 flex-wrap print:hidden">
                    <span className="text-sm font-medium text-gray-600">Period:</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="border rounded-md px-3 py-1.5 text-sm focus:ring-2 ring-gray-200 outline-none" />
                    <span className="text-sm text-gray-500">to</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="border rounded-md px-3 py-1.5 text-sm focus:ring-2 ring-gray-200 outline-none" />
                    <button onClick={() => { setDateFrom(fyStart); setDateTo(new Date().toISOString().split('T')[0]); }}
                        className="text-xs text-gray-500 underline">Reset to FY</button>
                </div>

                {/* The receipts side of this page reads bank_transactions —
                    the app's own ledger, closed for writing on
                    5 August 2026. The invoice side reads jobs and is current. Saying
                    so is not optional: without it the two totals below look like a
                    matched pair. */}
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm print:border-gray-300 print:bg-white">
                    <p className="font-semibold text-amber-900">Received stops at 5 August 2026.</p>
                    <p className="mt-1 text-amber-800">
                        Payments have been recorded in Zoho and Vyapar since then, and this page cannot see
                        them. Invoicing below is current, so the two columns cover different periods and must
                        not be subtracted from each other. For what a client actually owes, use{' '}
                        <Link href="/admin/finance/money-in" className="font-semibold underline underline-offset-2">Money In</Link>.
                    </p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Billed</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{fmt(totalBilled)}</p>
                        <p className="text-xs text-gray-400 mt-1">{ledger.filter(r => r.type === 'invoice').length} invoices</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Received</span>
                        </div>
                        <p className="text-xl font-bold text-green-700">{fmt(totalReceived)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            {ledger.filter(r => r.paymentMode === 'bank').length} bank
                        </p>
                    </div>
                    {/* This tile said "Outstanding … Amount due" in red, from
                        totalBilled − totalReceived. Billing is LIVE (jobs, current
                        to today); receipts come from bank_transactions,
                        which stopped on 5 August 2026. So the
                        subtraction billed a client for five weeks of new work and
                        credited them with nothing they had paid in those weeks —
                        a red "amount due" that Zoho may show as settled, on a page
                        whose own footer calls itself a statement. Removed
                        2026-09-08; the rows below are still true individually. */}
                    <div className="bg-white border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Scale className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding</span>
                        </div>
                        <p className="text-xl font-bold text-gray-300">&mdash;</p>
                        <Link href="/admin/finance/money-in" className="text-xs text-primary underline underline-offset-2 mt-1 inline-block">
                            Money In has the real figure
                        </Link>
                    </div>
                </div>

                {/* Ledger table */}
                <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">Transaction Ledger</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Invoice</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Bank/UPI</span>
                            <span className="ml-2">{ledger.length} entries</span>
                        </div>
                    </div>

                    {ledger.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 text-sm">
                            No transactions found for this period.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Ref</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoiced</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Received</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ledger.map(row => (
                                        <tr
                                            key={row.id}
                                            className={`hover:bg-gray-50 transition-colors ${
                                                row.isAdvance ? 'bg-amber-50/40' :
                                                row.paymentMode === 'cash' ? 'bg-teal-50/30' :
                                                row.type === 'payment' ? 'bg-green-50/30' : ''
                                            }`}
                                        >
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{fmtDate(row.date)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`inline-flex w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                        row.type === 'invoice' ? 'bg-blue-400' :
                                                        row.isAdvance ? 'bg-amber-400' :
                                                        row.paymentMode === 'cash' ? 'bg-teal-400' :
                                                        'bg-green-400'
                                                    }`} />
                                                    <span className="text-gray-800 font-medium">{row.description}</span>
                                                    {row.isAdvance && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">ADVANCE</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 ml-3.5">{row.subLabel}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell font-mono">{row.ref}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                                {row.debit > 0 ? fmt(row.debit) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                                                {row.credit > 0 ? fmt(row.credit) : <span className="text-gray-300">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-gray-200">
                                    {/* The running balance per row and the closing
                                        balance were the same wrong subtraction as the
                                        tile above, repeated on every line. Totals of
                                        what was invoiced and what was received stay —
                                        each of those is a real sum of real rows. */}
                                    <tr className="bg-gray-50 font-bold">
                                        <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">Totals for this period</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-800">{fmt(totalBilled)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-green-700">{fmt(totalReceived)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-xs text-center text-gray-400 pb-4">
                    Transaction history, not a statement of account. Received covers bank-verified entries
                    in the app&rsquo;s own ledger, which stopped on 5 August 2026 — anything paid
                    since then is in Zoho and is not shown here. Do not send this to a client as a balance.
                </p>
            </div>

            {/* Cash Entry Modal */}
        </div>
    );
}
