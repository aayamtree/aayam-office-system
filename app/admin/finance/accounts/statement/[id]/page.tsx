'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Download, Printer, Calendar, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { loadXLSX } from '@/lib/lazy-loaders';

export default function AccountStatementPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.id as string;

    const [account, setAccount] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountType, setAccountType] = useState<'bank' | 'cash'>('bank');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const loadAccountAndTransactions = useCallback(async () => {
        setLoading(true);
        try {
            // Try loading as bank account first
            let { data: bankAcc } = await supabase
                .from('bank_accounts')
                .select('*')
                .eq('id', accountId)
                .single();

            if (bankAcc) {
                setAccount(bankAcc);
                setAccountType('bank');
                await loadBankTransactions();
            } else {
                // Try as cash account
                let { data: cashAcc } = await supabase
                    .from('cash_accounts')
                    .select('*')
                    .eq('id', accountId)
                    .single();

                if (cashAcc) {
                    setAccount(cashAcc);
                    setAccountType('cash');
                    await loadCashTransactions();
                }
            }
        } catch (error) {
            console.error('Error loading account:', error);
        } finally {
            setLoading(false);
        }
    }, [accountId, startDate, endDate]);

    useEffect(() => {
        loadAccountAndTransactions();
    }, [loadAccountAndTransactions]);

    const loadBankTransactions = async () => {
        let query = supabase
            .from('bank_transactions')
            .select('*')
            .eq('bank_account_id', accountId)
            .order('transaction_date', { ascending: false });

        if (startDate) query = query.gte('transaction_date', startDate);
        if (endDate) query = query.lte('transaction_date', endDate);

        const { data } = await query;
        setTransactions(data || []);
    };

    const loadCashTransactions = async () => {
        let query = supabase
            .from('cash_transactions')
            .select('*')
            .eq('cash_account_id', accountId)
            .order('transaction_date', { ascending: false });

        if (startDate) query = query.gte('transaction_date', startDate);
        if (endDate) query = query.lte('transaction_date', endDate);

        const { data } = await query;
        setTransactions(data || []);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = async () => {
        // Prepare data for Excel export
        const exportData = transactions.map((txn) => {
            const isDebit = accountType === 'bank'
                ? txn.transaction_type === 'outflow'
                : txn.transaction_type === 'out';

            return {
                'Date': new Date(txn.transaction_date).toLocaleDateString('en-IN'),
                'Description': txn.description || '-',
                'Reference': txn.reference_number || '-',
                'Debit': isDebit ? txn.amount : '',
                'Credit': !isDebit ? txn.amount : '',
                'Balance': txn.balance_after || 0
            };
        });

        // Add summary row
        exportData.push({
            'Date': '',
            'Description': '',
            'Reference': 'TOTALS',
            'Debit': totalDebit,
            'Credit': totalCredit,
            'Balance': account.current_balance || 0
        });

        // Lazy load XLSX library only when needed
        const XLSX = await loadXLSX();
        
        // Create workbook
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();

        // Set column widths
        ws['!cols'] = [
            { wch: 12 }, // Date
            { wch: 30 }, // Description
            { wch: 15 }, // Reference
            { wch: 12 }, // Debit
            { wch: 12 }, // Credit
            { wch: 12 }  // Balance
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Statement');

        // Generate filename
        const filename = `${account.name}_Statement_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Download
        XLSX.writeFile(wb, filename);
    };

    const handleExportCSV = () => {
        // Prepare CSV data
        let csv = 'Date,Description,Reference,Debit,Credit,Balance\n';

        transactions.forEach((txn) => {
            const isDebit = accountType === 'bank'
                ? txn.transaction_type === 'outflow'
                : txn.transaction_type === 'out';

            const date = new Date(txn.transaction_date).toLocaleDateString('en-IN');
            const desc = (txn.description || '-').replace(/,/g, ';');
            const ref = (txn.reference_number || '-').replace(/,/g, ';');
            const debit = isDebit ? txn.amount : '';
            const credit = !isDebit ? txn.amount : '';
            const balance = txn.balance_after || 0;

            csv += `${date},${desc},${ref},${debit},${credit},${balance}\n`;
        });

        // Add totals
        csv += `,,TOTALS,${totalDebit},${totalCredit},${account.current_balance || 0}\n`;

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${account.name}_Statement_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) {
        return <div className="p-8 text-center">Loading account statement...</div>;
    }

    if (!account) {
        return <div className="p-8 text-center text-red-600">Account not found!</div>;
    }

    const totalDebit = transactions
        .filter(t => accountType === 'bank' ? t.transaction_type === 'outflow' : t.transaction_type === 'out')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalCredit = transactions
        .filter(t => accountType === 'bank' ? t.transaction_type === 'inflow' : t.transaction_type === 'in')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    return (
        <div className="space-y-3 md:space-y-6 pb-16 md:pb-20">
            {/* Header - Hide on print */}
            <div className="flex justify-between items-start print:hidden">
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-md"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-page-title">{account.name}</h1>
                        <p className="text-gray-500">Account Statement</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        <Printer size={18} />
                        Print
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-green-700"
                    >
                        <FileSpreadsheet size={18} />
                        Export Excel
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        <Download size={18} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filters - Hide on print */}
            <div className="bg-white rounded-md border p-4 print:hidden">
                <div className="flex items-center gap-2 md:gap-4">
                    <Calendar size={18} className="text-gray-400" />
                    <div className="flex gap-2 md:gap-4 flex-1">
                        <div>
                            <label className="text-sm text-gray-600">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="ml-2 px-3 py-1 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="ml-2 px-3 py-1 border rounded-md"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-sm text-foreground hover:text-foreground"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Statement */}
            <div className="bg-white rounded-md border print:">
                {/* Statement Header - Shows on print */}
                <div className="p-4 border-b">
                    <div className="text-center mb-4">
                        <h2 className="text-page-title">{account.name} - Statement</h2>
                        {accountType === 'bank' && account.account_number && (
                            <p className="text-sm text-gray-600">Account: {account.account_number}</p>
                        )}
                        {accountType === 'cash' && account.location && (
                            <p className="text-sm text-gray-600">Location: {account.location}</p>
                        )}
                        {(startDate || endDate) && (
                            <p className="text-sm text-gray-600 mt-1">
                                Period: {startDate || 'Beginning'} to {endDate || 'Now'}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <div>
                            <span className="text-gray-600">Opening Balance:</span>
                            <span className="ml-2 font-bold">₹{(account.opening_balance || 0).toLocaleString()}</span>
                            {account.opening_balance_date && (
                                <span className="ml-1 text-xs text-gray-400">
                                    (as on {new Date(account.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="text-gray-600">Current Balance:</span>
                            <span className={`ml-2 font-bold ${(account.current_balance || 0) < 0 ? 'text-red-600' : ''}`}>₹{(account.current_balance || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                                <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase">Debit</th>
                                <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase">Credit</th>
                                <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        No transactions found for this period
                                    </td>
                                </tr>
                            ) : (
                                (() => {
                                    // Sort ascending for running balance calculation
                                    const sorted = [...transactions].sort((a, b) => {
                                        const dateCompare = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
                                        if (dateCompare !== 0) return dateCompare;
                                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                                    });
                                    
                                    // Compute running balances
                                    let runningBalance = account.opening_balance || 0;
                                    const balanceMap = new Map<string, number>();
                                    sorted.forEach((txn) => {
                                        const isDebit = accountType === 'bank'
                                            ? txn.transaction_type === 'outflow'
                                            : txn.transaction_type === 'out';
                                        if (isDebit) {
                                            runningBalance -= (txn.amount || 0);
                                        } else {
                                            runningBalance += (txn.amount || 0);
                                        }
                                        balanceMap.set(txn.id, runningBalance);
                                    });

                                    // Display in descending order (newest first)
                                    return transactions.map((txn) => {
                                        const isDebit = accountType === 'bank'
                                            ? txn.transaction_type === 'outflow'
                                            : txn.transaction_type === 'out';
                                        const balance = txn.balance_after != null ? txn.balance_after : (balanceMap.get(txn.id) || 0);

                                        return (
                                            <tr key={txn.id} className="hover:bg-gray-50">
                                                <td className="p-3 text-sm">
                                                    {new Date(txn.transaction_date).toLocaleDateString('en-IN')}
                                                </td>
                                                <td className="p-3 text-sm">{txn.description || '-'}</td>
                                                <td className="p-3 text-sm text-gray-500">{txn.reference_number || '-'}</td>
                                                <td className="p-3 text-sm text-right text-red-600 font-medium">
                                                    {isDebit ? `₹${txn.amount?.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="p-3 text-sm text-right text-green-700 font-medium">
                                                    {!isDebit ? `₹${txn.amount?.toLocaleString()}` : '-'}
                                                </td>
                                                <td className={`p-3 text-sm text-right font-bold ${balance < 0 ? 'text-red-600' : ''}`}>
                                                    ₹{balance.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()
                            )}
                        </tbody>
                        {transactions.length > 0 && (
                            <tfoot className="bg-gray-50 border-t-2">
                                <tr>
                                    <td colSpan={3} className="p-3 text-sm font-bold">TOTALS</td>
                                    <td className="p-3 text-sm text-right font-bold text-red-600">
                                        ₹{totalDebit.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-sm text-right font-bold text-gray-900">
                                        ₹{totalCredit.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-sm text-right font-bold">
                                        ₹{(account.current_balance || 0).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
