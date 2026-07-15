'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  Plus, Search, ArrowLeft, Building, Edit, Trash2, Eye, X, IndianRupee,
  ArrowUpRight, ArrowDownLeft, Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useBankAccounts } from '@/lib/hooks';
import { BankAccount } from '@/types/database';
import { useConfirm } from '@/components/ConfirmModal';

const accountTypes = ['Current', 'Savings', 'OD', 'CC', 'UPI'];

export default function BankAccountsPage() {
  const {
    bankAccounts: banks,
    loading,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    setDefaultAccount
  } = useBankAccounts();

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();

  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    ifsc_code: '',
    branch: '',
    account_type: 'Current',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().split('T')[0]
  });

  const filteredBanks = banks ? banks.filter(b =>
    (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.account_number.includes(searchTerm)
  ) : [];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingBank) {
        await updateBankAccount(editingBank.id, {
          name: formData.name,
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          branch: formData.branch,
          account_type: formData.account_type as any,
          opening_balance: formData.opening_balance,
          opening_balance_date: formData.opening_balance_date
        } as any);
        // Recalculate all transaction balances if opening_balance changed
        if (editingBank.opening_balance !== formData.opening_balance) {
          await supabase.rpc('recalculate_account_balances', { p_account_id: editingBank.id });
        }
      } else {
        await createBankAccount({
          name: formData.name,
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          branch: formData.branch,
          account_type: formData.account_type as any,
          opening_balance: formData.opening_balance,
          opening_balance_date: formData.opening_balance_date,
          is_default: banks?.length === 0, // First account is default
          is_active: true
        } as any);
      }
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to save bank account: ${error.message || JSON.stringify(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', account_number: '', ifsc_code: '', branch: '', account_type: 'Current', opening_balance: 0, opening_balance_date: new Date().toISOString().split('T')[0] });
    setEditingBank(null);
    setShowModal(false);
  };

  const handleEdit = (bank: BankAccount) => {
    setFormData({
      name: bank.name,
      account_number: bank.account_number,
      ifsc_code: bank.ifsc_code || '',
      branch: bank.branch || '',
      account_type: bank.account_type,
      opening_balance: bank.opening_balance,
      opening_balance_date: (bank as any).opening_balance_date || '2025-04-01'
    });
    setEditingBank(bank);
    setShowModal(true);
  };

  const handleDelete = async (id: string, currentBalance: number) => {
    const message = currentBalance !== 0
      ? 'This account has a non-zero balance. Are you sure you want to delete it? This might affect your reports.'
      : 'Are you sure you want to delete this bank account?';
    const { confirmed } = await confirm({ title: 'Delete Bank Account', message, variant: 'danger', confirmLabel: 'Delete' });
    if (!confirmed) return;
    await deleteBankAccount(id);
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultAccount(id);
  };

  // Stats
  const totalBalance = banks?.reduce((sum, b) => sum + (b.current_balance || 0), 0) || 0;
  const activeAccounts = banks?.filter(b => b.is_active).length || 0;

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Bank Accounts</h1>
            <p className="text-gray-500">Manage multiple bank accounts</p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Record Transaction Button Removed for Simplicity/Refactor needed if connected to real data */}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-md hover:bg-gray-900 font-medium">
            <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
            <span>Add Bank</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-md border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Balance</p>
          <p className="text-page-title text-primary">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-white rounded-md border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Active Accounts</p>
          <p className="text-page-title text-gray-900">{activeAccounts}</p>
        </div>
        {/* Placeholder stats */}
        <div className="bg-white rounded-md border p-3 sm:p-4 opacity-50">
          <p className="text-xs sm:text-sm text-gray-500">Total Inflow</p>
          <p className="text-page-title text-gray-900">--</p>
        </div>
        <div className="bg-white rounded-md border p-3 sm:p-4 opacity-50">
          <p className="text-xs sm:text-sm text-gray-500">Total Outflow</p>
          <p className="text-page-title text-red-600">--</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-md border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by bank name or account number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Bank Accounts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4">
        {filteredBanks.map(bank => (
          <div key={bank.id} className={`bg-white rounded-md border p-4  transition-shadow ${!bank.is_active ? 'opacity-60' : ''} ${bank.is_default ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                  <Building className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{bank.name}</h3>
                    {bank.is_default && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-gray-900 text-white">Default</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{bank.account_type} • {bank.account_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setSelectedBank(bank); setShowDetailModal(true); }}
                  className="p-2 text-foreground hover:bg-muted rounded-md"><Eye className="w-4 h-4 md:w-4.5 md:h-4.5" /></button>
                <button onClick={() => handleEdit(bank)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"><Edit className="w-4 h-4 md:w-4.5 md:h-4.5" /></button>
                <button onClick={() => handleDelete(bank.id, bank.current_balance)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"><Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center py-3 bg-gray-50 rounded-md mb-3">
              <div>
                <p className="text-xs text-gray-500">Opening Balance</p>
                <p className="font-semibold text-gray-700">{formatCurrency(bank.opening_balance)}</p>
                {(bank as any).opening_balance_date && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    as on {new Date((bank as any).opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Current Balance</p>
                <p className={`font-bold ${bank.current_balance >= 0 ? 'text-primary' : 'text-red-600'}`}>{formatCurrency(bank.current_balance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Change</p>
                <p className={`font-semibold ${bank.current_balance >= bank.opening_balance ? 'text-green-600' : 'text-red-600'}`}>
                  {bank.current_balance >= bank.opening_balance ? '+' : ''}{formatCurrency(bank.current_balance - bank.opening_balance)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="text-xs text-gray-400">
                IFSC: {bank.ifsc_code}
              </div>
              {!bank.is_default && bank.is_active && (
                <button onClick={() => handleSetDefault(bank.id)} className="text-primary hover:underline text-xs font-semibold">
                  Set as Default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredBanks.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-md border">
          <Building className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No bank accounts found</h3>
          <p className="mt-1 text-gray-500">Add your first bank account to enable reconciliation</p>
          <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-md">
            Add Account
          </button>
        </div>
      )}

      {/* Add/Edit Bank Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md animate-scale-in">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-page-title">{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Bank Name *</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-md" placeholder="HDFC Bank Current Account" />
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Account Number *</label>
                  <input type="text" required value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-md" placeholder="50100012345678" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">IFSC Code *</label>
                  <input type="text" required value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2.5 border rounded-md" placeholder="HDFC0001234" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Branch *</label>
                  <input type="text" required value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-md" placeholder="Rajkot Main" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Account Type</label>
                  <select value={formData.account_type} onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-md">
                    {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Opening Balance (₹)</label>
                  <input type="number" value={formData.opening_balance || ''}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border rounded-md" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Balance as on Date</label>
                  <input type="date" value={formData.opening_balance_date}
                    onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-md" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-md font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-900 disabled:opacity-50">
                  {submitting ? 'Saving...' : (editingBank ? 'Update' : 'Add') + ' Bank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Detail Modal */}
      {showDetailModal && selectedBank && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md animate-scale-in">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-page-title">{selectedBank.name}</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-gray-900 rounded-md p-4">
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-page-title text-primary">{formatCurrency(selectedBank.current_balance)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <p className="text-xs text-gray-500">Account Number</p>
                  <p className="font-mono font-medium">{selectedBank.account_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">IFSC Code</p>
                  <p className="font-mono font-medium">{selectedBank.ifsc_code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Branch</p>
                  <p className="font-medium">{selectedBank.branch}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Type</p>
                  <p className="font-medium">{selectedBank.account_type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Opening Balance</p>
                  <p className="font-medium">{formatCurrency(selectedBank.opening_balance)}</p>
                  {(selectedBank as any).opening_balance_date && (
                    <p className="text-[10px] text-gray-400">
                      as on {new Date((selectedBank as any).opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-0.5 rounded-md text-label ${selectedBank.is_active ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedBank.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
