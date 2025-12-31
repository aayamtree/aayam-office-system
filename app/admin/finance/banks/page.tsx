'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Plus, Search, ArrowLeft, Building, Edit, Trash2, Eye, X, IndianRupee,
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Calendar
} from 'lucide-react';

const initialBanks = [
  { id: 1, name: 'HDFC Current Account', accountNo: '50100012345678', ifsc: 'HDFC0001234', 
    branch: 'Rajkot Main', type: 'Current', openingBalance: 850000, currentBalance: 1245000,
    totalInflow: 520000, totalOutflow: 125000, isDefault: true, status: 'active' },
  { id: 2, name: 'ICICI Savings', accountNo: '012345678901', ifsc: 'ICIC0001234',
    branch: 'Ahmedabad', type: 'Savings', openingBalance: 320000, currentBalance: 385000,
    totalInflow: 95000, totalOutflow: 30000, isDefault: false, status: 'active' },
  { id: 3, name: 'SBI Business', accountNo: '35012345678', ifsc: 'SBIN0001234',
    branch: 'Rajkot Industrial', type: 'Current', openingBalance: 175000, currentBalance: 142000,
    totalInflow: 45000, totalOutflow: 78000, isDefault: false, status: 'active' },
  { id: 4, name: 'Axis Bank Current', accountNo: '920010012345', ifsc: 'UTIB0001234',
    branch: 'Rajkot City', type: 'Current', openingBalance: 280000, currentBalance: 325000,
    totalInflow: 85000, totalOutflow: 40000, isDefault: false, status: 'active' },
  { id: 5, name: 'Kotak Mahindra', accountNo: '1234567890', ifsc: 'KKBK0001234',
    branch: 'Surat', type: 'Savings', openingBalance: 50000, currentBalance: 0,
    totalInflow: 0, totalOutflow: 50000, isDefault: false, status: 'inactive' },
];

const recentTransactions = [
  { id: 1, bankId: 1, type: 'inflow', description: 'Client Payment - Sharma Industries', amount: 85000, date: '2025-12-24', reference: 'NEFT123456' },
  { id: 2, bankId: 1, type: 'outflow', description: 'Vendor Payment - Raj Packaging', amount: 15000, date: '2025-12-23', reference: 'NEFT789012' },
  { id: 3, bankId: 2, type: 'inflow', description: 'Client Payment - Royal Prints', amount: 32500, date: '2025-12-22', reference: 'UPI001234' },
  { id: 4, bankId: 3, type: 'outflow', description: 'Expense - Paper Purchase', amount: 28000, date: '2025-12-21', reference: 'CHQ001' },
  { id: 5, bankId: 4, type: 'inflow', description: 'Client Payment - Gujarat Textiles', amount: 45000, date: '2025-12-20', reference: 'RTGS567890' },
];

const accountTypes = ['Current', 'Savings', 'OD', 'CC'];

export default function BankAccountsPage() {
  const [banks, setBanks] = useState(initialBanks);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [selectedBank, setSelectedBank] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '', accountNo: '', ifsc: '', branch: '', type: 'Current', openingBalance: 0
  });

  const [transactionData, setTransactionData] = useState({
    bankId: '', type: 'inflow', description: '', amount: 0, reference: '', date: ''
  });

  const filteredBanks = banks.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.accountNo.includes(searchTerm)
  );

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBank) {
      setBanks(banks.map(b => b.id === editingBank.id ? { ...b, ...formData } : b));
    } else {
      const newBank = {
        id: Date.now(), ...formData, currentBalance: formData.openingBalance,
        totalInflow: 0, totalOutflow: 0, isDefault: banks.length === 0, status: 'active'
      };
      setBanks([...banks, newBank]);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', accountNo: '', ifsc: '', branch: '', type: 'Current', openingBalance: 0 });
    setEditingBank(null);
    setShowModal(false);
  };

  const handleEdit = (bank: any) => {
    setFormData({ name: bank.name, accountNo: bank.accountNo, ifsc: bank.ifsc, 
      branch: bank.branch, type: bank.type, openingBalance: bank.openingBalance });
    setEditingBank(bank);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    const bank = banks.find(b => b.id === id);
    if (bank?.currentBalance !== 0) {
      alert('Cannot delete bank account with non-zero balance. Please transfer or adjust the balance first.');
      return;
    }
    if (confirm('Delete this bank account?')) setBanks(banks.filter(b => b.id !== id));
  };

  const handleSetDefault = (id: number) => {
    setBanks(banks.map(b => ({ ...b, isDefault: b.id === id })));
  };

  const handleRecordTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app, this would update bank balance and create ledger entry
    alert(`Transaction recorded: ${transactionData.type === 'inflow' ? '+' : '-'}₹${transactionData.amount}`);
    setShowTransactionModal(false);
    setTransactionData({ bankId: '', type: 'inflow', description: '', amount: 0, reference: '', date: '' });
  };

  // Stats
  const totalBalance = banks.filter(b => b.status === 'active').reduce((sum, b) => sum + b.currentBalance, 0);
  const totalInflow = banks.reduce((sum, b) => sum + b.totalInflow, 0);
  const totalOutflow = banks.reduce((sum, b) => sum + b.totalOutflow, 0);
  const activeAccounts = banks.filter(b => b.status === 'active').length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
            <p className="text-gray-500">Manage multiple bank accounts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTransactionModal(true)}
            className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2.5 rounded-lg hover:bg-green-200 font-medium">
            <IndianRupee size={18} />
            <span className="hidden sm:inline">Record Transaction</span>
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
            <Plus size={18} />
            <span>Add Bank</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Balance</p>
          <p className="text-lg sm:text-xl font-bold text-indigo-600">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Inflow</p>
          <p className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(totalInflow)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Outflow</p>
          <p className="text-lg sm:text-xl font-bold text-red-600">{formatCurrency(totalOutflow)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Active Accounts</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{activeAccounts}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search by bank name or account number..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {/* Bank Accounts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredBanks.map(bank => (
          <div key={bank.id} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
            bank.status === 'inactive' ? 'opacity-60' : ''} ${bank.isDefault ? 'ring-2 ring-indigo-500' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building className="text-blue-600" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{bank.name}</h3>
                    {bank.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Default</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{bank.type} • {bank.accountNo}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setSelectedBank(bank); setShowDetailModal(true); }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={18} /></button>
                <button onClick={() => handleEdit(bank)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Edit size={18} /></button>
                <button onClick={() => handleDelete(bank.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center py-3 bg-gray-50 rounded-lg mb-3">
              <div>
                <p className="text-xs text-gray-500">Opening</p>
                <p className="font-semibold text-gray-700">{formatCurrency(bank.openingBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Current</p>
                <p className="font-bold text-indigo-600">{formatCurrency(bank.currentBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Change</p>
                <p className={`font-semibold ${bank.currentBalance >= bank.openingBalance ? 'text-green-600' : 'text-red-600'}`}>
                  {bank.currentBalance >= bank.openingBalance ? '+' : ''}{formatCurrency(bank.currentBalance - bank.openingBalance)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <ArrowDownLeft size={16} />
                <span>In: {formatCurrency(bank.totalInflow)}</span>
              </div>
              <div className="flex items-center gap-1 text-red-600">
                <ArrowUpRight size={16} />
                <span>Out: {formatCurrency(bank.totalOutflow)}</span>
              </div>
              {!bank.isDefault && bank.status === 'active' && (
                <button onClick={() => handleSetDefault(bank.id)} className="text-indigo-600 hover:underline text-xs">
                  Set Default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredBanks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Building className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No bank accounts found</h3>
          <p className="mt-1 text-gray-500">Add your first bank account</p>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        <div className="space-y-3">
          {recentTransactions.map(txn => {
            const bank = banks.find(b => b.id === txn.bankId);
            return (
              <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    txn.type === 'inflow' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {txn.type === 'inflow' ? (
                      <ArrowDownLeft size={16} className="text-green-600" />
                    ) : (
                      <ArrowUpRight size={16} className="text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{txn.description}</p>
                    <p className="text-xs text-gray-500">{bank?.name} • {txn.date} • Ref: {txn.reference}</p>
                  </div>
                </div>
                <span className={`font-bold ${txn.type === 'inflow' ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.type === 'inflow' ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Bank Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Bank Name *</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" placeholder="HDFC Bank Current Account" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Account Number *</label>
                  <input type="text" required value={formData.accountNo}
                    onChange={(e) => setFormData({ ...formData, accountNo: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="50100012345678" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">IFSC Code *</label>
                  <input type="text" required value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="HDFC0001234" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Branch *</label>
                  <input type="text" required value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="Rajkot Main" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Account Type</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {!editingBank && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Opening Balance (₹)</label>
                  <input type="number" value={formData.openingBalance || ''}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="0" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  {editingBank ? 'Update' : 'Add'} Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Record Transaction</h2>
              <button onClick={() => setShowTransactionModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleRecordTransaction} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Bank Account *</label>
                <select required value={transactionData.bankId} 
                  onChange={(e) => setTransactionData({ ...transactionData, bankId: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg">
                  <option value="">Select Bank</option>
                  {banks.filter(b => b.status === 'active').map(b => (
                    <option key={b.id} value={b.id}>{b.name} (Bal: {formatCurrency(b.currentBalance)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Transaction Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setTransactionData({ ...transactionData, type: 'inflow' })}
                    className={`p-3 rounded-lg border-2 font-medium ${
                      transactionData.type === 'inflow' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}>
                    <ArrowDownLeft size={20} className="mx-auto mb-1" />
                    Money In
                  </button>
                  <button type="button" onClick={() => setTransactionData({ ...transactionData, type: 'outflow' })}
                    className={`p-3 rounded-lg border-2 font-medium ${
                      transactionData.type === 'outflow' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}>
                    <ArrowUpRight size={20} className="mx-auto mb-1" />
                    Money Out
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Amount (₹) *</label>
                <input type="number" required min="1" value={transactionData.amount || ''}
                  onChange={(e) => setTransactionData({ ...transactionData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description *</label>
                <input type="text" required value={transactionData.description}
                  onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" placeholder="Client payment / Vendor payment" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Reference</label>
                  <input type="text" value={transactionData.reference}
                    onChange={(e) => setTransactionData({ ...transactionData, reference: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="NEFT/UTR No." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date *</label>
                  <input type="date" required value={transactionData.date}
                    onChange={(e) => setTransactionData({ ...transactionData, date: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTransactionModal(false)} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium ${
                  transactionData.type === 'inflow' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  Record {transactionData.type === 'inflow' ? 'Inflow' : 'Outflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Detail Modal */}
      {showDetailModal && selectedBank && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedBank.name}</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-indigo-50 rounded-xl p-4">
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-3xl font-bold text-indigo-600">{formatCurrency(selectedBank.currentBalance)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Account Number</p>
                  <p className="font-mono font-medium">{selectedBank.accountNo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">IFSC Code</p>
                  <p className="font-mono font-medium">{selectedBank.ifsc}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Branch</p>
                  <p className="font-medium">{selectedBank.branch}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Type</p>
                  <p className="font-medium">{selectedBank.type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Opening Balance</p>
                  <p className="font-medium">{formatCurrency(selectedBank.openingBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedBank.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedBank.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600">Total Inflow</p>
                  <p className="font-bold text-green-700">{formatCurrency(selectedBank.totalInflow)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-600">Total Outflow</p>
                  <p className="font-bold text-red-700">{formatCurrency(selectedBank.totalOutflow)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
