'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Phone, Mail, MapPin, Building2, TrendingUp, TrendingDown, Scale, FileText, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

type LedgerRow = {
    id: string;
    date: string;       // ISO date string for sorting
    type: 'invoice' | 'payment';
    description: string;
    ref: string;
    debit: number;      // amount owed (invoice)
    credit: number;     // amount received (bank payment)
    balance: number;    // running balance
};

export default function ClientStatementPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const router = useRouter();

    const [client, setClient] = useState<any>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [bankTxns, setBankTxns] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    // Default: current financial year
    const fyStart = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-04-01`
        : `${new Date().getFullYear() - 1}-04-01`;
    const [dateFrom, setDateFrom] = useState(fyStart);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (!clientId) return;
        const load = async () => {
            setLoading(true);
            const [{ data: clientData }, { data: jobData }, { data: txnData }, { data: bankData }] = await Promise.all([
                supabase.from('clients').select('*').eq('id', clientId).single(),
                supabase.from('jobs').select('id, job_number, project_name, order_date, total_amount, amount_received, current_stage').eq('client_id', clientId).order('order_date', { ascending: true }),
                supabase.from('bank_transactions').select('id, transaction_date, amount, description, reference_number, bank_account_id, categorization_type, transaction_type').eq('client_id', clientId).eq('is_verified', true).order('transaction_date', { ascending: true }),
                supabase.from('bank_accounts').select('id, name'),
            ]);
            if (clientData) setClient(clientData);
            if (jobData) setJobs(jobData);
            if (txnData) setBankTxns(txnData);
            if (bankData) setBankAccounts(Object.fromEntries(bankData.map((b: any) => [b.id, b.name])));
            setLoading(false);
        };
        load();
    }, [clientId]);

    const ledger: LedgerRow[] = useMemo(() => {
        const rows: Omit<LedgerRow, 'balance'>[] = [];

        // Jobs → invoice rows (debit)
        jobs.forEach(job => {
            const d = (job.order_date || '').split('T')[0];
            if (d < dateFrom || d > dateTo) return;
            rows.push({
                id: `job-${job.id}`,
                date: d,
                type: 'invoice',
                description: job.project_name || 'Job',
                ref: job.job_number || '',
                debit: Number(job.total_amount) || 0,
                credit: 0,
            });
        });

        // Bank payments → credit rows
        bankTxns.forEach(txn => {
            const d = txn.transaction_date || '';
            if (d < dateFrom || d > dateTo) return;
            rows.push({
                id: `txn-${txn.id}`,
                date: d,
                type: 'payment',
                description: txn.description || 'Payment Received',
                ref: txn.reference_number || (txn.bank_account_id ? bankAccounts[txn.bank_account_id] : ''),
                debit: 0,
                credit: Number(txn.amount) || 0,
            });
        });

        // Sort by date
        rows.sort((a, b) => a.date.localeCompare(b.date));

        // Add running balance
        let balance = 0;
        return rows.map(row => {
            balance += row.debit - row.credit;
            return { ...row, balance };
        });
    }, [jobs, bankTxns, dateFrom, dateTo, bankAccounts]);

    const totalBilled = ledger.reduce((s, r) => s + r.debit, 0);
    const totalReceived = ledger.reduce((s, r) => s + r.credit, 0);
    const outstanding = totalBilled - totalReceived;

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
                        <h1 className="font-bold text-gray-900 text-sm">Statement of Account</h1>
                        <p className="text-xs text-gray-500">{client.company || client.name}</p>
                    </div>
                </div>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
                >
                    <Printer className="w-4 h-4" /> Print / PDF
                </button>
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
                            <p className="font-semibold text-gray-900">Statement Period</p>
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
                        <p className="text-xs text-gray-400 mt-1">{ledger.filter(r => r.type === 'payment').length} payments</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Scale className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding</span>
                        </div>
                        <p className={`text-xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(outstanding)}</p>
                        <p className="text-xs text-gray-400 mt-1">{outstanding > 0 ? 'Amount due' : 'Fully settled'}</p>
                    </div>
                </div>

                {/* Ledger table */}
                <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">Transaction Ledger</h3>
                        <span className="text-xs text-gray-400">{ledger.length} entries</span>
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
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ledger.map(row => (
                                        <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${row.type === 'payment' ? 'bg-green-50/30' : ''}`}>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{fmtDate(row.date)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.type === 'invoice' ? 'bg-blue-400' : 'bg-green-400'}`} />
                                                    <span className="text-gray-800 font-medium">{row.description}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 ml-3.5">{row.type === 'invoice' ? 'Invoice' : 'Bank Payment'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell font-mono">{row.ref}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                                {row.debit > 0 ? fmt(row.debit) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                                                {row.credit > 0 ? fmt(row.credit) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${row.balance > 0 ? 'text-red-600' : row.balance < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                {fmt(Math.abs(row.balance))}
                                                {row.balance < 0 && <span className="text-xs font-normal ml-1 text-green-600">CR</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-gray-200">
                                    <tr className="bg-gray-50 font-bold">
                                        <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">Closing Balance</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-800">{fmt(totalBilled)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-green-700">{fmt(totalReceived)}</td>
                                        <td className={`px-4 py-3 text-right text-sm ${outstanding > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                            {fmt(outstanding)}
                                            {outstanding <= 0 && <span className="text-xs font-normal ml-1">Settled</span>}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-xs text-center text-gray-400 pb-4">
                    This is a computer-generated statement. Only bank-verified transactions appear in the Received column.
                </p>
            </div>

            {/* Print styles */}
            <style jsx global>{`
                @media print {
                    body { background: white; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>
        </div>
    );
}
