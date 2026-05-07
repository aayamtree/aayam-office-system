'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Phone, Mail, MapPin, Building2, FileText, CreditCard, Scale } from 'lucide-react';
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
    type: 'bill' | 'payment';
    description: string;
    ref: string;
    debit: number;   // bills received (amount we owe)
    credit: number;  // payments made (amount we paid)
    balance: number; // running outstanding (positive = we owe vendor)
};

export default function VendorStatementPage() {
    const { vendorId } = useParams<{ vendorId: string }>();
    const router = useRouter();

    const [vendor, setVendor] = useState<any>(null);
    const [bills, setBills] = useState<any[]>([]);
    const [bankTxns, setBankTxns] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const fyStart = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-04-01`
        : `${new Date().getFullYear() - 1}-04-01`;
    const [dateFrom, setDateFrom] = useState(fyStart);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (!vendorId) return;
        const load = async () => {
            setLoading(true);
            const [{ data: vendorData }, { data: billData }, { data: txnData }, { data: bankData }] = await Promise.all([
                supabase.from('vendors').select('*').eq('id', vendorId).single(),
                supabase.from('purchase_bills').select('id, bill_number, vendor_bill_number, description, total_amount, amount_paid, payment_status, bill_date, product_type').eq('vendor_id', vendorId).order('bill_date', { ascending: true }),
                supabase.from('bank_transactions').select('id, transaction_date, amount, description, reference_number, bank_account_id').eq('vendor_id', vendorId).eq('is_verified', true).order('transaction_date', { ascending: true }),
                supabase.from('bank_accounts').select('id, name'),
            ]);
            if (vendorData) setVendor(vendorData);
            if (billData) setBills(billData);
            if (txnData) setBankTxns(txnData);
            if (bankData) setBankAccounts(Object.fromEntries(bankData.map((b: any) => [b.id, b.name])));
            setLoading(false);
        };
        load();
    }, [vendorId]);

    const ledger: LedgerRow[] = useMemo(() => {
        const rows: Omit<LedgerRow, 'balance'>[] = [];

        // Opening balance row if vendor has one
        if (vendor?.opening_balance && Number(vendor.opening_balance) > 0) {
            const d = vendor.opening_balance_date || dateFrom;
            if (d >= dateFrom && d <= dateTo) {
                rows.push({
                    id: 'opening',
                    date: d,
                    type: 'bill',
                    description: 'Opening Balance',
                    ref: '',
                    debit: Number(vendor.opening_balance),
                    credit: 0,
                });
            }
        }

        // Purchase bills → debit (we owe vendor)
        bills.forEach(bill => {
            const d = (bill.bill_date || '').split('T')[0];
            if (d < dateFrom || d > dateTo) return;
            rows.push({
                id: `bill-${bill.id}`,
                date: d,
                type: 'bill',
                description: bill.description || bill.product_type || 'Purchase Bill',
                ref: bill.vendor_bill_number || bill.bill_number || '',
                debit: Number(bill.total_amount) || 0,
                credit: 0,
            });
        });

        // Bank payments → credit (we paid vendor)
        bankTxns.forEach(txn => {
            const d = txn.transaction_date || '';
            if (d < dateFrom || d > dateTo) return;
            rows.push({
                id: `txn-${txn.id}`,
                date: d,
                type: 'payment',
                description: txn.description || 'Payment to Vendor',
                ref: txn.reference_number || (txn.bank_account_id ? bankAccounts[txn.bank_account_id] : ''),
                debit: 0,
                credit: Number(txn.amount) || 0,
            });
        });

        rows.sort((a, b) => a.date.localeCompare(b.date));

        let balance = 0;
        return rows.map(row => {
            balance += row.debit - row.credit;
            return { ...row, balance };
        });
    }, [vendor, bills, bankTxns, dateFrom, dateTo, bankAccounts]);

    const totalBilled = ledger.reduce((s, r) => s + r.debit, 0);
    const totalPaid = ledger.reduce((s, r) => s + r.credit, 0);
    const outstanding = totalBilled - totalPaid;

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

    if (!vendor) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Vendor not found.</p>
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
                        <h1 className="font-bold text-gray-900 text-sm">Vendor Statement</h1>
                        <p className="text-xs text-gray-500">{vendor.company || vendor.name}</p>
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
                {/* Vendor header */}
                <div className="bg-white rounded-lg border p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-orange-600 font-bold text-xl">{(vendor.company || vendor.name)?.charAt(0)}</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{vendor.company || vendor.name}</h2>
                                {vendor.company && <p className="text-sm text-gray-500">{vendor.name}</p>}
                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                    {vendor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{vendor.phone}</span>}
                                    {vendor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{vendor.email}</span>}
                                    {vendor.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{vendor.city}, {vendor.state}</span>}
                                    {vendor.gstin && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />GSTIN: {vendor.gstin}</span>}
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
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Bills</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{fmt(totalBilled)}</p>
                        <p className="text-xs text-gray-400 mt-1">{ledger.filter(r => r.type === 'bill').length} bills</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="w-4 h-4 text-red-400" />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Paid</span>
                        </div>
                        <p className="text-xl font-bold text-red-700">{fmt(totalPaid)}</p>
                        <p className="text-xs text-gray-400 mt-1">{ledger.filter(r => r.type === 'payment').length} payments</p>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Scale className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding</span>
                        </div>
                        <p className={`text-xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(outstanding)}</p>
                        <p className="text-xs text-gray-400 mt-1">{outstanding > 0 ? 'Payable to vendor' : 'Fully settled'}</p>
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
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Ref / Bill No.</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Billed</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ledger.map(row => (
                                        <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${row.type === 'payment' ? 'bg-red-50/20' : ''}`}>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{fmtDate(row.date)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.type === 'bill' ? 'bg-orange-400' : 'bg-red-400'}`} />
                                                    <span className="text-gray-800 font-medium">{row.description}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 ml-3.5">{row.type === 'bill' ? 'Purchase Bill' : 'Bank Payment'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell font-mono">{row.ref}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                                {row.debit > 0 ? fmt(row.debit) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-red-700">
                                                {row.credit > 0 ? fmt(row.credit) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${row.balance > 0 ? 'text-red-600' : row.balance < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                {fmt(Math.abs(row.balance))}
                                                {row.balance < 0 && <span className="text-xs font-normal ml-1 text-green-600">ADV</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-gray-200">
                                    <tr className="bg-gray-50 font-bold">
                                        <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">Closing Balance</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-800">{fmt(totalBilled)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-red-700">{fmt(totalPaid)}</td>
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

                <p className="text-xs text-center text-gray-400 pb-4">
                    This is a computer-generated statement. Only bank-verified payments appear in the Paid column.
                </p>
            </div>

            <style jsx global>{`
                @media print {
                    body { background: white; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>
        </div>
    );
}
