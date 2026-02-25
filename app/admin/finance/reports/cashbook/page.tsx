'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Download, Printer, Calendar, FileSpreadsheet, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function CashBookPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [transactionType, setTransactionType] = useState<'all' | 'in' | 'out'>('all');

    useEffect(() => {
        loadCashAccounts();
    }, []);

    useEffect(() => {
        if (cashAccounts.length > 0) {
            loadTransactions();
        }
    }, [selectedAccount, startDate, endDate, transactionType, cashAccounts]);

    const loadCashAccounts = async () => {
        const { data } = await supabase
            .from('cash_accounts')
            .select('*')
            .eq('is_active', true)
            .order('name');

        setCashAccounts(data || []);
    };

    const loadTransactions = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('cash_transactions')
                .select('*, cash_accounts(name)')
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (selectedAccount !== 'all') {
                query = query.eq('cash_account_id', selectedAccount);
            }

            if (startDate) query = query.gte('transaction_date', startDate);
            if (endDate) query = query.lte('transaction_date', endDate);
            if (transactionType !== 'all') query = query.eq('transaction_type', transactionType);

            const { data } = await query;
            setTransactions(data || []);
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalCashIn = transactions
        .filter(t => t.transaction_type === 'in')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalCashOut = transactions
        .filter(t => t.transaction_type === 'out')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netCash = totalCashIn - totalCashOut;

    const currentCashBalance = selectedAccount === 'all'
        ? cashAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0)
        : cashAccounts.find(acc => acc.id === selectedAccount)?.current_balance || 0;

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        const exportData = transactions.map((txn) => ({
            'Date': new Date(txn.transaction_date).toLocaleDateString('en-IN'),
            'Account': txn.cash_accounts?.name || '-',
            'Description': txn.description || '-',
            'Reference': txn.reference || '-',
            'Category': txn.category || '-',
            'Cash In': txn.transaction_type === 'in' ? txn.amount : '',
            'Cash Out': txn.transaction_type === 'out' ? txn.amount : '',
            'Balance': txn.balance_after || 0
        }));

        // Add summary row
        exportData.push({
            'Date': '',
            'Account': '',
            'Description': '',
            'Reference': '',
            'Category': 'TOTALS',
            'Cash In': totalCashIn,
            'Cash Out': totalCashOut,
            'Balance': currentCashBalance
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();

        ws['!cols'] = [
            { wch: 12 }, // Date
            { wch: 20 }, // Account
            { wch: 30 }, // Description
            { wch: 15 }, // Reference
            { wch: 15 }, // Category
            { wch: 12 }, // Cash In
            { wch: 12 }, // Cash Out
            { wch: 12 }  // Balance
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Cash Book');

        const filename = `Cash_Book_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    const handleExportCSV = () => {
        let csv = 'Date,Account,Description,Reference,Category,Cash In,Cash Out,Balance\n';

        transactions.forEach((txn) => {
            const date = new Date(txn.transaction_date).toLocaleDateString('en-IN');
            const account = txn.cash_accounts?.name || '-';
            const desc = (txn.description || '-').replace(/,/g, ';');
            const ref = (txn.reference || '-').replace(/,/g, ';');
            const category = (txn.category || '-').replace(/,/g, ';');
            const cashIn = txn.transaction_type === 'in' ? txn.amount : '';
            const cashOut = txn.transaction_type === 'out' ? txn.amount : '';
            const balance = txn.balance_after || 0;

            csv += `${date},${account},${desc},${ref},${category},${cashIn},${cashOut},${balance}\n`;
        });

        csv += `,,,TOTALS,${totalCashIn},${totalCashOut},${currentCashBalance}\n`;

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Cash_Book_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-2 md:space-y-6 pb-16 md:pb-20">
            {/* Header - Responsive - Hide on print */}
            <div className="flex flex-col gap-3 print:hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-md flex-shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-page-title truncate">Cash Book Report</h1>
                        <p className="text-sm md:text-base text-gray-500 line-clamp-1">All cash movements across accounts</p>
                    </div>
                </div>

                {/* Action Buttons - Stack on mobile */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-2 border rounded-md hover:bg-gray-50 text-sm font-medium whitespace-nowrap"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export Excel
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-2 border rounded-md hover:bg-gray-50 text-sm font-medium whitespace-nowrap"
                    >
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                </div>
            </div>

            {/* Summary Cards - Responsive grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 md:p-4 border border-border">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <Wallet className="w-4 h-4 text-foreground flex-shrink-0" />
                        <p className="text-xs md:text-sm font-medium text-foreground truncate">Current Balance</p>
                    </div>
                    <p className="text-lg md:text-page-title text-foreground truncate">₹{currentCashBalance.toLocaleString()}</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 md:p-4 border border-green-200">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <TrendingDown className="w-4 h-4 text-gray-900 flex-shrink-0" />
                        <p className="text-xs md:text-sm font-medium text-green-900 truncate">Total Cash In</p>
                    </div>
                    <p className="text-lg md:text-page-title text-green-900 truncate">₹{totalCashIn.toLocaleString()}</p>
                    <p className="text-xs text-gray-900 mt-1 truncate">{transactions.filter(t => t.transaction_type === 'in').length} txns</p>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 md:p-4 border border-red-200">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <TrendingUp className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs md:text-sm font-medium text-red-900 truncate">Total Cash Out</p>
                    </div>
                    <p className="text-lg md:text-page-title text-red-900 truncate">₹{totalCashOut.toLocaleString()}</p>
                    <p className="text-xs text-red-700 mt-1 truncate">{transactions.filter(t => t.transaction_type === 'out').length} txns</p>
                </div>

                <div className={`bg-gradient-to-br rounded-lg p-3 md:p-4 border ${netCash >= 0 ? 'bg-gray-900 border-gray-300' : 'from-orange-50 to-orange-100 border-orange-200'}`}>
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <TrendingUp className={`w-4 h-4 flex-shrink-0 ${netCash >= 0 ? 'text-primary' : 'text-orange-600'}`} />
                        <p className={`text-xs md:text-sm font-medium truncate ${netCash >= 0 ? 'text-gray-900' : 'text-orange-900'}`}>Net Change</p>
                    </div>
                    <p className={`text-lg md:text-page-title truncate ${netCash >= 0 ? 'text-gray-900' : 'text-orange-900'}`}>
                        {netCash >= 0 ? '+' : ''}₹{netCash.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Filters - Responsive - Hide on print */}
            <div className="bg-white rounded-lg border p-4 print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div>
                        <label className="text-xs md:text-sm text-gray-600 mb-1 block">Cash Account</label>
                        <select
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-md text-sm"
                        >
                            <option value="all">All Accounts</option>
                            {cashAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs md:text-sm text-gray-600 mb-1 block">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-md text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-xs md:text-sm text-gray-600 mb-1 block">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-md text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-xs md:text-sm text-gray-600 mb-1 block">Transaction Type</label>
                        <select
                            value={transactionType}
                            onChange={(e) => setTransactionType(e.target.value as any)}
                            className="w-full px-3 py-2.5 border rounded-md text-sm"
                        >
                            <option value="all">All</option>
                            <option value="in">Cash In Only</option>
                            <option value="out">Cash Out Only</option>
                        </select>
                    </div>
                </div>

                {(startDate || endDate || selectedAccount !== 'all' || transactionType !== 'all') && (
                    <button
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setSelectedAccount('all');
                            setTransactionType('all');
                        }}
                        className="text-sm text-foreground hover:text-foreground mt-3"
                    >
                        Clear all filters
                    </button>
                )}
            </div>

            {/* Cash Book Table - Horizontal scroll on mobile */}
            <div className="bg-white rounded-lg border print: overflow-hidden">
                <div className="p-4 md:p-4 border-b print:text-center">
                    <h2 className="text-lg md:text-page-title">Cash Book</h2>
                    {(startDate || endDate) && (
                        <p className="text-xs md:text-sm text-gray-600 mt-1">
                            Period: {startDate || 'Beginning'} to {endDate || 'Now'}
                        </p>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Account</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                                <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase">Cash In</th>
                                <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase">Cash Out</th>
                                <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-400">
                                        Loading transactions...
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-400">
                                        No transactions found for this period
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => (
                                    <tr key={txn.id} className="hover:bg-gray-50">
                                        <td className="p-3 text-sm">
                                            {new Date(txn.transaction_date).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="p-3 text-sm">{txn.cash_accounts?.name || '-'}</td>
                                        <td className="p-3 text-sm">{txn.description || '-'}</td>
                                        <td className="p-3 text-sm text-gray-500">{txn.reference || '-'}</td>
                                        <td className="p-3 text-sm">
                                            {txn.category && (
                                                <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                    {txn.category}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-sm text-right text-gray-900 font-medium">
                                            {txn.transaction_type === 'in' ? `₹${txn.amount?.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-3 text-sm text-right text-red-600 font-medium">
                                            {txn.transaction_type === 'out' ? `₹${txn.amount?.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-3 text-sm text-right font-bold">
                                            ₹{(txn.balance_after || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {transactions.length > 0 && (
                            <tfoot className="bg-gray-50 border-t-2">
                                <tr>
                                    <td colSpan={5} className="p-3 text-sm font-bold">TOTALS</td>
                                    <td className="p-3 text-sm text-right font-bold text-gray-900">
                                        ₹{totalCashIn.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-sm text-right font-bold text-red-600">
                                        ₹{totalCashOut.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-sm text-right font-bold">
                                        ₹{currentCashBalance.toLocaleString()}
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
