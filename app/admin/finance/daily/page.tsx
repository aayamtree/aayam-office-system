'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Building2, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function DailyFinancePage() {
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [todayPayments, setTodayPayments] = useState<any[]>([]);
    const [todayExpenses, setTodayExpenses] = useState<any[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch accounts
            const { data: banks } = await supabase
                .from('bank_accounts')
                .select('*')
                .eq('is_active', true);

            const { data: cash } = await supabase
                .from('cash_accounts')
                .select('*')
                .eq('is_active', true);

            // Get today's date
            const today = new Date().toISOString().split('T')[0];

            // Fetch today's payments received
            const { data: payments } = await supabase
                .from('payments_received')
                .select('*, clients(name, company)')
                .eq('payment_date', today);

            // Fetch today's vendor payments  
            const { data: vendorPays } = await supabase
                .from('vendor_payments')
                .select('*, vendors(name, company)')
                .eq('payment_date', today);

            setBankAccounts(banks || []);
            setCashAccounts(cash || []);
            setTodayPayments(payments || []);
            setTodayExpenses(vendorPays || []);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const totalBanks = bankAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    const grandTotal = totalBanks + totalCash;

    const todayIncome = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const todayExpense = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netChange = todayIncome - todayExpense;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Daily Finance Summary</h1>
                    <p className="text-gray-500">Real-time financial position</p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl hover:bg-gray-50"
                    disabled={loading}
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Total Balance Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm opacity-90">Total Available Balance</p>
                        <p className="text-4xl font-bold mt-2">₹{grandTotal.toLocaleString()}</p>
                    </div>
                    <Link
                        href="/admin/finance/accounts"
                        className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg"
                    >
                        View Accounts →
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 size={18} />
                            <p className="text-sm opacity-90">Bank Accounts</p>
                        </div>
                        <p className="text-2xl font-bold">₹{totalBanks.toLocaleString()}</p>
                        <p className="text-xs opacity-75 mt-1">{bankAccounts.length} accounts</p>
                    </div>

                    <div className="bg-white/10 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet size={18} />
                            <p className="text-sm opacity-90">Cash</p>
                        </div>
                        <p className="text-2xl font-bold">₹{totalCash.toLocaleString()}</p>
                        <p className="text-xs opacity-75 mt-1">{cashAccounts.length} registers</p>
                    </div>
                </div>
            </div>

            {/* Today's Activity */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm">
                <h2 className="text-lg font-bold mb-4">Today&apos;s Activity</h2>

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                            <ArrowDownRight size={20} />
                            <p className="text-sm font-medium">Money IN</p>
                        </div>
                        <p className="text-2xl font-bold text-green-700">₹{todayIncome.toLocaleString()}</p>
                        <p className="text-xs text-green-600 mt-1">{todayPayments.length} payments received</p>
                    </div>

                    <div className="bg-red-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                            <ArrowUpRight size={20} />
                            <p className="text-sm font-medium">Money OUT</p>
                        </div>
                        <p className="text-2xl font-bold text-red-700">₹{todayExpense.toLocaleString()}</p>
                        <p className="text-xs text-red-600 mt-1">{todayExpenses.length} payments made</p>
                    </div>

                    <div className={`rounded-xl p-4 ${netChange >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                        <div className={`flex items-center gap-2 mb-2 ${netChange >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            <TrendingUp size={20} />
                            <p className="text-sm font-medium">Net Change</p>
                        </div>
                        <p className={`text-2xl font-bold ${netChange >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                            {netChange >= 0 ? '+' : ''}₹{netChange.toLocaleString()}
                        </p>
                        <p className={`text-xs mt-1 ${netChange >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {netChange >= 0 ? 'Profit' : 'Loss'} today
                        </p>
                    </div>
                </div>
            </div>

            {/* Account Breakdown */}
            <div className="grid grid-cols-2 gap-6">
                {/* Bank Accounts */}
                <div className="bg-white rounded-2xl border p-5 shadow-sm">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Building2 size={18} className="text-blue-600" />
                        Bank Accounts
                    </h3>
                    <div className="space-y-3">
                        {bankAccounts.map((acc) => (
                            <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-sm">{acc.name}</p>
                                    <p className="text-xs text-gray-500">{acc.account_number}</p>
                                </div>
                                <p className="font-bold">₹{(acc.current_balance || 0).toLocaleString()}</p>
                            </div>
                        ))}
                        {bankAccounts.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">No bank accounts</p>
                        )}
                    </div>
                </div>

                {/* Cash Accounts */}
                <div className="bg-white rounded-2xl border p-5 shadow-sm">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Wallet size={18} className="text-green-600" />
                        Cash Registers
                    </h3>
                    <div className="space-y-3">
                        {cashAccounts.map((acc) => (
                            <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-sm">{acc.name}</p>
                                    <p className="text-xs text-gray-500">📍 {acc.location}</p>
                                </div>
                                <p className="font-bold">₹{(acc.current_balance || 0).toLocaleString()}</p>
                            </div>
                        ))}
                        {cashAccounts.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">No cash accounts</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Today's Transactions */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <h3 className="font-bold mb-4">Today&apos;s Transactions</h3>

                <div className="space-y-2">
                    {todayPayments.map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <ArrowDownRight className="text-green-600" size={18} />
                                <div>
                                    <p className="font-medium text-sm">{payment.clients?.name}</p>
                                    <p className="text-xs text-gray-500">{payment.payment_mode}</p>
                                </div>
                            </div>
                            <p className="font-bold text-green-600">+₹{payment.amount?.toLocaleString()}</p>
                        </div>
                    ))}

                    {todayExpenses.map((expense) => (
                        <div key={expense.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <ArrowUpRight className="text-red-600" size={18} />
                                <div>
                                    <p className="font-medium text-sm">{expense.vendors?.name}</p>
                                    <p className="text-xs text-gray-500">{expense.payment_mode}</p>
                                </div>
                            </div>
                            <p className="font-bold text-red-600">-₹{expense.amount?.toLocaleString()}</p>
                        </div>
                    ))}

                    {todayPayments.length === 0 && todayExpenses.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-8">No transactions today yet</p>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
                <Link
                    href="/admin/finance/payments?new=true"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl p-4 text-center font-medium"
                >
                    Record Payment
                </Link>
                <Link
                    href="/admin/finance/expenses/quick"
                    className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl p-4 text-center font-medium"
                >
                    Quick Expense
                </Link>
                <Link
                    href="/admin/finance/accounts"
                    className="bg-white border hover:bg-gray-50 rounded-xl p-4 text-center font-medium"
                >
                    Manage Accounts
                </Link>
            </div>
        </div>
    );
}
