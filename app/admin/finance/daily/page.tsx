'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Building2, ArrowDownRight, ArrowUpRight, Lock, Unlock, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import DashboardGrid, { LayoutsMap, resetLayouts } from '@/components/dashboard/DashboardGrid';

const STORAGE_KEY = 'aayam-finance-daily-layouts';

const DEFAULT_LAYOUTS: LayoutsMap = {
    lg: [
        { i: 'total-balance', x: 0, y: 0, w: 12, h: 3 },
        { i: 'todays-activity', x: 0, y: 3, w: 12, h: 3 },
        { i: 'bank-accounts', x: 0, y: 6, w: 6, h: 5 },
        { i: 'cash-accounts', x: 6, y: 6, w: 6, h: 5 },
        { i: 'todays-tx', x: 0, y: 11, w: 12, h: 5 },
        { i: 'quick-actions', x: 0, y: 16, w: 12, h: 2 },
    ],
    md: [
        { i: 'total-balance', x: 0, y: 0, w: 6, h: 3 },
        { i: 'todays-activity', x: 0, y: 3, w: 6, h: 3 },
        { i: 'bank-accounts', x: 0, y: 6, w: 6, h: 5 },
        { i: 'cash-accounts', x: 0, y: 11, w: 6, h: 5 },
        { i: 'todays-tx', x: 0, y: 16, w: 6, h: 5 },
        { i: 'quick-actions', x: 0, y: 21, w: 6, h: 2 },
    ],
    sm: [
        { i: 'total-balance', x: 0, y: 0, w: 2, h: 4 },
        { i: 'todays-activity', x: 0, y: 4, w: 2, h: 4 },
        { i: 'bank-accounts', x: 0, y: 8, w: 2, h: 5 },
        { i: 'cash-accounts', x: 0, y: 13, w: 2, h: 5 },
        { i: 'todays-tx', x: 0, y: 18, w: 2, h: 5 },
        { i: 'quick-actions', x: 0, y: 23, w: 2, h: 2 },
    ],
};

export default function DailyFinancePage() {
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [todayPayments, setTodayPayments] = useState<any[]>([]);
    const [todayExpenses, setTodayExpenses] = useState<any[]>([]);
    const [isLocked, setIsLocked] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: banks } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
            const { data: cash } = await supabase.from('cash_accounts').select('*').eq('is_active', true);
            const today = new Date().toISOString().split('T')[0];
            const { data: payments } = await supabase.from('payments_received').select('*, clients(name, company)').eq('payment_date', today);
            const { data: vendorPays } = await supabase.from('vendor_payments').select('*, vendors(name, company)').eq('payment_date', today);

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

    useEffect(() => { loadData(); }, []);

    const totalBanks = bankAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    const grandTotal = totalBanks + totalCash;
    const todayIncome = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const todayExpense = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netChange = todayIncome - todayExpense;

    return (
        <div className="space-y-4 animate-fade-in pb-16">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-page-title text-gray-900">Daily Finance Summary</h1>
                    <p className="text-gray-500">Real-time financial position</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold transition-colors" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    {!isLocked && (
                        <button onClick={() => { resetLayouts(STORAGE_KEY); window.location.reload(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                            <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                    )}
                    <button onClick={() => setIsLocked(!isLocked)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${isLocked ? 'border border-gray-200 hover:bg-gray-50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {isLocked ? 'Unlock' : 'Lock'}
                    </button>
                </div>
            </div>

            <DashboardGrid defaultLayouts={DEFAULT_LAYOUTS} isLocked={isLocked} storageKey={STORAGE_KEY}>
                {/* Total Balance Card */}
                <div key="total-balance" className="h-full">
                    <div className="bg-gray-900 rounded-lg p-4 text-white h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-sm opacity-90">Total Available Balance</p>
                                <p className="text-page-title mt-2">₹{grandTotal.toLocaleString()}</p>
                            </div>
                            <Link href="/admin/finance/accounts" className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-1">
                                <Wallet className="w-4 h-4" />Accounts →
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4" /><p className="text-sm opacity-90">Bank Accounts</p></div>
                                <p className="text-page-title">₹{totalBanks.toLocaleString()}</p>
                                <p className="text-xs opacity-75 mt-1">{bankAccounts.length} accounts</p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4" /><p className="text-sm opacity-90">Cash</p></div>
                                <p className="text-page-title">₹{totalCash.toLocaleString()}</p>
                                <p className="text-xs opacity-75 mt-1">{cashAccounts.length} registers</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Today's Activity */}
                <div key="todays-activity" className="h-full">
                    <div className="bg-white rounded-lg border p-4 h-full flex flex-col">
                        <h2 className="text-section mb-4 shrink-0">Today&apos;s Activity</h2>
                        <div className="grid grid-cols-3 gap-4 flex-1">
                            <div className="bg-white rounded-lg p-4">
                                <div className="flex items-center gap-2 text-gray-900 mb-2"><ArrowDownRight className="w-5 h-5" /><p className="text-sm font-medium">Money IN</p></div>
                                <p className="text-page-title text-gray-900">₹{todayIncome.toLocaleString()}</p>
                                <p className="text-xs text-gray-900 mt-1">{todayPayments.length} payments received</p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-600 mb-2"><ArrowUpRight className="w-5 h-5" /><p className="text-sm font-medium">Money OUT</p></div>
                                <p className="text-page-title text-red-700">₹{todayExpense.toLocaleString()}</p>
                                <p className="text-xs text-red-600 mt-1">{todayExpenses.length} payments made</p>
                            </div>
                            <div className={`rounded-lg p-4 ${netChange >= 0 ? 'bg-muted' : 'bg-orange-50'}`}>
                                <div className={`flex items-center gap-2 mb-2 ${netChange >= 0 ? 'text-foreground' : 'text-orange-600'}`}>
                                    <TrendingUp className="w-5 h-5" /><p className="text-sm font-medium">Net Change</p>
                                </div>
                                <p className={`text-page-title ${netChange >= 0 ? 'text-foreground' : 'text-orange-700'}`}>
                                    {netChange >= 0 ? '+' : ''}₹{netChange.toLocaleString()}
                                </p>
                                <p className={`text-xs mt-1 ${netChange >= 0 ? 'text-foreground' : 'text-orange-600'}`}>{netChange >= 0 ? 'Profit' : 'Loss'} today</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bank Accounts */}
                <div key="bank-accounts" className="h-full">
                    <div className="bg-white rounded-lg border p-5 h-full flex flex-col">
                        <h3 className="font-bold mb-4 flex items-center gap-2 shrink-0"><Building2 className="w-4 h-4" /> Bank Accounts</h3>
                        <div className="space-y-3 flex-1 overflow-y-auto">
                            {bankAccounts.map((acc) => (
                                <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div><p className="font-medium text-sm">{acc.name}</p><p className="text-xs text-gray-500">{acc.account_number}</p></div>
                                    <p className="font-bold">₹{(acc.current_balance || 0).toLocaleString()}</p>
                                </div>
                            ))}
                            {bankAccounts.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No bank accounts</p>}
                        </div>
                    </div>
                </div>

                {/* Cash Accounts */}
                <div key="cash-accounts" className="h-full">
                    <div className="bg-white rounded-lg border p-5 h-full flex flex-col">
                        <h3 className="font-bold mb-4 flex items-center gap-2 shrink-0"><Wallet className="w-4 h-4 text-gray-900" /> Cash Registers</h3>
                        <div className="space-y-3 flex-1 overflow-y-auto">
                            {cashAccounts.map((acc) => (
                                <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div><p className="font-medium text-sm">{acc.name}</p><p className="text-xs text-gray-500">📍 {acc.location}</p></div>
                                    <p className="font-bold">₹{(acc.current_balance || 0).toLocaleString()}</p>
                                </div>
                            ))}
                            {cashAccounts.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No cash accounts</p>}
                        </div>
                    </div>
                </div>

                {/* Today's Transactions */}
                <div key="todays-tx" className="h-full">
                    <div className="bg-white rounded-lg border p-5 h-full flex flex-col">
                        <h3 className="font-bold mb-4 shrink-0">Today&apos;s Transactions</h3>
                        <div className="space-y-2 flex-1 overflow-y-auto">
                            {todayPayments.map((payment) => (
                                <div key={payment.id} className="flex justify-between items-center p-3 bg-white rounded-lg">
                                    <div className="flex items-center gap-3"><ArrowDownRight className="w-4 h-4" /><div><p className="font-medium text-sm">{payment.clients?.name}</p><p className="text-xs text-gray-500">{payment.payment_mode}</p></div></div>
                                    <p className="font-bold text-gray-900">+₹{payment.amount?.toLocaleString()}</p>
                                </div>
                            ))}
                            {todayExpenses.map((expense) => (
                                <div key={expense.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                                    <div className="flex items-center gap-3"><ArrowUpRight className="text-red-600" size={18} /><div><p className="font-medium text-sm">{expense.vendors?.name}</p><p className="text-xs text-gray-500">{expense.payment_mode}</p></div></div>
                                    <p className="font-bold text-red-600">-₹{expense.amount?.toLocaleString()}</p>
                                </div>
                            ))}
                            {todayPayments.length === 0 && todayExpenses.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No transactions today yet</p>}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div key="quick-actions" className="h-full">
                    <div className="grid grid-cols-3 gap-4 h-full">
                        <Link href="/admin/finance/payments?new=true" className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg p-4 text-center font-semibold shadow-sm flex items-center justify-center">Record Payment</Link>
                        <Link href="/admin/finance/expenses/quick" className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg p-4 text-center font-medium flex items-center justify-center">Quick Expense</Link>
                        <Link href="/admin/finance/accounts" className="bg-white border hover:bg-gray-50 rounded-lg p-4 text-center font-medium flex items-center justify-center">Manage Accounts</Link>
                    </div>
                </div>
            </DashboardGrid>
        </div>
    );
}
