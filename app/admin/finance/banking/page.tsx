'use client';

import React, { useState, useMemo } from 'react';
import {
    Building2, Upload, RefreshCw, CheckCircle,
    AlertTriangle, Search, Plus, Trash2, ArrowUpRight, ArrowDownLeft,
    Eye, EyeOff
} from 'lucide-react';
import {
    useBankTransactions, usePaymentsReceived,
    useExpenses, useBankAccounts
} from '@/lib/hooks';
import { BankTransaction } from '@/types/database';

export default function BankingPage() {
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const { bankAccounts } = useBankAccounts();
    const {
        transactions: bankTxns,
        importTransactions,
        deleteTransaction,
        updateTransaction,
        loading: loadingTxns
    } = useBankTransactions(selectedAccountId);

    // System Data
    const { payments } = usePaymentsReceived();
    const { expenses: expenseList } = useExpenses();

    // UI State
    const [importText, setImportText] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [parsing, setParsing] = useState(false);

    // Auto-select first account
    React.useEffect(() => {
        if (!selectedAccountId && bankAccounts.length > 0) {
            const defaultAcc = bankAccounts.find(b => b.is_default) || bankAccounts[0];
            setSelectedAccountId(defaultAcc.id);
        }
    }, [bankAccounts, selectedAccountId]);

    // ------------------------------------------------------------------
    // RECONCILIATION LOGIC
    // ------------------------------------------------------------------
    const reconciledData = useMemo(() => {
        if (!bankTxns) return [];

        return bankTxns.map(txn => {
            let match = null;
            let status: 'matched' | 'unmatched_bank' | 'ignored' | 'potential' = 'unmatched_bank';

            if (txn.reference_type === 'ignored') {
                status = 'ignored';
            } else {
                // 1. Try to match CREDITS (Inflow) with PaymentsReceived
                if (txn.transaction_type === 'inflow') {
                    const found = payments.find(p => {
                        if (!p.amount) return false;
                        // Exact amount match
                        const amountMatch = Math.abs(p.amount - txn.amount) < 1;
                        // Date match (+/- 3 days)
                        const dateDiff = Math.abs(new Date(p.payment_date).getTime() - new Date(txn.transaction_date).getTime()) / (1000 * 3600 * 24);
                        return amountMatch && dateDiff <= 3;
                    });
                    if (found) {
                        match = { type: 'payment', ref: found };
                        status = 'matched';
                    }
                }
                // 2. Try to match DEBITS could go here in future
            }

            return { ...txn, match, status };
        });
    }, [bankTxns, payments]);

    // ------------------------------------------------------------------
    // PARSE LOGIC (HDFC / Generic CSV)
    // ------------------------------------------------------------------
    const handleParse = async () => {
        setParsing(true);
        try {
            const rows = importText.split('\n').filter(r => r.trim());
            const newTxns: any[] = [];

            // Simple Heuristic Parser for Tab/Comma separated
            rows.forEach(row => {
                const cols = row.includes('\t') ? row.split('\t') : row.split(',');
                if (cols.length < 5) return;

                // Extract Date
                const dateStr = cols[0].trim(); // 17/10/25
                if (!dateStr.match(/\d{2}\/\d{2}\/\d{2,4}/)) return;

                // Parse Date
                const [d, m, y] = dateStr.split('/');
                const fullYear = y.length === 2 ? `20${y}` : y;
                const isoDate = `${fullYear}-${m}-${d}`;

                // Narration
                const desc = cols[1]?.trim();
                const ref = cols[2]?.trim();

                const debitStr = cols[4]?.replace(/,/g, '').trim();
                const creditStr = cols[5]?.replace(/,/g, '').trim();

                const debit = parseFloat(debitStr) || 0;
                const credit = parseFloat(creditStr) || 0;

                if (debit > 0) {
                    newTxns.push({
                        bank_account_id: selectedAccountId,
                        transaction_date: isoDate,
                        transaction_type: 'outflow',
                        amount: debit,
                        description: desc,
                        reference_number: ref
                    });
                } else if (credit > 0) {
                    newTxns.push({
                        bank_account_id: selectedAccountId,
                        transaction_date: isoDate,
                        transaction_type: 'inflow',
                        amount: credit,
                        description: desc,
                        reference_number: ref
                    });
                }
            });

            if (newTxns.length > 0) {
                await importTransactions(newTxns);
                setImportText('');
                setShowImportModal(false);
                alert(`Imported ${newTxns.length} transactions!`);
            } else {
                alert('Could not parse any transactions. Please check format.');
            }

        } catch (e) {
            console.error(e);
            alert('Error parsing data');
        }
        setParsing(false);
    };

    // ------------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------------
    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliation</h1>
                    <p className="text-gray-500">Sync HDFC Bank with Aayam System</p>
                </div>
                <div className="flex gap-2 items-center">
                    {bankAccounts.length === 0 && (
                        <span className="text-xs text-red-500 font-medium mr-2">
                            No accounts found. <a href="/admin/finance/banks" className="underline">Add one here</a>
                        </span>
                    )}
                    <select
                        value={selectedAccountId}
                        onChange={e => setSelectedAccountId(e.target.value)}
                        className="px-4 py-2 bg-white border rounded-xl"
                    >
                        <option value="">Select Account</option>
                        {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name} - {b.account_number}</option>)}
                    </select>
                    <button
                        onClick={() => setShowImportModal(true)}
                        disabled={!selectedAccountId}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Upload size={18} /> Import Statement
                    </button>
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Bank Balance (System)</p>
                    <p className="text-2xl font-bold text-gray-900">₹{(bankAccounts.find(b => b.id === selectedAccountId)?.current_balance || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Action Required</p>
                    <p className="text-2xl font-bold text-orange-600">
                        {reconciledData.filter(r => r.status === 'unmatched_bank').length}
                    </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Verified</p>
                    <p className="text-2xl font-bold text-green-600">
                        {reconciledData.filter(r => r.status === 'matched').length}
                    </p>
                </div>
            </div>

            {/* Reconciliation Grid */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount</th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600">System Match</th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-600">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {reconciledData.map((txn) => (
                                <tr key={txn.id} className={`hover:bg-gray-50 group ${txn.status === 'ignored' ? 'opacity-50 bg-gray-50' : ''}`}>
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                        {new Date(txn.transaction_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 max-w-xs truncate" title={txn.description}>
                                        {txn.description}
                                        <div className="text-xs text-gray-400">{txn.reference_number}</div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${txn.transaction_type === 'inflow' ? 'text-green-600' : 'text-red-600'}`}>
                                        {txn.transaction_type === 'inflow' ? '+' : '-'} ₹{txn.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {txn.status === 'matched' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                <CheckCircle size={12} /> Matched
                                            </span>
                                        ) : txn.status === 'ignored' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-medium">
                                                <EyeOff size={12} /> Ignored
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                                <AlertTriangle size={12} /> Missing
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {txn.status === 'matched' ? (
                                            <div className="flex flex-col">
                                                <span className="font-medium text-xs">Payment #{txn.match?.ref?.payment_number}</span>
                                                <span className="text-xs text-gray-400">{txn.match?.ref?.payment_date && new Date(txn.match.ref.payment_date).toLocaleDateString()}</span>
                                            </div>
                                        ) : txn.status === 'ignored' ? (
                                            <span className="text-gray-400 italic text-xs">Marked as ignored</span>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">No matching system entry</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {/* Toggle Ignore */}
                                            {txn.status === 'ignored' ? (
                                                <button
                                                    onClick={() => updateTransaction(txn.id, { reference_type: null })}
                                                    className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded-lg transition-colors"
                                                    title="Un-ignore (Track again)"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => updateTransaction(txn.id, { reference_type: 'ignored' })}
                                                    className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                                                    title="Ignore (Don't track)"
                                                >
                                                    <EyeOff size={16} />
                                                </button>
                                            )}

                                            {/* Delete */}
                                            <button
                                                onClick={() => deleteTransaction(txn.id)}
                                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                                title="Delete Permanently"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reconciledData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400 italic">
                                        No bank transactions found. Import a statement to begin.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-scale-in">
                        <div className="p-5 border-b flex justify-between">
                            <h2 className="text-lg font-bold">Import HDFC Statement</h2>
                            <button onClick={() => setShowImportModal(false)} className="text-gray-500 hover:text-black">✕</button>
                        </div>
                        <div className="p-5">
                            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 mb-4">
                                <strong>Instructions:</strong> Open your Bank Statement in Excel. Copy the rows (Date, Description, Ref, Value Date, Withdrawal, Deposit) and paste them below.
                            </div>
                            <textarea
                                className="w-full h-60 p-4 border rounded-xl font-mono text-xs bg-gray-50 focus:ring-2 ring-indigo-500 outline-none"
                                placeholder={`Paste Excel Content here...\nExample:\n17/10/25\tMBALAL KUNDHANI...\t0000529...\t17/10/25\t0\t30,356.00\t188,201.00`}
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                            />
                            <div className="mt-4 flex gap-3 justify-end">
                                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button
                                    onClick={handleParse}
                                    disabled={!importText || parsing}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {parsing ? 'Parsing...' : 'Process & Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
