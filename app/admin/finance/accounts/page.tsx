'use client';

import React, { useState } from 'react';
import { Building2, Wallet, Plus, Edit2, Trash2, Eye, RefreshCw } from 'lucide-react';
import { useBankAccounts, useCashAccounts } from '@/lib/hooks';

export default function AccountsPage() {
    const { bankAccounts, loading: loadingBanks, refresh: refreshBanks } = useBankAccounts();
    const { cashAccounts, loading: loadingCash, refresh: refreshCash } = useCashAccounts();

    const [showAddBank, setShowAddBank] = useState(false);
    const [showAddCash, setShowAddCash] = useState(false);

    const totalBankBalance = bankAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    const totalCashBalance = cashAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    const grandTotal = totalBankBalance + totalCashBalance;

    return (
        <div className="space-y-3 md:space-y-6 px-2 animate-fade-in px-2 pb-16 md:pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
                <div>
                    <h1 className="text-page-title text-gray-900">Accounts</h1>
                    <p className="text-gray-500">Manage bank accounts and cash registers</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { refreshBanks(); refreshCash(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl hover:bg-gray-50"
                    >
                        <RefreshCw className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Total Balance Summary */}
            <div className="bg-oms-blue rounded-lg md:rounded-2xl p-3 md:p-4 text-white">
                <h2 className="text-sm font-medium opacity-90 mb-2">Total Available Balance</h2>
                <p className="text-page-title">₹{grandTotal.toLocaleString()}</p>
                <div className="mt-4 flex gap-3 md:gap-4 text-sm">
                    <div>
                        <p className="opacity-75">Bank Accounts</p>
                        <p className="text-page-title">₹{totalBankBalance.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="opacity-75">Cash</p>
                        <p className="text-page-title">₹{totalCashBalance.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Bank Accounts */}
            <div className="bg-white rounded-2xl border border-gray-200">
                <div className="p-5 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-section text-gray-900">Bank Accounts</h2>
                            <p className="text-sm text-gray-500">{bankAccounts.length} accounts</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddBank(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        Add Bank Account
                    </button>
                </div>

                <div className="divide-y">
                    {loadingBanks ? (
                        <div className="p-8 text-center text-gray-400">Loading...</div>
                    ) : bankAccounts.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            No bank accounts yet. Add your first bank account!
                        </div>
                    ) : (
                        bankAccounts.map((account) => (
                            <div key={account.id} className="p-5 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-gray-900">{account.name}</h3>
                                            {account.is_default && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-label rounded-full">
                                                    Default
                                                </span>
                                            )}
                                            {!account.is_active && (
                                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-label rounded-full">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            A/c: {account.account_number}
                                        </p>
                                        {account.account_type && (
                                            <p className="text-xs text-gray-500 mt-1 capitalize">
                                                {account.account_type.replace('_', ' ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-page-title text-gray-900">
                                            ₹{(account.current_balance || 0).toLocaleString()}
                                        </p>
                                        <a
                                            href={`/admin/finance/accounts/statement/${account.id}`}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                        >
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
            <div className="bg-white rounded-2xl border border-gray-200">
                <div className="p-5 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-gray-900" />
                        </div>
                        <div>
                            <h2 className="text-section text-gray-900">Cash Accounts</h2>
                            <p className="text-sm text-gray-500">{cashAccounts.length} cash registers</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddCash(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
                    >
                        <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        Add Cash Account
                    </button>
                </div>

                <div className="divide-y">
                    {loadingCash ? (
                        <div className="p-8 text-center text-gray-400">Loading...</div>
                    ) : cashAccounts.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            No cash accounts yet. Add your first cash register!
                        </div>
                    ) : (
                        cashAccounts.map((account) => (
                            <div key={account.id} className="p-5 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900">{account.name}</h3>
                                        {account.location && (
                                            <p className="text-sm text-gray-600">📍 {account.location}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-page-title text-gray-900">
                                            ₹{(account.current_balance || 0).toLocaleString()}
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                            <a
                                                href={`/admin/finance/cash/statement/${account.id}`}
                                                className="text-sm text-gray-900 hover:text-gray-900 font-medium"
                                            >
                                                Statement →
                                            </a>
                                            <button className="text-sm text-gray-600 hover:text-gray-700 font-medium">
                                                Count Cash
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Bank Account Modal */}
            {showAddBank && (
                <AddBankAccountModal
                    onClose={() => setShowAddBank(false)}
                    onSuccess={() => { refreshBanks(); setShowAddBank(false); }}
                />
            )}

            {/* Add Cash Account Modal */}
            {showAddCash && (
                <AddCashAccountModal
                    onClose={() => setShowAddCash(false)}
                    onSuccess={() => { refreshCash(); setShowAddCash(false); }}
                />
            )}
        </div>
    );
}

// Add Bank Account Modal Component
function AddBankAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [formData, setFormData] = useState({
        name: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        accountType: 'current',
        openingBalance: '0',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const { supabase } = await import('@/lib/supabase');

            const { error } = await supabase.from('bank_accounts').insert({
                name: formData.name,
                // bank_name: formData.bankName, // Removed - schema cache not updated yet
                account_number: formData.accountNumber,
                ifsc_code: formData.ifscCode,
                account_type: formData.accountType,
                opening_balance: parseFloat(formData.openingBalance) || 0,
                current_balance: parseFloat(formData.openingBalance) || 0,
                is_active: true,
            });

            if (error) throw error;

            alert('✅ Bank account added successfully!');
            onSuccess();
        } catch (error: any) {
            console.error('Error:', error);
            alert('❌ Failed to add bank account: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md ">
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-page-title">Add Bank Account</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., HDFC Current Account"
                            className="w-full px-4 py-2 border rounded-xl"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                        <input
                            type="text"
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                            placeholder="e.g., HDFC Bank"
                            className="w-full px-4 py-2 border rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                        <input
                            type="text"
                            value={formData.accountNumber}
                            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                            placeholder="XXXX1234"
                            className="w-full px-4 py-2 border rounded-xl"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                        <input
                            type="text"
                            value={formData.ifscCode}
                            onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                            placeholder="HDFC0000123"
                            className="w-full px-4 py-2 border rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                        <select
                            value={formData.accountType}
                            onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                            className="w-full px-4 py-2 border rounded-xl"
                        >
                            <option value="current">Current Account</option>
                            <option value="savings">Savings Account</option>
                            <option value="od">Overdraft</option>
                            <option value="cc">Credit Card</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.openingBalance}
                            onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-4 py-2 border rounded-xl"
                        />
                        <p className="text-xs text-gray-500 mt-1">Current balance in this account</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Adding...' : 'Add Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Add Cash Account Modal Component
function AddCashAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        openingBalance: '0',
    });
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

            alert('✅ Cash account added successfully!');
            onSuccess();
        } catch (error: any) {
            console.error('Error:', error);
            alert('❌ Failed to add cash account: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md ">
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-page-title">Add Cash Account</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cash Account Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Main Cash Register, Petty Cash"
                            className="w-full px-4 py-2 border rounded-xl"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            placeholder="e.g., Front Desk, Office Safe"
                            className="w-full px-4 py-2 border rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.openingBalance}
                            onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-4 py-2 border rounded-xl"
                        />
                        <p className="text-xs text-gray-500 mt-1">Current cash in this register</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                        >
                            {saving ? 'Adding...' : 'Add Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
