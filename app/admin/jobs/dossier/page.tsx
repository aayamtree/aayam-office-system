'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Search, FileText, Package, IndianRupee, Clock, CheckCircle,
    AlertTriangle, Loader2, TrendingUp, TrendingDown, Filter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DossierJob {
    id: string;
    job_number: string;
    project_name: string;
    quantity: number;
    actual_quantity?: number;
    product_category?: string;
    current_stage: string;
    priority: string;
    total_amount: number;
    base_price?: number;
    payment_status: string;
    amount_received: number;
    order_date: string;
    client_deadline?: string;
    completed_date?: string;
    files: any[];
    packing_info?: any;
    invoice_reference?: string;
    eway_bill_number?: string;
    client?: { company?: string; name?: string };
    vendor?: { name?: string; company?: string };
    invoices?: { id: string; total_amount: number }[];
}

interface PurchaseBill {
    job_id: string;
    total_amount: number;
}

const stageLabel: Record<string, string> = {
    new: 'New', awaiting_admin: 'Pending', designing: 'Designing',
    approval: 'Approval', printing: 'Printing', finishing: 'Finishing',
    quality_check: 'QC', ready: 'Ready', packed: 'Packed',
    dispatched: 'Dispatched', completed: 'Done', cancelled: 'Cancelled',
};

const stageColor: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', awaiting_admin: 'bg-orange-100 text-orange-700',
    designing: 'bg-violet-100 text-violet-700', approval: 'bg-amber-100 text-amber-700',
    printing: 'bg-gray-800 text-white', finishing: 'bg-cyan-100 text-cyan-700',
    quality_check: 'bg-indigo-100 text-indigo-700', ready: 'bg-green-100 text-green-700',
    packed: 'bg-teal-100 text-teal-700', dispatched: 'bg-gray-200 text-gray-700',
    completed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700',
};

export default function JobDossierPage() {
    const [jobs, setJobs] = useState<DossierJob[]>([]);
    const [expenses, setExpenses] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stageFilter, setStageFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // Fetch all jobs with client and invoice data
        const { data: jobsData } = await supabase
            .from('jobs')
            .select('id, job_number, project_name, quantity, actual_quantity, product_category, current_stage, priority, total_amount, base_price, payment_status, amount_received, order_date, client_deadline, completed_date, files, packing_info, invoice_reference, eway_bill_number, client:clients(company, name), vendor:vendors(name, company), invoices(id, total_amount)')
            .order('created_at', { ascending: false });

        if (jobsData) setJobs(jobsData as DossierJob[]);

        // Fetch purchase bills (expenses) grouped by job
        const { data: billsData } = await supabase
            .from('purchase_bills')
            .select('job_id, total_amount');

        if (billsData) {
            const expMap: Record<string, number> = {};
            (billsData as PurchaseBill[]).forEach(b => {
                if (b.job_id) {
                    expMap[b.job_id] = (expMap[b.job_id] || 0) + b.total_amount;
                }
            });
            setExpenses(expMap);
        }

        setLoading(false);
    };

    // Filter and search
    const filteredJobs = useMemo(() => {
        let result = jobs;

        if (stageFilter !== 'all') {
            result = result.filter(j => j.current_stage === stageFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(j =>
                j.job_number.toLowerCase().includes(q) ||
                j.project_name.toLowerCase().includes(q) ||
                (j.client?.company || j.client?.name || '').toLowerCase().includes(q) ||
                (j.product_category || '').toLowerCase().includes(q) ||
                (j.invoice_reference || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [jobs, searchQuery, stageFilter]);

    // Summary stats
    const totalRevenue = filteredJobs.reduce((s, j) => s + (j.total_amount || 0), 0);
    const totalExpenses = filteredJobs.reduce((s, j) => s + (expenses[j.id] || 0), 0);
    const totalProfit = totalRevenue - totalExpenses;

    const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin text-gray-400 w-6 h-6" />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-page-title text-gray-900 font-bold">Job Dossier</h1>
                <span className="text-sm text-gray-500">{filteredJobs.length} jobs</span>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by job number, client, project, product..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                </div>
                <select
                    value={stageFilter}
                    onChange={e => setStageFilter(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                    <option value="all">All Stages</option>
                    {Object.entries(stageLabel).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium">Revenue</p>
                    <p className="text-lg font-bold text-blue-900">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-xs text-red-600 font-medium">Expenses</p>
                    <p className="text-lg font-bold text-red-900">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className={`${totalProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} border rounded-lg p-3`}>
                    <p className={`text-xs font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totalProfit >= 0 ? 'Profit' : 'Loss'}
                    </p>
                    <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                        {formatCurrency(Math.abs(totalProfit))}
                    </p>
                </div>
            </div>

            {/* Job List */}
            <div className="space-y-2">
                {filteredJobs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm">No jobs found</div>
                ) : (
                    filteredJobs.map(job => {
                        const expense = expenses[job.id] || 0;
                        const profit = (job.total_amount || 0) - expense;
                        const hasInvoice = (job.invoices && job.invoices.length > 0) || !!job.invoice_reference;
                        const hasPacking = !!job.packing_info;

                        return (
                            <Link
                                key={job.id}
                                href={`/admin/jobs/${job.id}`}
                                className="block bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm rounded-lg p-4 transition-all"
                            >
                                {/* Row 1: Job ID + Status + Client */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-base font-bold text-gray-900">{job.job_number}</span>
                                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${stageColor[job.current_stage] || 'bg-gray-100 text-gray-700'}`}>
                                                {stageLabel[job.current_stage] || job.current_stage}
                                            </span>
                                            {job.priority !== 'normal' && (
                                                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 text-red-700 font-medium">{job.priority}</span>
                                            )}
                                            {hasInvoice && <span className="text-[10px] text-green-700 font-medium">📄 Invoice</span>}
                                            {job.eway_bill_number && <span className="text-[10px] text-green-700 font-medium">🧾 E-Way</span>}
                                        </div>
                                        <p className="text-sm text-gray-600 mt-0.5">{job.client?.company || job.client?.name}</p>
                                        <p className="text-sm text-gray-800 font-medium">{job.project_name}</p>
                                    </div>
                                    {/* Financial at top right */}
                                    <div className="text-right shrink-0">
                                        <p className="text-base font-bold text-gray-900">{formatCurrency(job.total_amount || 0)}</p>
                                        <p className={`text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {profit >= 0 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                                            {formatCurrency(Math.abs(profit))} {profit >= 0 ? 'profit' : 'loss'}
                                        </p>
                                    </div>
                                </div>

                                {/* Row 2: Key Details — Bold & Clear */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border-t border-gray-50 pt-2">
                                    <span className="text-gray-600">
                                        Qty: <span className="font-bold text-gray-900 text-sm">{job.quantity}</span>
                                    </span>
                                    {job.product_category && (
                                        <span className="text-gray-600">
                                            Product: <span className="font-semibold text-gray-900">{job.product_category}</span>
                                        </span>
                                    )}
                                    {hasPacking && (
                                        <span className="text-green-700 font-semibold flex items-center gap-1">
                                            <Package className="w-3 h-3" />
                                            {job.packing_info.package_count} {job.packing_info.package_type}(s) · ~{job.packing_info.approx_weight_kg}kg
                                        </span>
                                    )}
                                    {expense > 0 && (
                                        <span className="text-red-600">
                                            Expense: <span className="font-semibold">{formatCurrency(expense)}</span>
                                        </span>
                                    )}
                                    <span className="text-gray-500">
                                        Paid: <span className={`font-semibold ${job.amount_received >= job.total_amount ? 'text-green-700' : 'text-amber-600'}`}>
                                            {formatCurrency(job.amount_received || 0)}
                                        </span>
                                    </span>
                                    {job.client_deadline && (
                                        <span className="text-gray-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(job.client_deadline).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
