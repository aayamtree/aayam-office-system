'use client';

import React, { useState, useMemo } from 'react';
import { toast } from '@/lib/toast';
import {
    Building2, Upload, RefreshCw, CheckCircle,
    AlertTriangle, Search, Plus, Trash2, ArrowUpRight, ArrowDownLeft,
    Eye, EyeOff, ClipboardCopy, Edit3, Tag, Settings2, Star, Pencil, X
} from 'lucide-react';
import {
    useBankTransactions, usePaymentsReceived,
    useExpenses, useBankAccounts
} from '@/lib/hooks';
import { BankTransaction } from '@/types/database';
import { CategoryModal } from '@/components/banking/CategoryModal';
import { useExpenseCategories, useIncomeCategories } from '@/lib/categorization-hooks';
import { useTransactionCategorization } from '@/lib/categorization-hooks';
import { useConfirm } from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabase';

export default function BankingPage() {
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const confirm = useConfirm();
    const {
        bankAccounts, loading: loadingAccounts, error: errorAccounts,
        createBankAccount, updateBankAccount, deleteBankAccount, setDefaultAccount
    } = useBankAccounts();

    // ── Manage Accounts modal state ──
    const [showManageModal, setShowManageModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null); // null = add new
    const [showAccountForm, setShowAccountForm] = useState(false);
    type AccType = 'current' | 'savings' | 'od' | 'cc' | 'cash';
    const [accountForm, setAccountForm] = useState<{ name: string; bank_name: string; account_number: string; ifsc_code: string; account_type: AccType; opening_balance: number; opening_balance_date: string }>({
        name: '', bank_name: '', account_number: '', ifsc_code: '', account_type: 'current', opening_balance: 0, opening_balance_date: new Date().toISOString().split('T')[0]
    });
    const [savingAccount, setSavingAccount] = useState(false);

    const isCash = (type: string) => type === 'cash';

    const openAddForm = () => {
        setEditingAccount(null);
        setAccountForm({ name: '', bank_name: '', account_number: '', ifsc_code: '', account_type: 'current', opening_balance: 0, opening_balance_date: new Date().toISOString().split('T')[0] });
        setShowAccountForm(true);
    };
    const openEditForm = (acc: any) => {
        setEditingAccount(acc);
        setAccountForm({ name: acc.name || '', bank_name: acc.bank_name || '', account_number: acc.account_number || '', ifsc_code: acc.ifsc_code || '', account_type: (acc.account_type || 'current') as AccType, opening_balance: acc.opening_balance || 0, opening_balance_date: acc.opening_balance_date || '2025-04-01' });
        setShowAccountForm(true);
    };
    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingAccount(true);
        if (editingAccount) {
            const { error } = await updateBankAccount(editingAccount.id, accountForm);
            if (error) toast.error(error); else toast.success('Account updated!');
        } else {
            const { error } = await createBankAccount({ ...accountForm, is_default: bankAccounts.length === 0 } as any);
            if (error) toast.error(error); else toast.success('Account added!');
        }
        setSavingAccount(false);
        setShowAccountForm(false);
    };
    const handleDelete = async (id: string) => {
        const { confirmed } = await confirm({ title: 'Delete Account', message: 'Delete this bank account? All linked transactions will also be removed.', variant: 'danger', confirmLabel: 'Delete' });
        if (!confirmed) return;
        const { error } = await deleteBankAccount(id);
        if (error) toast.error(error); else toast.success('Account deleted.');
    };
    const handleSetDefault = async (id: string) => {
        await setDefaultAccount(id);
        toast.success('Default account updated.');
    };
    const {
        transactions: bankTxns,
        importTransactions,
        deleteTransaction,
        updateTransaction,
        loading: loadingTxns
    } = useBankTransactions(selectedAccountId);

    // System Data
    const { paymentsReceived: payments } = usePaymentsReceived();
    const { expenses: expenseList } = useExpenses();

    // UI State
    const [importText, setImportText] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Categorization State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const { categories: expenseCategories } = useExpenseCategories();
    const { categories: incomeCategories } = useIncomeCategories();

    // ── Vendor + Client name lookup (for badge display) ──
    const [vendorMap, setVendorMap] = React.useState<Record<string, string>>({});
    const [clientMap, setClientMap] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
        supabase.from('vendors').select('id, name').then(({ data }) => {
            if (data) setVendorMap(Object.fromEntries(data.map(v => [v.id, v.name])));
        });
        supabase.from('clients').select('id, name, company').then(({ data }) => {
            if (data) setClientMap(Object.fromEntries(data.map(c => [c.id, c.company || c.name])));
        });
    }, []);

    // Filter State
    const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'verified'>('all');

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
        setErrorMessage('');
        setSuccessMessage('');

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
                const result = await importTransactions(newTxns);
                if (result.error) {
                    setErrorMessage(`Import failed: ${result.error}`);
                } else {
                    // Clear form
                    setImportText('');
                    setShowImportModal(false);
                    // Show success message
                    setSuccessMessage(`✅ Successfully imported ${newTxns.length} transactions!`);
                }
            } else {
                setErrorMessage('Could not parse any transactions. Please check format.');
            }

        } catch (e: any) {
            console.error(e);
            setErrorMessage(`Error: ${e.message || 'Failed to parse data'}`);
        }
        setParsing(false);
    };

    // ------------------------------------------------------------------
    // CATEGORIZATION AND FILTER HELPERS
    // ------------------------------------------------------------------
    const handleCategorize = (txn: any) => {
        setSelectedTransaction(txn);
        setShowCategoryModal(true);
    };

    const handleCategorySuccess = () => {
        setSuccessMessage('✅ Transaction categorized successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    // Uncategorize hook
    const { uncategorizeTransaction } = useTransactionCategorization();
    const handleUncategorize = async (txn: any) => {
        const { confirmed } = await confirm({
            title: 'Remove Categorization',
            message: 'This will reset the transaction to uncategorized. You can re-categorize it later.',
            variant: 'danger',
            confirmLabel: 'Remove'
        });
        if (!confirmed) return;
        const { error } = await uncategorizeTransaction(txn.id);
        if (error) {
            toast.error(`Error: ${error}`);
        } else {
            toast.success('Categorization removed');
        }
    };

    // Get category badge info — color, label, entity name
    const getCategoryBadge = (txn: any): { label: string; entity?: string; isIncome: boolean } | null => {
        if (!txn.is_verified) return null;

        const type = txn.categorization_type || (txn.transaction_type === 'inflow' ? 'income' : 'expense');

        if (type === 'income') {
            const cat = incomeCategories.find((c: any) => c.id === txn.income_category_id);
            const label = cat?.name || 'Payment Received';
            const entity = txn.client_id ? clientMap[txn.client_id] : undefined;
            return { label, entity, isIncome: true };
        } else {
            const cat = expenseCategories.find((c: any) => c.id === txn.expense_category_id);
            const label = cat?.name || 'Payment Made';
            const entity = txn.vendor_id ? vendorMap[txn.vendor_id] : undefined;
            return { label, entity, isIncome: false };
        }
    };

    // Filter transactions by status
    const filteredReconciledData = useMemo(() => {
        if (statusFilter === 'all') return reconciledData;
        if (statusFilter === 'verified') return reconciledData.filter(t => t.is_verified);
        if (statusFilter === 'missing') return reconciledData.filter(t => !t.is_verified && t.status === 'unmatched_bank');
        return reconciledData;
    }, [reconciledData, statusFilter]);

    // Derived: selected account object
    const selectedAccount = bankAccounts.find(b => b.id === selectedAccountId);
    const selectedIsCash = selectedAccount?.account_type === 'cash';

    // ------------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------------
    return (
        <div className="space-y-3 md:space-y-6 animate-fade-in pb-16 md:pb-20">
            {/* Header - Responsive */}
            <div className="flex flex-col gap-3 md:gap-4">
                <div>
                    <h1 className="text-xl md:text-page-title text-gray-900">Bank Reconciliation</h1>
                    <p className="text-sm md:text-base text-gray-500">Sync HDFC Bank with Aayam System</p>
                    {loadingTxns && <span className="text-xs text-primary ml-2">Loading Txns...</span>}
                    {loadingAccounts && <span className="text-xs text-primary ml-2">Loading Accounts...</span>}
                    {errorAccounts && <div className="text-red-500 text-sm mt-1">Error: {errorAccounts}</div>}
                </div>

                {/* Controls - Stack on mobile */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    {bankAccounts.length === 0 && (
                        <span className="text-xs text-red-500 font-medium">
                            No accounts found. Click &quot;Manage Accounts&quot; to add one.
                        </span>
                    )}
                    <select
                        value={selectedAccountId}
                        onChange={e => setSelectedAccountId(e.target.value)}
                        className="flex-1 sm:flex-none px-3 md:px-4 py-2 md:py-2.5 bg-white border rounded-md text-sm"
                    >
                        <option value="">Select Account</option>
                        {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>
                                {b.account_type === 'cash' ? '💵' : '🏦'} {b.name}{b.account_type !== 'cash' && b.account_number ? ` - ${b.account_number}` : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowManageModal(true)}
                        className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 whitespace-nowrap text-sm font-semibold"
                    >
                        <Settings2 className="w-4 h-4" /> Manage Accounts
                    </button>
                    {/* Import Statement only for bank accounts */}
                    {!selectedIsCash && (
                        <button
                            onClick={() => setShowImportModal(true)}
                            disabled={!selectedAccountId}
                            className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap text-sm font-semibold shadow-sm"
                        >
                            <Upload className="w-4 h-4" /> Import Statement
                        </button>
                    )}
                </div>

                {/* Cash account notice */}
                {selectedIsCash && (
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
                        <span className="text-lg leading-none">💵</span>
                        <div>
                            <p className="text-sm font-semibold text-amber-900">Cash Account — Physical Ledger</p>
                            <p className="text-xs text-amber-700 mt-0.5">This is a cash-on-hand account. Bank reconciliation, statement import, and bank reference fields don&apos;t apply to cash. Transactions recorded here represent physical cash movements only.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="bg-white border border-green-200 rounded-md p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-gray-900" />
                        <p className="text-green-800 font-medium">{successMessage}</p>
                    </div>
                    <button
                        onClick={() => setSuccessMessage('')}
                        className="text-gray-900 hover:text-green-800 text-xl"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <p className="text-red-800 font-medium">{errorMessage}</p>
                    </div>
                    <button
                        onClick={() => setErrorMessage('')}
                        className="text-red-600 hover:text-red-800 text-xl"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${statusFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
                        }`}
                >
                    All ({reconciledData.length})
                </button>
                <button
                    onClick={() => setStatusFilter('missing')}
                    className={`px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${statusFilter === 'missing'
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-red-300'
                        }`}
                >
                    Missing ({reconciledData.filter(t => !t.is_verified && t.status === 'unmatched_bank').length})
                </button>
                <button
                    onClick={() => setStatusFilter('verified')}
                    className={`px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${statusFilter === 'verified'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'
                        }`}
                >
                    Verified ({reconciledData.filter(t => t.is_verified).length})
                </button>
            </div>

            {/* Main Stats - Better mobile layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white p-4 md:p-5 rounded-md border border-gray-100">
                    <p className="text-xs md:text-sm text-gray-500">Bank Balance (System)</p>
                    <p className="text-xl md:text-page-title text-gray-900 truncate">₹{(bankAccounts.find(b => b.id === selectedAccountId)?.current_balance || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-md border border-gray-100">
                    <p className="text-xs md:text-sm text-gray-500">Need Categorization</p>
                    <p className="text-xl md:text-page-title text-orange-600">
                        {reconciledData.filter(r => !r.is_verified && r.status === 'unmatched_bank').length}
                    </p>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-md border border-gray-100">
                    <p className="text-xs md:text-sm text-gray-500">Verified</p>
                    <p className="text-xl md:text-page-title text-gray-900">
                        {reconciledData.filter(r => r.is_verified).length}
                    </p>
                </div>
            </div>

            {/* Reconciliation Grid - Responsive table */}
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm min-w-[800px]">
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
                            {filteredReconciledData.map((txn) => (
                                <tr key={txn.id} className={`hover:bg-gray-50 group ${txn.status === 'ignored' ? 'opacity-50 bg-gray-50' : ''}`}>
                                    <td className="px-3 md:px-4 py-3 text-gray-500 whitespace-nowrap text-xs md:text-sm">
                                        {new Date(txn.transaction_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 md:px-4 py-3 min-w-[200px] md:min-w-[300px]">
                                        <div className="text-xs md:text-sm font-medium text-gray-900 break-words">{txn.description}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{txn.reference_number}</div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${txn.transaction_type === 'inflow' ? 'text-gray-900' : 'text-red-600'}`}>
                                        {txn.transaction_type === 'inflow' ? '+' : '-'} ₹{txn.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {txn.is_verified ? (
                                            <div className="flex flex-col items-center gap-1">
                                                {(() => {
                                                    const badge = getCategoryBadge(txn);
                                                    if (!badge) return null;
                                                    return (
                                                        <>
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${badge.isIncome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                                                                <Tag className="w-2.5 h-2.5" />
                                                                {badge.label}
                                                            </span>
                                                            {badge.entity && (
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${badge.isIncome ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                                    {badge.entity}
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        ) : txn.status === 'matched' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-foreground rounded-md text-label">
                                                <CheckCircle className="w-3 h-3" /> Matched
                                            </span>
                                        ) : txn.status === 'ignored' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-600 rounded-md text-label">
                                                <EyeOff className="w-3 h-3" /> Ignored
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-label">
                                                <AlertTriangle className="w-3 h-3" /> Missing
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
                                            {/* Categorize / Edit Button */}
                                            {txn.status !== 'ignored' && (
                                                <button
                                                    onClick={() => handleCategorize(txn)}
                                                    className={`p-1.5 rounded-md transition-colors ${
                                                        txn.is_verified
                                                            ? 'hover:bg-blue-50 text-blue-500 hover:text-blue-700'
                                                            : 'hover:bg-gray-900 text-gray-600 hover:text-primary'
                                                    }`}
                                                    title={txn.is_verified ? 'Edit Categorization' : 'Categorize Transaction'}
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            )}

                                            {/* Uncategorize button - only for verified */}
                                            {txn.is_verified && (
                                                <button
                                                    onClick={() => handleUncategorize(txn)}
                                                    className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-orange-500 rounded-md transition-colors"
                                                    title="Remove categorization"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}

                                            {/* Toggle Ignore */}
                                            {txn.status === 'ignored' ? (
                                                <button
                                                    onClick={() => updateTransaction(txn.id, { reference_type: null })}
                                                    className="p-1.5 hover:bg-muted text-gray-400 hover:text-foreground rounded-md transition-colors"
                                                    title="Un-ignore (Track again)"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => updateTransaction(txn.id, { reference_type: 'ignored' })}
                                                    className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                                                    title="Ignore (Don't track)"
                                                >
                                                    <EyeOff className="w-4 h-4" />
                                                </button>
                                            )}

                                            {/* Delete */}
                                            <button
                                                onClick={() => deleteTransaction(txn.id)}
                                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                                                title="Delete Permanently"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredReconciledData.length === 0 && reconciledData.length > 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400 italic">
                                        No transactions match your filter.
                                    </td>
                                </tr>
                            )}
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
                    <div className="bg-white rounded-md w-full max-w-2xl  animate-scale-in">
                        <div className="p-5 border-b flex justify-between">
                            <h2 className="text-section">Import HDFC Statement</h2>
                            <button onClick={() => setShowImportModal(false)} className="text-gray-500 hover:text-black">✕</button>
                        </div>
                        <div className="p-5">
                            <div className="bg-muted p-4 rounded-md text-sm text-foreground mb-4">
                                <strong>Instructions:</strong> Open your Bank Statement in Excel. Copy the rows (Date, Description, Ref, Value Date, Withdrawal, Deposit) and paste them below.
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500">Paste your Excel data below (Date, Desc, Ref, Amount...)</span>
                                <button
                                    onClick={async () => {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            setImportText(text);
                                        } catch (err) {
                                            toast.info('Clipboard access denied. Please use Ctrl+V / Cmd+V to paste manually.');
                                        }
                                    }}
                                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                                >
                                    <ClipboardCopy className="w-3 h-3" /> Paste from Clipboard
                                </button>
                            </div>
                            <textarea
                                className="w-full h-60 p-4 border rounded-md font-mono text-xs bg-gray-50 focus:ring-2 ring-primary outline-none"
                                placeholder={`Paste Excel Content here...\nExample:\n17/10/25\tMBALAL KUNDHANI...\t0000529...\t17/10/25\t0\t30,356.00\t188,201.00`}
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                            />
                            <div className="mt-4 flex gap-3 justify-end">
                                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
                                <button
                                    onClick={handleParse}
                                    disabled={!importText || parsing}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 font-semibold shadow-sm"
                                >
                                    {parsing ? 'Parsing...' : 'Process & Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {showCategoryModal && selectedTransaction && (
                <CategoryModal
                    transaction={selectedTransaction}
                    onClose={() => {
                        setShowCategoryModal(false);
                        setSelectedTransaction(null);
                    }}
                    onSuccess={handleCategorySuccess}
                />
            )}

            {/* ── Manage Accounts Modal ── */}
            {showManageModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center shrink-0">
                            <h2 className="font-semibold text-gray-900">Manage Bank Accounts</h2>
                            <button onClick={() => { setShowManageModal(false); setShowAccountForm(false); }} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {/* Account list */}
                            {bankAccounts.map(acc => (
                                <div key={acc.id} className={`border rounded-md p-3 flex items-center gap-3 ${acc.account_type === 'cash' ? 'border-amber-100 bg-amber-50/40' : 'border-gray-200'}`}>
                                    <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 text-base ${acc.account_type === 'cash' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                        {acc.account_type === 'cash' ? '💵' : <Building2 className="w-4 h-4 text-gray-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{acc.name}</p>
                                            {acc.is_default && <span className="text-xs px-1.5 py-0.5 bg-[#B8860B]/10 text-[#B8860B] rounded font-medium">Default</span>}
                                            {acc.account_type === 'cash' && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">Cash</span>}
                                        </div>
                                        {acc.account_type === 'cash'
                                            ? <p className="text-xs text-amber-700">Physical Ledger · No bank data</p>
                                            : <p className="text-xs text-gray-500">{acc.bank_name && `${acc.bank_name} · `}{acc.account_number}</p>
                                        }
                                        <p className="text-xs text-gray-400">Balance: ₹{(acc.current_balance || 0).toLocaleString()}{acc.opening_balance_date ? ` · OB: ${new Date(acc.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!acc.is_default && (
                                            <button onClick={() => handleSetDefault(acc.id)} title="Set as default" className="p-1.5 text-gray-400 hover:text-[#B8860B] rounded">
                                                <Star className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={() => openEditForm(acc)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(acc.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {bankAccounts.length === 0 && (
                                <p className="text-center text-sm text-gray-400 py-4">No accounts yet. Add a bank or cash account below.</p>
                            )}

                            {/* Add / Edit form */}
                            {showAccountForm ? (
                                <form onSubmit={handleSaveAccount} className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
                                    <p className="text-sm font-semibold text-gray-900">{editingAccount ? 'Edit Account' : 'Add New Account'}</p>

                                    {/* Account category selector — only shown when adding new */}
                                    {!editingAccount && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Account Category *</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setAccountForm(p => ({ ...p, account_type: 'current', bank_name: '', account_number: '', ifsc_code: '' }))}
                                                    className={`py-2.5 rounded-md border text-xs font-semibold transition-colors ${!isCash(accountForm.account_type) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
                                                >
                                                    🏦 Bank Account
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAccountForm(p => ({ ...p, account_type: 'cash', bank_name: '', account_number: '', ifsc_code: '' }))}
                                                    className={`py-2.5 rounded-md border text-xs font-semibold transition-colors ${isCash(accountForm.account_type) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
                                                >
                                                    💵 Cash Account
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cash info notice */}
                                    {isCash(accountForm.account_type) && (
                                        <div className="bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                                            <p className="text-xs text-amber-800">
                                                <strong>Cash Account</strong> — represents physical money on hand. No bank details required. Bank reconciliation and statement import are not applicable.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Name — always shown */}
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Display Name *</label>
                                            <input required value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))}
                                                placeholder={isCash(accountForm.account_type) ? 'e.g. Office Cash, Petty Cash' : 'e.g. HDFC Current'}
                                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]" />
                                        </div>

                                        {/* Bank-only fields */}
                                        {!isCash(accountForm.account_type) && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name *</label>
                                                    <input required value={accountForm.bank_name} onChange={e => setAccountForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="HDFC Bank" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
                                                    <select value={accountForm.account_type} onChange={e => setAccountForm(p => ({ ...p, account_type: e.target.value as 'current' | 'savings' | 'od' | 'cc' }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]">
                                                        <option value="current">Current</option>
                                                        <option value="savings">Savings</option>
                                                        <option value="od">OD / Overdraft</option>
                                                        <option value="cc">Cash Credit</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Account Number *</label>
                                                    <input required value={accountForm.account_number} onChange={e => setAccountForm(p => ({ ...p, account_number: e.target.value }))} placeholder="01234567890" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-[#B8860B]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">IFSC Code</label>
                                                    <input value={accountForm.ifsc_code} onChange={e => setAccountForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))} placeholder="HDFC0001234" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-[#B8860B]" />
                                                </div>
                                            </>
                                        )}

                                        {/* Opening Balance — shown only when adding new */}
                                        {/* Opening Balance — shown only when adding new */}
                                        {!editingAccount && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        {isCash(accountForm.account_type) ? 'Cash in Hand (₹)' : 'Opening Balance (₹)'}
                                                    </label>
                                                    <input type="number" value={accountForm.opening_balance} onChange={e => setAccountForm(p => ({ ...p, opening_balance: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Opening Balance Date</label>
                                                    <input type="date" value={accountForm.opening_balance_date} onChange={e => setAccountForm(p => ({ ...p, opening_balance_date: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]" />
                                                </div>
                                            </>
                                        )}
                                        {/* Opening Balance Date — editable when editing */}
                                        {editingAccount && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Opening Balance Date</label>
                                                <input type="date" value={accountForm.opening_balance_date} onChange={e => setAccountForm(p => ({ ...p, opening_balance_date: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button type="button" onClick={() => setShowAccountForm(false)} className="flex-1 py-2 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                                        <button type="submit" disabled={savingAccount} className="flex-1 py-2 bg-[#B8860B] text-white rounded-md text-sm font-semibold disabled:opacity-60">
                                            {savingAccount ? 'Saving…' : editingAccount ? 'Update' : 'Add Account'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button onClick={openAddForm} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-[#B8860B] hover:text-[#B8860B] transition-colors">
                                    <Plus className="w-4 h-4" /> Add New Account
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
