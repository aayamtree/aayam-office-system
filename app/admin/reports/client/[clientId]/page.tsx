'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Phone, Mail, MapPin, Building2, Scale, FileText, CreditCard, Banknote, X } from 'lucide-react';
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
    const [cashTxns, setCashTxns] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<Record<string, string>>({});
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    // Cash entry modal state
    const [showCashModal, setShowCashModal] = useState(false);
    const [cashEntry, setCashEntry] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        cash_account_id: '',
    });
    const [savingCash, setSavingCash] = useState(false);
    const [cashError, setCashError] = useState('');

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
            { data: cashTxnData },
            { data: bankData },
            { data: cashAccData },
            { data: catData },
        ] = await Promise.all([
            supabase.from('clients').select('*').eq('id', clientId).single(),
            supabase.from('jobs').select('id, job_number, project_name, order_date, total_amount, amount_received, current_stage').eq('client_id', clientId).order('order_date', { ascending: true }),
            supabase.from('bank_transactions').select('id, transaction_date, amount, description, reference_number, bank_account_id, income_category_id').eq('client_id', clientId).eq('is_verified', true).order('transaction_date', { ascending: true }),
            supabase.from('cash_transactions').select('id, transaction_date, amount, description, reference, cash_account_id').eq('client_id', clientId).eq('transaction_type', 'in').order('transaction_date', { ascending: true }),
            supabase.from('bank_accounts').select('id, name'),
            supabase.from('cash_accounts').select('id, name, current_balance'),
            supabase.from('income_categories').select('id, name'),
        ]);
        if (clientData) setClient(clientData);
        if (jobData) setJobs(jobData);
        if (txnData) setBankTxns(txnData);
        if (cashTxnData) setCashTxns(cashTxnData);
        if (bankData) setBankAccounts(Object.fromEntries(bankData.map((b: any) => [b.id, b.name])));
        if (cashAccData) {
            setCashAccounts(cashAccData);
            if (cashAccData.length > 0 && !cashEntry.cash_account_id) {
                setCashEntry(e => ({ ...e, cash_account_id: cashAccData[0].id }));
            }
        }
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

        // Cash payments → credit rows
        cashTxns.forEach(txn => {
            const d = (txn.transaction_date || '').split('T')[0];
            if (d < dateFrom || d > dateTo) return;
            const accName = cashAccounts.find((a: any) => a.id === txn.cash_account_id)?.name || 'Cash';
            rows.push({
                id: `cash-${txn.id}`,
                date: d,
                type: 'payment',
                paymentMode: 'cash',
                description: txn.description || 'Cash Payment Received',
                subLabel: `Cash · ${accName}`,
                isAdvance: false,
                ref: txn.reference || accName,
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
    }, [jobs, bankTxns, cashTxns, dateFrom, dateTo, bankAccounts, cashAccounts, categoryMap]);

    const totalBilled = ledger.reduce((s, r) => s + r.debit, 0);
    const totalReceived = ledger.reduce((s, r) => s + r.credit, 0);
    const outstanding = totalBilled - totalReceived;

    const handleSaveCash = async () => {
        if (!cashEntry.amount || !cashEntry.cash_account_id || !cashEntry.date) {
            setCashError('Please fill in all required fields.');
            return;
        }
        setSavingCash(true);
        setCashError('');
        try {
            const amt = Number(cashEntry.amount);
            // Get current balance of selected cash account
            const { data: accData, error: accErr } = await supabase
                .from('cash_accounts')
                .select('current_balance')
                .eq('id', cashEntry.cash_account_id)
                .single();
            if (accErr || !accData) throw new Error('Could not fetch cash account balance.');
            const newBalance = Number(accData.current_balance) + amt;

            // Insert cash transaction
            const { error: insertErr } = await supabase.from('cash_transactions').insert({
                cash_account_id: cashEntry.cash_account_id,
                client_id: clientId,
                transaction_type: 'in',
                amount: amt,
                description: cashEntry.description || 'Cash received from client',
                transaction_date: cashEntry.date,
                balance_after: newBalance,
                category: 'Client Payment',
                reference_type: 'client',
                reference_id: clientId,
            });
            if (insertErr) throw new Error(insertErr.message);

            // Update cash account balance
            const { error: updateErr } = await supabase
                .from('cash_accounts')
                .update({ current_balance: newBalance })
                .eq('id', cashEntry.cash_account_id);
            if (updateErr) throw new Error(updateErr.message);

            setShowCashModal(false);
            setCashEntry({ date: new Date().toISOString().split('T')[0], amount: '', description: '', cash_account_id: cashAccounts[0]?.id || '' });
            await loadData();
        } catch (err: any) {
            setCashError(err.message || 'Failed to save cash transaction.');
        } finally {
            setSavingCash(false);
        }
    };

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
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCashModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700"
                    >
                        <Banknote className="w-4 h-4" /> Record Cash
                    </button>
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
                        <p className="text-xs text-gray-400 mt-1">
                            {ledger.filter(r => r.paymentMode === 'bank').length} bank · {ledger.filter(r => r.paymentMode === 'cash').length} cash
                        </p>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Scale className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding</span>
                        </div>
                        <p className={`text-xl font-bold ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-green-700' : 'text-gray-900'}`}>
                            {fmt(Math.abs(outstanding))}
                            {outstanding < 0 && <span className="text-xs font-normal ml-1">CR</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{outstanding > 0 ? 'Amount due' : outstanding < 0 ? 'Credit balance' : 'Fully settled'}</p>
                    </div>
                </div>

                {/* Ledger table */}
                <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">Transaction Ledger</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Invoice</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Bank/UPI</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> Cash</span>
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
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
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
                                                    {row.paymentMode === 'cash' && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-700 border border-teal-200">CASH</span>
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
                                        <td className={`px-4 py-3 text-right text-sm ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                            {fmt(Math.abs(outstanding))}
                                            {outstanding < 0 && <span className="text-xs font-normal ml-1">CR</span>}
                                            {outstanding === 0 && <span className="text-xs font-normal ml-1">Settled</span>}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-xs text-center text-gray-400 pb-4">
                    This is a computer-generated statement. Bank-verified and cash transactions appear in the Received column.
                </p>
            </div>

            {/* Cash Entry Modal */}
            {showCashModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b">
                            <div className="flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-teal-600" />
                                <h2 className="font-bold text-gray-900">Record Cash Payment</h2>
                            </div>
                            <button onClick={() => { setShowCashModal(false); setCashError(''); }} className="p-1.5 hover:bg-gray-100 rounded-md">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-500">Cash received from <span className="font-semibold text-gray-800">{client.company || client.name}</span></p>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    value={cashEntry.date}
                                    onChange={e => setCashEntry(p => ({ ...p, date: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-teal-300 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={cashEntry.amount}
                                    onChange={e => setCashEntry(p => ({ ...p, amount: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-teal-300 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Payment for Job #1042"
                                    value={cashEntry.description}
                                    onChange={e => setCashEntry(p => ({ ...p, description: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-teal-300 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Cash Account <span className="text-red-500">*</span></label>
                                <select
                                    value={cashEntry.cash_account_id}
                                    onChange={e => setCashEntry(p => ({ ...p, cash_account_id: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-teal-300 outline-none bg-white"
                                >
                                    {cashAccounts.map((acc: any) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} (Balance: {fmt(Number(acc.current_balance))})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {cashError && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cashError}</p>
                            )}
                        </div>
                        <div className="flex gap-3 p-5 border-t">
                            <button
                                onClick={() => { setShowCashModal(false); setCashError(''); }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCash}
                                disabled={savingCash}
                                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
                            >
                                {savingCash ? 'Saving…' : 'Record Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print styles */}
            <style jsx global>{`
                @media print {
                    body { background: white; }

                    /* Hide all interactive UI chrome */
                    .print\\:hidden { display: none !important; }

                    /* Hide the sticky top bar inside this page component */
                    .sticky { display: none !important; }

                    /* Show the Ref column (hidden on mobile, should appear in print) */
                    .hidden { display: table-cell !important; }

                    /* Content fills full A4 width — no centering constraints */
                    .min-h-screen { min-height: unset !important; }
                    .max-w-4xl {
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Remove outer page padding so content uses full margin area */
                    .py-6 { padding-top: 0 !important; padding-bottom: 0 !important; }
                    .px-4, .px-6, .px-8 { padding-left: 0 !important; padding-right: 0 !important; }

                    /* Compact summary cards to one row */
                    .grid-cols-3 { grid-template-columns: repeat(3, 1fr) !important; }

                    /* Tighten card padding */
                    .p-4 { padding: 6px !important; }
                    .p-5 { padding: 8px !important; }
                }
            `}</style>
        </div>
    );
}
