'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, IndianRupee, Building, Wallet, Calendar, CheckCircle, AlertCircle, Edit
} from 'lucide-react';

const currentFinancialYear = '2024-25';

const initialOpeningBalances = {
  financialYear: '2024-25',
  asOfDate: '2024-04-01',
  cash: 125000,
  banks: [
    { id: 1, name: 'HDFC Current Account', accountNo: 'XXXX4521', balance: 850000 },
    { id: 2, name: 'ICICI Savings', accountNo: 'XXXX7890', balance: 320000 },
    { id: 3, name: 'SBI Business', accountNo: 'XXXX1234', balance: 175000 },
    { id: 4, name: 'Axis Bank Current', accountNo: 'XXXX5678', balance: 280000 },
  ],
  isLocked: true
};

export default function OpeningBalancePage() {
  const [openingBalance, setOpeningBalance] = useState(initialOpeningBalances);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    cash: openingBalance.cash,
    banks: [...openingBalance.banks]
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const totalBankBalance = openingBalance.banks.reduce((sum, b) => sum + b.balance, 0);
  const totalOpeningBalance = openingBalance.cash + totalBankBalance;

  const handleBankBalanceChange = (bankId: number, value: number) => {
    setEditData({
      ...editData,
      banks: editData.banks.map(b => b.id === bankId ? { ...b, balance: value } : b)
    });
  };

  const handleSave = () => {
    if (confirm('Are you sure you want to update the opening balances? This will affect all financial reports.')) {
      setOpeningBalance({
        ...openingBalance,
        cash: editData.cash,
        banks: editData.banks,
        isLocked: true
      });
      setIsEditing(false);
    }
  };

  const handleUnlock = () => {
    if (confirm('Unlocking opening balance will allow editing. This should only be done if corrections are needed. Continue?')) {
      setOpeningBalance({ ...openingBalance, isLocked: false });
      setIsEditing(true);
    }
  };

  return (
    <div className="p-4 sm: p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Opening Balance</h1>
            <p className="text-gray-500">FY {openingBalance.financialYear}</p>
          </div>
        </div>
        {openingBalance.isLocked ? (
          <button onClick={handleUnlock}
            className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2.5 rounded-lg hover:bg-amber-200 font-medium">
            <Edit className="w-4 h-4 md:w-4.5 md:h-4.5" />
            <span>Unlock to Edit</span>
          </button>
        ) : (
          <button onClick={handleSave}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 font-medium">
            <Save className="w-4 h-4 md:w-4.5 md:h-4.5" />
            <span>Save & Lock</span>
          </button>
        )}
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${openingBalance.isLocked ? 'bg-white border border-green-200' : 'bg-white border border-gray-200'}`}>
        {openingBalance.isLocked ? (
          <>
            <CheckCircle className="w-5 h-5 text-gray-900 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-900">Opening Balance Locked</p>
              <p className="text-sm text-gray-900">As of {new Date(openingBalance.asOfDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-oms-orange flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-900">Editing Mode</p>
              <p className="text-sm text-amber-700">Make changes and save to lock the balances</p>
            </div>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-gray-900" />
            </div>
            <span className="text-gray-600">Cash Opening</span>
          </div>
          <p className="text-page-title text-gray-900">{formatCurrency(openingBalance.cash)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-gray-600">Bank Opening</span>
          </div>
          <p className="text-page-title text-blue-600">{formatCurrency(totalBankBalance)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-oms-blue rounded-lg flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-oms-blue" />
            </div>
            <span className="text-gray-600">Total Opening</span>
          </div>
          <p className="text-page-title text-oms-blue">{formatCurrency(totalOpeningBalance)}</p>
        </div>
      </div>

      {/* Cash Opening Balance */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5 text-gray-900" />
          </div>
          <h2 className="text-section text-gray-900">Cash Opening Balance</h2>
        </div>
        {isEditing ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Opening Cash Balance (₹)</label>
            <input type="number" value={editData.cash}
              onChange={(e) => setEditData({ ...editData, cash: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 border rounded-lg text-section focus:ring-2 focus:ring-green-500" />
          </div>
        ) : (
          <div className="text-page-title text-gray-900">{formatCurrency(openingBalance.cash)}</div>
        )}
      </div>

      {/* Bank Opening Balances */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-section text-gray-900">Bank Opening Balances</h2>
          </div>
          <Link href="/admin/finance/banks" className="text-sm text-oms-blue hover:underline">
            Manage Bank Accounts →
          </Link>
        </div>

        <div className="space-y-3">
          {(isEditing ? editData.banks : openingBalance.banks).map(bank => (
            <div key={bank.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-semibold text-gray-900">{bank.name}</p>
                <p className="text-sm text-gray-500">A/c: {bank.accountNo}</p>
              </div>
              {isEditing ? (
                <input type="number" value={editData.banks.find(b => b.id === bank.id)?.balance || 0}
                  onChange={(e) => handleBankBalanceChange(bank.id, parseFloat(e.target.value) || 0)}
                  className="w-40 px-3 py-2 border rounded-lg text-right font-semibold focus:ring-2 focus:ring-blue-500" />
              ) : (
                <span className="text-section text-blue-600">{formatCurrency(bank.balance)}</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between">
          <span className="font-semibold text-gray-700">Total Bank Balance</span>
          <span className="text-page-title text-blue-600">
            {formatCurrency(isEditing
              ? editData.banks.reduce((sum, b) => sum + b.balance, 0)
              : totalBankBalance)}
          </span>
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Important Note</p>
            <p className="text-sm text-blue-700 mt-1">
              Opening balances are the starting point for financial year {openingBalance.financialYear}.
              All transactions, reports, and profit calculations are based on these balances.
              Please ensure accuracy before locking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
