'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Search, FileText, Package, IndianRupee, Clock, CheckCircle,
    AlertTriangle, Loader2, TrendingUp, TrendingDown, Download,
    RefreshCw, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DossierJob {
    id: string;
    job_number: string;
    project_name: string;
    quantity: number;
    product_category?: string;
    current_stage: string;
    priority: string;
    total_amount: number;
    payment_status: string;
    amount_received: number;
    order_date: string;
    client_deadline?: string;
    completed_date?: string;
    packing_info?: any;
    invoice_reference?: string;
    eway_bill_number?: string;
    client?: { id?: string; company?: string; name?: string };
}

interface DossierClient {
    id: string;
    company?: string;
    name?: string;
}

const stageLabel: Record<string, string> = {
    new: 'New', awaiting_admin: 'Pending', designing: 'Designing',
    approval: 'Approval', printing: 'Printing', finishing: 'Finishing',
    quality_check: 'QC', ready: 'Ready', packed: 'Packed',
    dispatched: 'Dispatched', delivered: 'Delivered', completed: 'Done', cancelled: 'Cancelled',
};

const stageColor: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', awaiting_admin: 'bg-orange-100 text-orange-700',
    designing: 'bg-violet-100 text-violet-700', approval: 'bg-amber-100 text-amber-700',
    printing: 'bg-gray-800 text-white', finishing: 'bg-cyan-100 text-cyan-700',
    quality_check: 'bg-indigo-100 text-indigo-700', ready: 'bg-green-100 text-green-700',
    packed: 'bg-teal-100 text-teal-700', dispatched: 'bg-gray-200 text-gray-700',
    delivered: 'bg-emerald-100 text-emerald-700', completed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700',
};

interface PurchaseBill {
    job_id: string;
    total_amount: number;
}

const COMPLETED_STAGES = ['dispatched', 'delivered', 'completed'];

function getPaymentBadge(job: DossierJob) {
    const total = job.total_amount || 0;
    const received = job.amount_received || 0;
    if (total === 0) return null;
    if (received >= total) return { label: '✅ Paid', cls: 'bg-emerald-100 text-emerald-700' };
    if (received > 0) return { label: `⚠️ Partial (${Math.round((received / total) * 100)}%)`, cls: 'bg-amber-100 text-amber-700' };
    return { label: '❌ Unpaid', cls: 'bg-red-100 text-red-700' };
}

function getTurnaround(orderDate: string, completedDate?: string): string | null {
    if (!completedDate || !orderDate) return null;
    const days = Math.round((new Date(completedDate).getTime() - new Date(orderDate).getTime()) / 86400000);
    if (days < 0) return null;
    return `${days}d`;
}

function exportCSV(jobs: DossierJob[], expenses: Record<string, number>) {
    const headers = ['Job #', 'Client', 'Project', 'Product', 'Stage', 'Qty', 'Order Date', 'Completed Date', 'Turnaround', 'Revenue (₹)', 'Expenses (₹)', 'Profit (₹)', 'Received (₹)', 'Payment Status', 'Invoice Ref', 'E-way Bill'];
    const rows = jobs.map(j => {
        const exp = expenses[j.id] || 0;
        const profit = (j.total_amount || 0) - exp;
        const ta = getTurnaround(j.order_date, j.completed_date) || '';
        return [
            j.job_number,
            j.client?.company || j.client?.name || '',
            j.project_name,
            j.product_category || '',
            stageLabel[j.current_stage] || j.current_stage,
            j.quantity,
            j.order_date ? new Date(j.order_date).toLocaleDateString('en-IN') : '',
            j.completed_date ? new Date(j.completed_date).toLocaleDateString('en-IN') : '',
            ta,
            j.total_amount || 0,
            exp,
            profit,
            j.amount_received || 0,
            j.payment_status || '',
            j.invoice_reference || '',
            j.eway_bill_number || '',
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-dossier-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function JobDossierPage() {
    const [jobs, setJobs] = useState<DossierJob[]>([]);
    const [allClients, setAllClients] = useState<DossierClient[]>([]);
    const [expenses, setExpenses] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [stageFilter, setStageFilter] = useState('all'); // IMP-8: default to All instead of dispatched/delivered
    const [clientFilter, setClientFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        // Simple query — no potentially-broken JOINs like invoices
        const { data: jobsData, error: jobsErr } = await supabase
            .from('jobs')
            .select(`
                id, job_number, project_name, quantity,
                product_category, current_stage, priority, total_amount,
                payment_status, amount_received, order_date, client_deadline,
                completed_date, packing_info, invoice_reference, eway_bill_number,
                client:clients(id, company, name)
            `)
            .order('completed_date', { ascending: false, nullsFirst: false });

        if (jobsErr) {
            console.error('Dossier fetch error:', jobsErr);
            setError(jobsErr.message);
            setLoading(false);
            return;
        }

        if (jobsData) setJobs(jobsData as DossierJob[]);

        // Fetch ALL clients separately (not derived from jobs)
        try {
            const { data: clientsData } = await supabase
                .from('clients')
                .select('id, company, name')
                .eq('is_active', true)
                .order('company', { nullsFirst: false });
            if (clientsData) setAllClients(clientsData as DossierClient[]);
        } catch { /* ignore */ }

        // Expenses from purchase_bills — isolated so a missing table doesn't break everything
        try {
            const { data: billsData } = await supabase
                .from('purchase_bills')
                .select('job_id, total_amount');
            if (billsData) {
                const expMap: Record<string, number> = {};
                billsData.forEach((b: any) => {
                    if (b.job_id) expMap[b.job_id] = (expMap[b.job_id] || 0) + (b.total_amount || 0);
                });
                setExpenses(expMap);
            }
        } catch { /* purchase_bills may not exist — ignore */ }

        setLoading(false);
    };

    // Deduplicated client list from ALL clients (not just from jobs)
    const clientsForFilter = useMemo(() => {
        return allClients
            .map(c => ({ id: c.id, label: c.company || c.name || c.id }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [allClients]);

    // Unique months (based on order_date)
    const uniqueMonths = useMemo(() => {
        const seen = new Set<string>();
        jobs.forEach(j => {
            if (j.order_date) {
                const m = j.order_date.slice(0, 7); // "2026-02"
                seen.add(m);
            }
        });
        return Array.from(seen).sort().reverse();
    }, [jobs]);

    const filteredJobs = useMemo(() => {
        let result = jobs;

        // Stage filter
        const ACTIVE_STAGES = ['new', 'awaiting_admin', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready', 'packed', 'pre_print_qc'];
        if (stageFilter === 'active_only') {
            result = result.filter(j => ACTIVE_STAGES.includes(j.current_stage));
        } else if (stageFilter === 'completed_dispatched') {
            result = result.filter(j => COMPLETED_STAGES.includes(j.current_stage));
        } else if (stageFilter !== 'all') {
            result = result.filter(j => j.current_stage === stageFilter);
        }

        // Client filter
        if (clientFilter !== 'all') {
            result = result.filter(j => j.client?.id === clientFilter);
        }

        // Month filter
        if (monthFilter !== 'all') {
            result = result.filter(j => j.order_date?.startsWith(monthFilter));
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(j =>
                (j.job_number || '').toLowerCase().includes(q) ||
                (j.project_name || '').toLowerCase().includes(q) ||
                (j.client?.company || j.client?.name || '').toLowerCase().includes(q) ||
                (j.product_category || '').toLowerCase().includes(q) ||
                (j.invoice_reference || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [jobs, searchQuery, stageFilter, clientFilter, monthFilter]);

    // Summary stats
    const totalRevenue = filteredJobs.reduce((s, j) => s + (j.total_amount || 0), 0);
    const totalExpenses = filteredJobs.reduce((s, j) => s + (expenses[j.id] || 0), 0);
    const totalProfit = totalRevenue - totalExpenses;
    const totalReceived = filteredJobs.reduce((s, j) => s + (j.amount_received || 0), 0);
    const totalPending = totalRevenue - totalReceived;

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    const formatMonth = (m: string) => {
        const [y, mo] = m.split('-');
        const d = new Date(parseInt(y), parseInt(mo) - 1);
        return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin text-gray-400 w-6 h-6" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                <p className="text-red-600 font-medium">Failed to load jobs</p>
                <p className="text-sm text-gray-500">{error}</p>
                <button onClick={fetchData} className="btn-primary text-sm px-4 py-2">Try Again</button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-page-title text-gray-900 font-bold flex items-center gap-2">
                        <FileText size={20} /> Job Dossier
                    </h1>
                    <p className="text-sm text-gray-500">{filteredJobs.length} jobs shown</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={13} /> Refresh
                    </button>
                    <button
                        onClick={() => exportCSV(filteredJobs, expenses)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                    >
                        <Download size={13} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {/* Search */}
                <div className="relative sm:col-span-2 lg:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Job #, client, product..."
                        autoComplete="off"
                        name="dossier-search"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                </div>
                {/* Stage */}
                <select
                    value={stageFilter}
                    onChange={e => setStageFilter(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    <option value="completed_dispatched">✅ Dispatched & Delivered</option>
                    <option value="all">All Stages</option>
                    {Object.entries(stageLabel).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                {/* Client */}
                <select
                    value={clientFilter}
                    onChange={e => setClientFilter(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    <option value="all">All Clients</option>
                    {clientsForFilter.map(({ id, label }: { id: string; label: string }) => (
                        <option key={id} value={id}>{label}</option>
                    ))}
                </select>
                {/* Month */}
                <select
                    value={monthFilter}
                    onChange={e => setMonthFilter(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    <option value="all">All Months</option>
                    {uniqueMonths.map(m => (
                        <option key={m} value={m}>{formatMonth(m)}</option>
                    ))}
                </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                    <p className="text-xs text-blue-600 font-medium">Revenue</p>
                    <p className="text-lg font-bold text-blue-900">{formatCurrency(totalRevenue)}</p>
                    <p className="text-xs text-blue-500 mt-0.5">{filteredJobs.length} jobs</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
                    <p className="text-xs text-amber-600 font-medium">Pending Payment</p>
                    <p className="text-lg font-bold text-amber-900">{formatCurrency(Math.max(0, totalPending))}</p>
                    <p className="text-xs text-amber-500 mt-0.5">Received: {formatCurrency(totalReceived)}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-md p-3">
                    <p className="text-xs text-red-600 font-medium">Expenses</p>
                    <p className="text-lg font-bold text-red-900">{formatCurrency(totalExpenses)}</p>
                    <p className="text-xs text-red-400 mt-0.5">From purchase bills</p>
                </div>
                <div className={`${totalProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} border rounded-md p-3`}>
                    <p className={`text-xs font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totalProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                    </p>
                    <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                        {formatCurrency(Math.abs(totalProfit))}
                    </p>
                    {totalRevenue > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                            {Math.round((Math.abs(totalProfit) / totalRevenue) * 100)}% margin
                        </p>
                    )}
                </div>
            </div>

            {/* Job List */}
            <div className="space-y-2">
                {filteredJobs.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-gray-100 rounded-md">
                        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 font-medium">No jobs found</p>
                        <p className="text-sm text-gray-400 mt-1">Try changing the stage or date filter</p>
                    </div>
                ) : (
                    filteredJobs.map(job => {
                        const expense = expenses[job.id] || 0;
                        const profit = (job.total_amount || 0) - expense;
                        const payBadge = getPaymentBadge(job);
                        const turnaround = getTurnaround(job.order_date, job.completed_date);
                        const hasPacking = !!job.packing_info;

                        return (
                            <Link
                                key={job.id}
                                href={`/admin/jobs/${job.id}`}
                                className="block bg-white border border-gray-100 hover:border-primary/40 hover:shadow-sm rounded-md p-4 transition-all"
                            >
                                {/* Row 1: Job # + Stage + Client */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-base font-bold text-gray-900">{job.job_number}</span>
                                            <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${stageColor[job.current_stage] || 'bg-gray-100 text-gray-700'}`}>
                                                {stageLabel[job.current_stage] || job.current_stage}
                                            </span>
                                            {job.priority !== 'normal' && (
                                                <span className="px-1.5 py-0.5 text-xs rounded-md bg-red-100 text-red-700 font-medium uppercase">{job.priority}</span>
                                            )}
                                            {payBadge && (
                                                <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${payBadge.cls}`}>{payBadge.label}</span>
                                            )}
                                            {job.invoice_reference && <span className="text-xs text-green-700 font-medium">📄 {job.invoice_reference}</span>}
                                            {job.eway_bill_number && <span className="text-xs text-blue-700 font-medium">🧾 E-Way</span>}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5">{job.client?.company || job.client?.name}</p>
                                        <p className="text-sm text-gray-800 font-medium">{job.project_name}</p>
                                    </div>
                                    {/* Financial */}
                                    <div className="text-right shrink-0">
                                        <p className="text-base font-bold text-gray-900">{formatCurrency(job.total_amount || 0)}</p>
                                        {expense > 0 && (
                                            <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                {formatCurrency(Math.abs(profit))} {profit >= 0 ? 'profit' : 'loss'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Details */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 border-t border-gray-50 pt-2">
                                    <span>Qty: <span className="font-bold text-gray-900">{job.quantity}</span></span>
                                    {job.product_category && (
                                        <span>Product: <span className="font-semibold text-gray-700">{job.product_category}</span></span>
                                    )}
                                    {job.order_date && (
                                        <span className="flex items-center gap-1">
                                            <Calendar size={11} />
                                            Ordered: {new Date(job.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    )}
                                    {job.completed_date && (
                                        <span className="flex items-center gap-1 text-emerald-600">
                                            <CheckCircle size={11} />
                                            Done: {new Date(job.completed_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                        </span>
                                    )}
                                    {turnaround && (
                                        <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                            <Clock size={11} /> {turnaround} turnaround
                                        </span>
                                    )}
                                    {hasPacking && (
                                        <span className="text-teal-700 font-semibold flex items-center gap-1">
                                            <Package className="w-3 h-3" />
                                            {job.packing_info.package_count} {job.packing_info.package_type}(s) · ~{job.packing_info.approx_weight_kg}kg
                                        </span>
                                    )}
                                    {expense > 0 && (
                                        <span className="text-red-500">
                                            Exp: <span className="font-semibold">{formatCurrency(expense)}</span>
                                        </span>
                                    )}
                                    <span>
                                        Paid: <span className={`font-semibold ${(job.amount_received || 0) >= (job.total_amount || 0) ? 'text-green-700' : 'text-amber-600'}`}>
                                            {formatCurrency(job.amount_received || 0)}
                                        </span>
                                    </span>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
