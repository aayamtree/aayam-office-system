'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, TrendingUp, Wallet, Building2, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import LoadError from '@/components/LoadError';
import StaleLedgerNotice from '@/components/finance/StaleLedgerNotice';

export default function DailyFinancePage() {
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [todayPayments, setTodayPayments] = useState<any[]>([]);
    const [todayExpenses, setTodayExpenses] = useState<any[]>([]);
    const [loadError, setLoadError] = useState<unknown>(null);

    const loadData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            // Each error is now checked and thrown. Previously all four were
            // dropped, so a failed fetch left this page showing ₹0 balances and
            // an empty day — indistinguishable from a genuinely quiet morning.
            // On the screen used to read the cash position, that is the most
            // expensive possible way to be wrong.
            const { data: banks, error: banksErr } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
            if (banksErr) throw banksErr;
            const { data: cash, error: cashErr } = await supabase.from('cash_accounts').select('*').eq('is_active', true);
            if (cashErr) throw cashErr;
            const today = new Date().toISOString().split('T')[0];
            const { data: payments, error: payErr } = await supabase.from('payments_received').select('*, clients(name, company)').eq('payment_date', today);
            if (payErr) throw payErr;
            const { data: vendorPays, error: vendErr } = await supabase.from('vendor_payments').select('*, vendors(name, company)').eq('payment_date', today);
            if (vendErr) throw vendErr;

            setBankAccounts(banks || []);
            setCashAccounts(cash || []);
            setTodayPayments(payments || []);
            setTodayExpenses(vendorPays || []);
        } catch (error) {
            console.error('Error loading data:', error);
            setLoadError(error);
            setBankAccounts([]);
            setCashAccounts([]);
            setTodayPayments([]);
            setTodayExpenses([]);
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
        <div className="space-y-4">
            <StaleLedgerNotice what="Today's cash figures" />

            {/* Shown above the figures, not instead of them: the totals below are
                computed from whatever loaded, so if anything failed they are wrong
                and the reader has to know that before acting on them. */}
            {loadError !== null && (
                <LoadError variant="inline" what="today's cash position" error={loadError} onRetry={loadData} />
            )}
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">Daily Finance Summary</h1>
                    <p className="text-sm text-muted-foreground">Real-time financial position</p>
                </div>
                <Button onClick={loadData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Total Balance */}
            <Card className="bg-primary text-primary-foreground">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm opacity-90">Total Available Balance</p>
                            <p className="text-2xl font-bold mt-1">₹{grandTotal.toLocaleString()}</p>
                        </div>
                        <Button variant="secondary" size="sm" asChild>
                            <Link href="/admin/finance/accounts" className="flex items-center gap-1">
                                <Wallet className="h-4 w-4" /> Accounts →
                            </Link>
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4" /><p className="text-sm opacity-90">Bank Accounts</p></div>
                            <p className="text-lg font-bold">₹{totalBanks.toLocaleString()}</p>
                            <p className="text-xs opacity-75 mt-1">{bankAccounts.length} accounts</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Today's Activity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Money IN</CardTitle>
                        <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{todayIncome.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">{todayPayments.length} payments received</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-destructive">Money OUT</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">₹{todayExpense.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">{todayExpenses.length} payments made</p>
                    </CardContent>
                </Card>
                <Card className={netChange >= 0 ? '' : 'border-destructive/30'}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Net Change</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netChange >= 0 ? '' : 'text-destructive'}`}>
                            {netChange >= 0 ? '+' : ''}₹{netChange.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{netChange >= 0 ? 'Profit' : 'Loss'} today</p>
                    </CardContent>
                </Card>
            </div>

            {/* Bank + Cash Accounts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Building2 className="h-4 w-4" /> Bank Accounts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {bankAccounts.map((acc) => (
                                <div key={acc.id} className="flex justify-between items-center p-3 rounded-md border hover:bg-muted/50 transition-colors">
                                    <div><p className="text-sm font-medium">{acc.name}</p><p className="text-xs text-muted-foreground">{acc.account_number}</p></div>
                                    <p className="text-sm font-semibold">₹{(acc.current_balance || 0).toLocaleString()}</p>
                                </div>
                            ))}
                            {bankAccounts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No bank accounts</p>}
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* Today's Transactions */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Today&apos;s Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {todayPayments.map((payment) => (
                            <div key={payment.id} className="flex justify-between items-center p-3 rounded-md border hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3"><ArrowDownRight className="h-4 w-4" /><div><p className="text-sm font-medium">{payment.clients?.name}</p><p className="text-xs text-muted-foreground">{payment.payment_mode}</p></div></div>
                                <p className="text-sm font-semibold">+₹{payment.amount?.toLocaleString()}</p>
                            </div>
                        ))}
                        {todayExpenses.map((expense) => (
                            <div key={expense.id} className="flex justify-between items-center p-3 rounded-md border border-destructive/20 bg-destructive/5">
                                <div className="flex items-center gap-3"><ArrowUpRight className="h-4 w-4 text-destructive" /><div><p className="text-sm font-medium">{expense.vendors?.name}</p><p className="text-xs text-muted-foreground">{expense.payment_mode}</p></div></div>
                                <p className="text-sm font-semibold text-destructive">-₹{expense.amount?.toLocaleString()}</p>
                            </div>
                        ))}
                        {todayPayments.length === 0 && todayExpenses.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No transactions today yet</p>}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
                <Button asChild className="h-auto py-3"><Link href="/admin/finance/payments?new=true">Record Payment</Link></Button>
                <Button variant="destructive" asChild className="h-auto py-3"><Link href="/admin/finance/expenses/quick">Quick Expense</Link></Button>
                <Button variant="outline" asChild className="h-auto py-3"><Link href="/admin/finance/accounts">Manage Accounts</Link></Button>
            </div>
        </div>
    );
}
