'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Building2, Wallet, Plus, RefreshCw, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { useBankAccounts, useCashAccounts } from '@/lib/hooks';
import { refuseLegacyWrite } from '@/lib/legacy-ledger';
import ReadOnlyLedgerBanner from '@/components/finance/ReadOnlyLedgerBanner';

// Transfer types config
const TRANSFER_TYPES = [
    { key: 'bank_to_cash',   label: 'Bank to Cash Transfer',  from: 'bank', to: 'cash'  },
    { key: 'cash_to_bank',   label: 'Cash to Bank Transfer',  from: 'cash', to: 'bank'  },
    { key: 'bank_to_bank',   label: 'Bank to Bank Transfer',  from: 'bank', to: 'bank'  },
    { key: 'cash_to_cash',   label: 'Cash to Cash Transfer',  from: 'cash', to: 'cash'  },
    { key: 'adjust_balance', label: 'Adjust Balance',         from: 'any',  to: null    },
];

export default function AccountsPage() {
    const { bankAccounts, loading: loadingBanks, refresh: refreshBanks } = useBankAccounts();
    const { cashAccounts, loading: loadingCash, refresh: refreshCash } = useCashAccounts();

    const [showAddBank, setShowAddBank]         = useState(false);
    const [showAddCash, setShowAddCash]         = useState(false);
    const [showTransferMenu, setShowTransferMenu] = useState(false);
    const [transferType, setTransferType]       = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const totalBankBalance = bankAccounts.reduce((s, a) => s + (a.current_balance || 0), 0);
    const totalCashBalance = cashAccounts.reduce((s, a) => s + (a.current_balance || 0), 0);
    const grandTotal = totalBankBalance + totalCashBalance;

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowTransferMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleTransferSelect = (typeKey: string) => {
        setTransferType(typeKey);
        setShowTransferMenu(false);
    };

    const handleTransferSuccess = () => {
        setTransferType(null);
        refreshBanks();
        refreshCash();
    };

    return (
        <div className="space-y-3 md:space-y-6 px-2 animate-fade-in pb-16 md:pb-20">
            <ReadOnlyLedgerBanner what="Transfers and balance adjustments" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
                <div>
                    <h1 className="text-page-title text-gray-900">Accounts</h1>
                    <p className="text-gray-500">Manage bank accounts and cash registers</p>
                </div>
                <div className="flex gap-2 md:gap-3">
                    <button
                        onClick={() => { refreshBanks(); refreshCash(); }}
                        className="flex items-center gap-2 px-3 py-2 bg-white border rounded-md hover:bg-gray-50 text-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>

                    {/* Transfer Dropdown */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowTransferMenu(v => !v)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm font-medium"
                        >
                            <ArrowLeftRight className="w-4 h-4" />
                            Transfer / Adjust
                            <ChevronDown className={`w-4 h-4 transition-transform ${showTransferMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showTransferMenu && (
                            <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1">
                                {TRANSFER_TYPES.map((t, i) => (
                                    <React.Fragment key={t.key}>
                                        {i === 4 && <div className="my-1 border-t border-gray-100" />}
                                        <button
                                            onClick={() => handleTransferSelect(t.key)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            {t.label}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Total Balance Summary */}
            <div className="bg-gray-900 rounded-md p-3 md:p-4 text-white">
                <h2 className="text-sm font-medium opacity-90 mb-2">Total Available Balance</h2>
                <p className="text-page-title">₹{grandTotal.toLocaleString('en-IN')}</p>
                <div className="mt-4 flex gap-3 md:gap-4 text-sm">
                    <div>
                        <p className="opacity-75">Bank Accounts</p>
                        <p className="text-page-title">₹{totalBankBalance.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                        <p className="opacity-75">Cash</p>
                        <p className="text-page-title">₹{totalCashBalance.toLocaleString('en-IN')}</p>
                    </div>
                </div>
            </div>

            {/* Bank Accounts */}
            <div className="bg-white rounded-md border border-gray-200">
                <div className="p-5 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                            <h2 className="text-section text-gray-900">Bank Accounts</h2>
                            <p className="text-sm text-gray-500">{bankAccounts.length} accounts</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddBank(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Bank Account
                    </button>
                </div>
                <div className="divide-y">
                    {loadingBanks ? (
                        <div className="p-8 text-center text-gray-400">Loading...</div>
                    ) : bankAccounts.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No bank accounts yet.</div>
                    ) : (
                        bankAccounts.map((account) => (
                            <div key={account.id} className="p-5 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-gray-900">{account.name}</h3>
                                            {account.is_default && (
                                                <span className="px-2 py-0.5 bg-muted text-foreground text-label rounded-md">Default</span>
                                            )}
                                            {!account.is_active && (
                                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-label rounded-md">Inactive</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600">A/c: {account.account_number}</p>
                                        {account.account_type && (
                                            <p className="text-xs text-gray-500 mt-1 capitalize">{account.account_type.replace('_', ' ')}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-page-title text-gray-900">₹{(account.current_balance || 0).toLocaleString('en-IN')}</p>
                                        <a href={`/admin/finance/accounts/statement/${account.id}`} className="text-sm text-foreground hover:underline font-medium">
                                            View Statement →
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Cash Accounts */}
            <div className="bg-white rounded-md border border-gray-200">
                <div className="p-5 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-gray-900" />
                        </div>
                        <div>
                            <h2 className="text-section text-gray-900">Cash Accounts</h2>
                            <p className="text-sm text-gray-500">{cashAccounts.length} cash registers</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddCash(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Cash Account
                    </button>
                </div>
                <div className="divide-y">
                    {loadingCash ? (
                        <div className="p-8 text-center text-gray-400">Loading...</div>
                    ) : cashAccounts.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No cash accounts yet.</div>
                    ) : (
                        cashAccounts.map((account) => (
                            <div key={account.id} className="p-5 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900">{account.name}</h3>
                                        {account.location && <p className="text-sm text-gray-600">📍 {account.location}</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-page-title text-gray-900">₹{(account.current_balance || 0).toLocaleString('en-IN')}</p>
                                        <a href={`/admin/finance/accounts/statement/${account.id}`} className="text-sm text-gray-900 hover:underline font-medium">
                                            Statement →
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modals */}
            {showAddBank && (
                <AddBankAccountModal onClose={() => setShowAddBank(false)} onSuccess={() => { refreshBanks(); setShowAddBank(false); }} />
            )}
            {showAddCash && (
                <AddCashAccountModal onClose={() => setShowAddCash(false)} onSuccess={() => { refreshCash(); setShowAddCash(false); }} />
            )}
            {transferType && (
                <TransferModal
                    transferType={transferType}
                    bankAccounts={bankAccounts}
                    cashAccounts={cashAccounts}
                    onClose={() => setTransferType(null)}
                    onSuccess={handleTransferSuccess}
                />
            )}
        </div>
    );
}

// ─── Transfer Modal ───────────────────────────────────────────────────────────
function TransferModal({
    transferType,
    bankAccounts,
    cashAccounts,
    onClose,
    onSuccess,
}: {
    transferType: string;
    bankAccounts: any[];
    cashAccounts: any[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const typeConfig = TRANSFER_TYPES.find(t => t.key === transferType)!;
    const isAdjust  = transferType === 'adjust_balance';

    const fromAccounts = typeConfig.from === 'bank' ? bankAccounts
                       : typeConfig.from === 'cash' ? cashAccounts
                       : [...bankAccounts.map(a => ({ ...a, _type: 'bank' })), ...cashAccounts.map(a => ({ ...a, _type: 'cash' }))];

    const toAccounts   = typeConfig.to === 'bank' ? bankAccounts
                       : typeConfig.to === 'cash' ? cashAccounts
                       : [];

    const [formData, setFormData] = useState({
        from_account_id:   fromAccounts[0]?.id || '',
        from_account_type: typeConfig.from === 'any' ? (fromAccounts[0]?._type || (bankAccounts.length > 0 ? 'bank' : 'cash')) : typeConfig.from,
        to_account_id:     toAccounts[0]?.id || '',
        amount:            '',
        adjust_direction:  '+',   // for adjust_balance: + or -
        transfer_date:     new Date().toISOString().split('T')[0],
        notes:             '',
    });
    const [saving, setSaving]   = useState(false);

    // When from_account changes in adjust mode, update account type
    const handleFromChange = (id: string) => {
        if (isAdjust) {
            const isBankAcc = bankAccounts.some(a => a.id === id);
            setFormData(p => ({ ...p, from_account_id: id, from_account_type: isBankAcc ? 'bank' : 'cash' }));
        } else {
            setFormData(p => ({ ...p, from_account_id: id }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount);
        if (!amt || amt <= 0) { toast.error('Please enter a valid amount'); return; }
        if (!formData.from_account_id) { toast.error('Please select an account'); return; }
        if (!isAdjust && !formData.to_account_id) { toast.error('Please select a destination account'); return; }
        if (!isAdjust && formData.from_account_id === formData.to_account_id) { toast.error('Source and destination must be different'); return; }

        // A transfer — and especially "Adjust balance", which posts an
        // arbitrary signed delta — is a money movement in the old ledger, not
        // account master data. Adding or renaming an account stays open.
        if (refuseLegacyWrite('Recording a transfer or balance adjustment')) return;

        setSaving(true);
        try {
            const { supabase } = await import('@/lib/supabase');
            const finalAmount = isAdjust
                ? (formData.adjust_direction === '+' ? amt : -amt)
                : amt;

            const { error } = await supabase.rpc('record_account_transfer', {
                p_transfer_type:      transferType,
                p_from_account_type:  formData.from_account_type,
                p_from_account_id:    formData.from_account_id,
                p_to_account_type:    isAdjust ? null : typeConfig.to,
                p_to_account_id:      isAdjust ? null : formData.to_account_id,
                p_amount:             finalAmount,
                p_transfer_date:      formData.transfer_date,
                p_notes:              formData.notes || null,
            });

            if (error) throw error;

            toast.success(isAdjust ? 'Balance adjusted successfully!' : 'Transfer recorded successfully!');
            onSuccess();
        } catch (err: any) {
            toast.error('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Format account display
    const accLabel = (acc: any) => `${acc.name} — ₹${(acc.current_balance || 0).toLocaleString('en-IN')}`;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-md w-full max-w-md shadow-xl">
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-page-title">{typeConfig.label}</h2>
                        {!isAdjust && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                Deducted from source • Added to destination • No P&L impact
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 text-xl leading-none">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">

                    {/* From Account */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {isAdjust ? 'Account to Adjust' : 'From Account'}
                        </label>
                        <select
                            value={formData.from_account_id}
                            onChange={e => handleFromChange(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                            required
                        >
                            <option value="">Select account</option>
                            {isAdjust ? (
                                <>
                                    {bankAccounts.length > 0 && <optgroup label="Bank Accounts">
                                        {bankAccounts.map(a => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
                                    </optgroup>}
                                    {cashAccounts.length > 0 && <optgroup label="Cash Accounts">
                                        {cashAccounts.map(a => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
                                    </optgroup>}
                                </>
                            ) : (
                                fromAccounts.map((a: any) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)
                            )}
                        </select>
                    </div>

                    {/* To Account (not for adjust) */}
                    {!isAdjust && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
                            <select
                                value={formData.to_account_id}
                                onChange={e => setFormData(p => ({ ...p, to_account_id: e.target.value }))}
                                className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                                required
                            >
                                <option value="">Select account</option>
                                {toAccounts
                                    .filter((a: any) => a.id !== formData.from_account_id)
                                    .map((a: any) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)
                                }
                            </select>
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                        <div className="flex gap-2">
                            {isAdjust && (
                                <div className="flex rounded-md border overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, adjust_direction: '+' }))}
                                        className={`px-3 py-2 text-sm font-bold transition-colors ${formData.adjust_direction === '+' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                    >+</button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, adjust_direction: '-' }))}
                                        className={`px-3 py-2 text-sm font-bold transition-colors ${formData.adjust_direction === '-' ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                    >−</button>
                                </div>
                            )}
                            <input
                                type="number"
                                value={formData.amount || ''}
                                onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                className="flex-1 px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                                required
                            />
                        </div>
                        {isAdjust && (
                            <p className="text-xs text-gray-500 mt-1">
                                {formData.adjust_direction === '+' ? '+ adds to balance' : '− deducts from balance'}
                            </p>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                            type="date"
                            value={formData.transfer_date}
                            onChange={e => setFormData(p => ({ ...p, transfer_date: e.target.value }))}
                            className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                            required
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                        <input
                            type="text"
                            value={formData.notes}
                            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                            placeholder={isAdjust ? 'e.g., Monthly reconciliation' : 'e.g., Cash for office expenses'}
                            className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border rounded-md hover:bg-gray-50 text-sm font-medium">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 text-sm font-medium"
                        >
                            {saving ? 'Processing...' : isAdjust ? 'Adjust Balance' : 'Record Transfer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Add Bank Account Modal ───────────────────────────────────────────────────
function AddBankAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [formData, setFormData] = useState({ name: '', bankName: '', accountNumber: '', ifscCode: '', accountType: 'current', openingBalance: '0' });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { supabase } = await import('@/lib/supabase');
            const { error } = await supabase.from('bank_accounts').insert({
                name: formData.name,
                account_number: formData.accountNumber,
                ifsc_code: formData.ifscCode,
                account_type: formData.accountType,
                opening_balance: parseFloat(formData.openingBalance) || 0,
                current_balance: parseFloat(formData.openingBalance) || 0,
                is_active: true,
            });
            if (error) throw error;
            toast.success('Bank account added!');
            onSuccess();
        } catch (err: any) {
            toast.error('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-md w-full max-w-md">
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-page-title">Add Bank Account</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., HDFC Current Account" className="w-full px-4 py-2 border rounded-md text-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                        <input type="text" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} placeholder="e.g., HDFC Bank" className="w-full px-4 py-2 border rounded-md text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                        <input type="text" value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} placeholder="XXXX1234" className="w-full px-4 py-2 border rounded-md text-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                        <input type="text" value={formData.ifscCode} onChange={e => setFormData({...formData, ifscCode: e.target.value})} placeholder="HDFC0000123" className="w-full px-4 py-2 border rounded-md text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                        <select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="w-full px-4 py-2 border rounded-md text-sm">
                            <option value="current">Current Account</option>
                            <option value="savings">Savings Account</option>
                            <option value="od">Overdraft</option>
                            <option value="cc">Credit Card</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                        <input type="number" step="0.01" value={formData.openingBalance || ''} onChange={e => setFormData({...formData, openingBalance: e.target.value})} placeholder="0.00" className="w-full px-4 py-2 border rounded-md text-sm" />
                        <p className="text-xs text-gray-500 mt-1">Current balance in this account</p>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 text-sm">{saving ? 'Adding...' : 'Add Account'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Add Cash Account Modal ───────────────────────────────────────────────────
function AddCashAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [formData, setFormData] = useState({ name: '', location: '', openingBalance: '0' });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { supabase } = await import('@/lib/supabase');
            const { error } = await supabase.from('cash_accounts').insert({
                name: formData.name,
                location: formData.location,
                opening_balance: parseFloat(formData.openingBalance) || 0,
                current_balance: parseFloat(formData.openingBalance) || 0,
                is_active: true,
            });
            if (error) throw error;
            toast.success('Cash account added!');
            onSuccess();
        } catch (err: any) {
            toast.error('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-md w-full max-w-md">
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-page-title">Add Cash Account</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cash Account Name</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Main Cash Register" className="w-full px-4 py-2 border rounded-md text-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g., Front Desk, Office Safe" className="w-full px-4 py-2 border rounded-md text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                        <input type="number" step="0.01" value={formData.openingBalance || ''} onChange={e => setFormData({...formData, openingBalance: e.target.value})} placeholder="0.00" className="w-full px-4 py-2 border rounded-md text-sm" />
                        <p className="text-xs text-gray-500 mt-1">Current cash in this register</p>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 text-sm">{saving ? 'Adding...' : 'Add Account'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
