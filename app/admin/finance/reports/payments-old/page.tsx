'use client';

// ARCHIVED 2026-09-02 (phase 4). This screen was /admin/finance/reports until
// the Reports door took that address. It reads the app's own ledger —
// payments_received, expenses, bank_transactions — all of which stopped moving
// on 5 August 2026 when Zoho became the book of record. It is kept, unchanged
// and reachable, so July's figures stay readable. Nothing here is current.


import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, IndianRupee, TrendingUp, Users, Briefcase,
    Calendar, Filter, Download, Loader2
} from 'lucide-react';
import { usePaymentsReceived, useJobs, useClients, useExpenses, useBankTransactions } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StaleLedgerNotice from '@/components/finance/StaleLedgerNotice';

export default function PaymentReportsPage() {
    const { profile } = useAuth();
    const { paymentsReceived: payments, loading: paymentsLoading } = usePaymentsReceived();
    const { jobs, loading: jobsLoading } = useJobs();
    const { clients } = useClients();
    const { expenses } = useExpenses();
    const { transactions: bankTransactions } = useBankTransactions();

    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(1); // First of current month
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'summary' | 'client' | 'job' | 'outstanding'>('summary');

    const loading = paymentsLoading || jobsLoading;

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    // Filter payments by date range
    const filteredPayments = useMemo(() => {
        return (payments || []).filter(p => {
            const date = p.payment_date || p.created_at;
            return date >= dateFrom && date <= dateTo + 'T23:59:59';
        });
    }, [payments, dateFrom, dateTo]);

    // Monthly Summary
    const summary = useMemo(() => {
        let totalCollected = 0;
        let cashTotal = 0;
        let bankTotal = 0;
        let upiTotal = 0;
        let chequeTotal = 0;
        let gstAmount = 0;

        filteredPayments.forEach(p => {
            const amt = p.amount || 0;
            totalCollected += amt;

            const mode = (p.payment_mode || '').toLowerCase();
            if (mode === 'cash') cashTotal += amt;
            else if (mode === 'bank_transfer' || mode === 'bank') bankTotal += amt;
            else if (mode === 'upi') upiTotal += amt;
            else if (mode === 'cheque') chequeTotal += amt;
            else bankTotal += amt; // default to bank

            if (p.has_gst) {
                gstAmount += amt * 0.18 / 1.18; // Extract GST from inclusive amount
            }
        });

        const manualExpenses = (expenses || [])
            .filter(e => {
                const date = e.expense_date || e.created_at;
                return date >= dateFrom && date <= dateTo + 'T23:59:59';
            })
            .reduce((s, e) => s + (e.amount || 0), 0);

        // Bank-verified expenses (salary, rent, utilities etc.)
        const bankExpenses = (bankTransactions || [])
            .filter(t => t.is_verified && t.categorization_type === 'expense' && t.transaction_type === 'outflow')
            .filter(t => {
                const date = (t.transaction_date || '').split('T')[0];
                return date >= dateFrom && date <= dateTo;
            })
            .reduce((s: number, t: any) => s + (t.amount || 0), 0);

        const totalExpenses = manualExpenses + bankExpenses;

        return { totalCollected, cashTotal, bankTotal, upiTotal, chequeTotal, gstAmount, totalExpenses, bankExpenses, manualExpenses };
    }, [filteredPayments, expenses, bankTransactions, dateFrom, dateTo]);

    // Client-wise collections
    const clientCollections = useMemo(() => {
        const map = new Map<string, { name: string; company: string; total: number; count: number }>();

        filteredPayments.forEach(p => {
            const clientId = p.client_id || 'unknown';
            const client = (clients || []).find(c => c.id === clientId);
            const existing = map.get(clientId) || {
                name: client?.company || client?.name || 'Unknown',
                company: client?.company || '',
                total: 0,
                count: 0,
            };
            existing.total += p.amount || 0;
            existing.count += 1;
            map.set(clientId, existing);
        });

        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [filteredPayments, clients]);

    // Job-wise profitability
    const jobProfitability = useMemo(() => {
        return (jobs || [])
            .filter(j => j.total_amount > 0)
            .map(j => {
                const jobExpenses = (expenses || [])
                    .filter(e => e.job_id === j.id)
                    .reduce((s, e) => s + (e.amount || 0), 0);

                return {
                    id: j.id,
                    jobNumber: j.job_number,
                    projectName: j.project_name,
                    clientName: (j.client as any)?.company || j.client?.name || 'Unknown',
                    totalAmount: j.total_amount,
                    received: j.amount_received || 0,
                    expenses: jobExpenses,
                    profit: (j.amount_received || 0) - jobExpenses,
                    stage: j.current_stage,
                };
            })
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 50);
    }, [jobs, expenses]);

    // Outstanding clients
    const outstandingClients = useMemo(() => {
        return (clients || [])
            .filter(c => (c.outstanding_balance || 0) > 0)
            .map(c => ({
                id: c.id,
                name: c.company || c.name,
                company: c.company ? c.name : '',
                outstanding: c.outstanding_balance || 0,
                jobCount: (jobs || []).filter(j => j.client_id === c.id).length,
            }))
            .sort((a, b) => b.outstanding - a.outstanding);
    }, [clients, jobs]);

    const tabs = [
        { id: 'summary', label: 'Monthly Summary', icon: TrendingUp },
        { id: 'client', label: 'Client-wise', icon: Users },
        { id: 'job', label: 'Job Profitability', icon: Briefcase },
        { id: 'outstanding', label: 'Outstanding', icon: IndianRupee },
    ] as const;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-44">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6">
            <StaleLedgerNotice what="These reports" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-md">
                        <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </Link>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Payment Reports</h1>
                        <p className="text-sm text-gray-500">Financial analytics and collection reports</p>
                    </div>
                </div>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-3 bg-white p-3 rounded-md border border-gray-100">
                <Calendar className="w-4 h-4 text-gray-400" />
                <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="max-w-[160px]"
                />
                <span className="text-sm text-gray-400">to</span>
                <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="max-w-[160px]"
                />
                <span className="text-xs text-gray-400 ml-auto">
                    {filteredPayments.length} payments
                </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-md overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'summary' && (
                <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-md border border-gray-100 p-4">
                            <p className="text-xs text-gray-500 mb-1">Total Collected</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalCollected)}</p>
                        </div>
                        <div className="bg-white rounded-md border border-gray-100 p-4">
                            <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
                            <p className="text-lg font-bold text-red-600">{formatCurrency(summary.totalExpenses)}</p>
                        </div>
                        <div className="bg-white rounded-md border border-gray-100 p-4">
                            <p className="text-xs text-gray-500 mb-1">Net Profit</p>
                            <p className={`text-lg font-bold ${summary.totalCollected - summary.totalExpenses >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {formatCurrency(summary.totalCollected - summary.totalExpenses)}
                            </p>
                        </div>
                        <div className="bg-white rounded-md border border-gray-100 p-4">
                            <p className="text-xs text-gray-500 mb-1">GST Collected</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.gstAmount)}</p>
                        </div>
                    </div>

                    {/* Payment Mode Breakdown */}
                    <div className="bg-white rounded-md border border-gray-100 p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Collection by Payment Mode</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Cash', amount: summary.cashTotal, color: 'bg-green-500' },
                                { label: 'Bank Transfer', amount: summary.bankTotal, color: 'bg-blue-500' },
                                { label: 'UPI', amount: summary.upiTotal, color: 'bg-purple-500' },
                                { label: 'Cheque', amount: summary.chequeTotal, color: 'bg-amber-500' },
                            ].filter(m => m.amount > 0).map(mode => (
                                <div key={mode.label} className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${mode.color}`} />
                                    <span className="text-sm text-gray-700 w-32">{mode.label}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${mode.color} transition-all`}
                                            style={{ width: `${summary.totalCollected > 0 ? (mode.amount / summary.totalCollected) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 w-28 text-right">{formatCurrency(mode.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'client' && (
                <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-600">Client</th>
                                <th className="text-right p-3 font-semibold text-gray-600">Payments</th>
                                <th className="text-right p-3 font-semibold text-gray-600">Total Collected</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {clientCollections.map((c, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="p-3">
                                        <p className="font-medium text-gray-900">{c.name}</p>
                                        <p className="text-xs text-gray-400">{c.company}</p>
                                    </td>
                                    <td className="p-3 text-right text-gray-500">{c.count}</td>
                                    <td className="p-3 text-right font-semibold text-gray-900">{formatCurrency(c.total)}</td>
                                </tr>
                            ))}
                            {clientCollections.length === 0 && (
                                <tr><td colSpan={3} className="p-6 text-center text-gray-400">No payments in this period</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'job' && (
                <div className="bg-white rounded-md border border-gray-100 overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-600">Job</th>
                                <th className="text-right p-3 font-semibold text-gray-600">Billed</th>
                                <th className="text-right p-3 font-semibold text-gray-600">Received</th>
                                <th className="text-right p-3 font-semibold text-gray-600">Expenses</th>
                                <th className="text-right p-3 font-semibold text-gray-600">Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {jobProfitability.map(j => (
                                <tr key={j.id} className="hover:bg-gray-50">
                                    <td className="p-3">
                                        <p className="font-medium text-gray-900">{j.projectName}</p>
                                        <p className="text-xs text-gray-400">{j.jobNumber} • {j.clientName}</p>
                                    </td>
                                    <td className="p-3 text-right text-gray-700">{formatCurrency(j.totalAmount)}</td>
                                    <td className="p-3 text-right text-green-700">{formatCurrency(j.received)}</td>
                                    <td className="p-3 text-right text-red-600">{formatCurrency(j.expenses)}</td>
                                    <td className={`p-3 text-right font-semibold ${j.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                        {formatCurrency(j.profit)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'outstanding' && (
                <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-100 rounded-md p-4 flex items-center justify-between">
                        <span className="text-sm text-amber-800 font-medium">Total Outstanding</span>
                        <span className="text-lg font-bold text-amber-900">
                            {formatCurrency(outstandingClients.reduce((s, c) => s + c.outstanding, 0))}
                        </span>
                    </div>

                    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-gray-600">Client</th>
                                    <th className="text-right p-3 font-semibold text-gray-600">Jobs</th>
                                    <th className="text-right p-3 font-semibold text-gray-600">Outstanding</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {outstandingClients.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="p-3">
                                            <p className="font-medium text-gray-900">{c.name}</p>
                                            <p className="text-xs text-gray-400">{c.company}</p>
                                        </td>
                                        <td className="p-3 text-right text-gray-500">{c.jobCount}</td>
                                        <td className="p-3 text-right font-semibold text-red-600">{formatCurrency(c.outstanding)}</td>
                                    </tr>
                                ))}
                                {outstandingClients.length === 0 && (
                                    <tr><td colSpan={3} className="p-6 text-center text-gray-400">No outstanding balances</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
