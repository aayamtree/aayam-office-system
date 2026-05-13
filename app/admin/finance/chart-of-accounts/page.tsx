'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
    BookOpen, TrendingUp, TrendingDown, Landmark, Wallet,
    ChevronDown, ChevronRight, Plus, Search, ArrowUpDown,
    DollarSign, PiggyBank, Building2, Receipt, BarChart3, X
} from 'lucide-react';

interface COAAccount {
    id: string;
    code: string;
    name: string;
    account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    parent_id: string | null;
    linked_bank_account_id: string | null;
    linked_cash_account_id: string | null;
    linked_expense_category_id: string | null;
    linked_income_category_id: string | null;
    opening_balance: number;
    current_balance: number;
    is_active: boolean;
    description: string | null;
    created_at: string;
}

const ACCOUNT_TYPE_META: Record<string, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
    asset: { label: 'Assets', icon: Landmark, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    liability: { label: 'Liabilities', icon: Receipt, color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    equity: { label: 'Equity', icon: PiggyBank, color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    income: { label: 'Income', icon: TrendingUp, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    expense: { label: 'Expenses', icon: TrendingDown, color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
};

export default function ChartOfAccountsPage() {
    const [accounts, setAccounts] = useState<COAAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['asset', 'liability', 'equity', 'income', 'expense']));
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedLedger, setSelectedLedger] = useState<COAAccount | null>(null);
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(false);

    // New account form
    const [newAccount, setNewAccount] = useState({
        code: '', name: '', account_type: 'expense' as string, description: ''
    });
    const [savingAccount, setSavingAccount] = useState(false);

    const fetchAccounts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('chart_of_accounts')
            .select('*')
            .eq('is_active', true)
            .order('code', { ascending: true });

        if (error) {
            toast.error('Failed to load Chart of Accounts');
            console.error(error);
        } else {
            setAccounts(data || []);
        }
        setLoading(false);
    };

    useEffect(() => { fetchAccounts(); }, []);

    // Group accounts by type
    const groupedAccounts = useMemo(() => {
        const filtered = searchQuery
            ? accounts.filter(a =>
                a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.code.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : accounts;

        const groups: Record<string, COAAccount[]> = {
            asset: [], liability: [], equity: [], income: [], expense: []
        };

        filtered.forEach(acc => {
            if (groups[acc.account_type]) {
                groups[acc.account_type].push(acc);
            }
        });

        return groups;
    }, [accounts, searchQuery]);

    // Trial balance
    const trialBalance = useMemo(() => {
        let totalDebits = 0;
        let totalCredits = 0;

        accounts.forEach(acc => {
            const bal = acc.current_balance || 0;
            if (acc.account_type === 'asset' || acc.account_type === 'expense') {
                if (bal >= 0) totalDebits += bal;
                else totalCredits += Math.abs(bal);
            } else {
                // liability, equity, income have natural credit balances
                if (bal >= 0) totalCredits += bal;
                else totalDebits += Math.abs(bal);
            }
        });

        return { totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 };
    }, [accounts]);

    const toggleType = (type: string) => {
        const next = new Set(expandedTypes);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        setExpandedTypes(next);
    };

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingAccount(true);
        try {
            const { error } = await supabase
                .from('chart_of_accounts')
                .insert([{
                    code: newAccount.code.trim(),
                    name: newAccount.name.trim(),
                    account_type: newAccount.account_type,
                    description: newAccount.description.trim() || null,
                }]);

            if (error) throw error;
            toast.success('Account created!');
            setShowAddModal(false);
            setNewAccount({ code: '', name: '', account_type: 'expense', description: '' });
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.message || 'Failed to create account');
        }
        setSavingAccount(false);
    };

    // View ledger for an account
    const openLedger = async (account: COAAccount) => {
        setSelectedLedger(account);
        setLoadingLedger(true);
        setLedgerEntries([]);

        const { data, error } = await supabase
            .from('journal_entry_lines')
            .select('*, journal_entry:journal_entries(id, entry_number, entry_date, description, source_type)')
            .eq('account_id', account.id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (!error && data) {
            setLedgerEntries(data);
        }
        setLoadingLedger(false);
    };

    // Format balance with sign
    const formatBalance = (amount: number, accountType: string) => {
        const abs = Math.abs(amount);
        const formatted = `₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

        // Natural balance direction
        if (accountType === 'asset' || accountType === 'expense') {
            return amount >= 0 ? formatted : `-${formatted}`;
        } else {
            return amount >= 0 ? formatted : `-${formatted}`;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-16 md:pb-20">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl md:text-page-title text-gray-900 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-gray-600" />
                        Chart of Accounts
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {accounts.length} accounts · Double-entry accounting ledger
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm font-semibold shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Account
                    </button>
                </div>
            </div>

            {/* Trial Balance Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white p-4 md:p-5 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Debits</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">
                        ₹{trialBalance.totalDebits.toLocaleString('en-IN')}
                    </p>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Total Credits</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">
                        ₹{trialBalance.totalCredits.toLocaleString('en-IN')}
                    </p>
                </div>
                <div className={`p-4 md:p-5 rounded-md border ${trialBalance.balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Balance Status</p>
                    <p className={`text-xl md:text-2xl font-bold mt-1 ${trialBalance.balanced ? 'text-green-700' : 'text-red-700'}`}>
                        {trialBalance.balanced ? '✓ Balanced' : `Diff: ₹${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toLocaleString()}`}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search accounts by name or code..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-[#B8860B] bg-white"
                />
            </div>

            {/* Accounts by Type */}
            <div className="space-y-3">
                {(['asset', 'liability', 'equity', 'income', 'expense'] as const).map(type => {
                    const meta = ACCOUNT_TYPE_META[type];
                    const accs = groupedAccounts[type] || [];
                    const isExpanded = expandedTypes.has(type);
                    const typeTotal = accs.reduce((sum, a) => sum + (a.current_balance || 0), 0);
                    const Icon = meta.icon;

                    return (
                        <div key={type} className={`bg-white rounded-md border ${meta.borderColor} overflow-hidden`}>
                            {/* Group header */}
                            <button
                                onClick={() => toggleType(type)}
                                className={`w-full flex items-center justify-between px-4 py-3 ${meta.bgColor} hover:opacity-90 transition-opacity`}
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                    <Icon className={`w-5 h-5 ${meta.color}`} />
                                    <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
                                    <span className="text-xs text-gray-500 bg-white/80 px-2 py-0.5 rounded-full">{accs.length}</span>
                                </div>
                                <span className={`text-sm font-bold ${meta.color}`}>
                                    {formatBalance(typeTotal, type)}
                                </span>
                            </button>

                            {/* Account rows */}
                            {isExpanded && accs.length > 0 && (
                                <div className="divide-y divide-gray-100">
                                    {accs.map(acc => (
                                        <div
                                            key={acc.id}
                                            onClick={() => openLedger(acc)}
                                            className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 cursor-pointer group transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-xs font-mono text-gray-400 w-12 shrink-0">{acc.code}</span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#B8860B] transition-colors">{acc.name}</p>
                                                    {acc.description && (
                                                        <p className="text-xs text-gray-400 truncate">{acc.description}</p>
                                                    )}
                                                </div>
                                                {acc.linked_bank_account_id && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium shrink-0">Bank</span>}
                                                {acc.linked_cash_account_id && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium shrink-0">Cash</span>}
                                            </div>
                                            <span className={`text-sm font-semibold tabular-nums ${(acc.current_balance || 0) === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                                                {formatBalance(acc.current_balance || 0, acc.account_type)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {isExpanded && accs.length === 0 && (
                                <div className="px-4 py-4 text-sm text-gray-400 italic text-center">No accounts in this category</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Add Account Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-md w-full max-w-md animate-scale-in">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="font-semibold text-gray-900">Add New Account</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAddAccount} className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Account Code *</label>
                                    <input
                                        required value={newAccount.code}
                                        onChange={e => setNewAccount(p => ({ ...p, code: e.target.value }))}
                                        placeholder="e.g. 5021"
                                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-[#B8860B]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Account Type *</label>
                                    <select
                                        value={newAccount.account_type}
                                        onChange={e => setNewAccount(p => ({ ...p, account_type: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]"
                                    >
                                        <option value="asset">Asset</option>
                                        <option value="liability">Liability</option>
                                        <option value="equity">Equity</option>
                                        <option value="income">Income</option>
                                        <option value="expense">Expense</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Account Name *</label>
                                <input
                                    required value={newAccount.name}
                                    onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Vehicle Maintenance"
                                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                                <input
                                    value={newAccount.description}
                                    onChange={e => setNewAccount(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Optional description"
                                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]"
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                                <button type="submit" disabled={savingAccount} className="flex-1 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-60">
                                    {savingAccount ? 'Creating…' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Account Ledger Modal */}
            {selectedLedger && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col animate-scale-in">
                        <div className="p-4 border-b flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="font-semibold text-gray-900">{selectedLedger.name}</h2>
                                <p className="text-xs text-gray-500">{selectedLedger.code} · {ACCOUNT_TYPE_META[selectedLedger.account_type]?.label} · Balance: {formatBalance(selectedLedger.current_balance || 0, selectedLedger.account_type)}</p>
                            </div>
                            <button onClick={() => setSelectedLedger(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            {loadingLedger ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                </div>
                            ) : ledgerEntries.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No journal entries for this account yet.</p>
                                    <p className="text-xs mt-1">Entries will appear here when transactions are verified.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Date</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Entry #</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Description</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Debit</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {ledgerEntries.map(entry => (
                                            <tr key={entry.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                                                    {entry.journal_entry?.entry_date ? new Date(entry.journal_entry.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '–'}
                                                </td>
                                                <td className="px-4 py-2 text-xs font-mono text-gray-600">{entry.journal_entry?.entry_number || '–'}</td>
                                                <td className="px-4 py-2 text-xs text-gray-700">{entry.description || entry.journal_entry?.description || '–'}</td>
                                                <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">
                                                    {entry.debit_amount > 0 ? <span className="text-gray-900">₹{entry.debit_amount.toLocaleString()}</span> : <span className="text-gray-300">–</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">
                                                    {entry.credit_amount > 0 ? <span className="text-gray-900">₹{entry.credit_amount.toLocaleString()}</span> : <span className="text-gray-300">–</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t font-bold">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-xs text-gray-600">Total</td>
                                            <td className="px-4 py-2 text-right text-xs text-gray-900 tabular-nums">₹{ledgerEntries.reduce((s, e) => s + (e.debit_amount || 0), 0).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right text-xs text-gray-900 tabular-nums">₹{ledgerEntries.reduce((s, e) => s + (e.credit_amount || 0), 0).toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
