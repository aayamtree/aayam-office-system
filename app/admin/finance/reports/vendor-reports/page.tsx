'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Building2, Users, Briefcase, Calendar,
    Filter, Download, Loader2, TrendingUp, IndianRupee,
    ChevronDown, Printer
} from 'lucide-react';
import { useJobs, useVendors, useClients } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ViewMode = 'vendor' | 'client' | 'job_type';
type DateRange = 'all' | 'month' | 'quarter' | 'year';

export default function VendorReportsPage() {
    const { jobs, loading: jobsLoading } = useJobs();
    const { vendors, loading: vendorsLoading } = useVendors();
    const { clients, loading: clientsLoading } = useClients();

    const [viewMode, setViewMode] = useState<ViewMode>('vendor');
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [vendorFilter, setVendorFilter] = useState('all');
    const [clientFilter, setClientFilter] = useState('all');

    const loading = jobsLoading || vendorsLoading || clientsLoading;

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    // Filter jobs by date range
    const filteredJobs = useMemo(() => {
        let filtered = [...jobs];
        const now = new Date();

        if (dateRange === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            filtered = filtered.filter(j => new Date(j.order_date) >= start);
        } else if (dateRange === 'quarter') {
            const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            filtered = filtered.filter(j => new Date(j.order_date) >= qStart);
        } else if (dateRange === 'year') {
            const yStart = new Date(now.getFullYear(), 0, 1);
            filtered = filtered.filter(j => new Date(j.order_date) >= yStart);
        }

        if (vendorFilter !== 'all') {
            filtered = filtered.filter(j => j.vendor_id === vendorFilter);
        }
        if (clientFilter !== 'all') {
            filtered = filtered.filter(j => j.client_id === clientFilter);
        }

        return filtered;
    }, [jobs, dateRange, vendorFilter, clientFilter]);

    // Summary Stats
    const totalJobs = filteredJobs.length;
    const totalBilling = filteredJobs.reduce((sum, j) => sum + (j.total_amount || 0), 0);
    const totalReceived = filteredJobs.reduce((sum, j) => sum + (j.amount_received || 0), 0);
    const totalPending = totalBilling - totalReceived;

    // Group by Vendor
    const vendorData = useMemo(() => {
        const map = new Map<string, { vendor: any; jobs: typeof filteredJobs; totalAmount: number; totalReceived: number }>();
        filteredJobs.forEach(job => {
            if (!job.vendor_id) return;
            if (!map.has(job.vendor_id)) {
                const vendor = vendors.find(v => v.id === job.vendor_id);
                map.set(job.vendor_id, { vendor, jobs: [], totalAmount: 0, totalReceived: 0 });
            }
            const entry = map.get(job.vendor_id)!;
            entry.jobs.push(job);
            entry.totalAmount += job.total_amount || 0;
            entry.totalReceived += job.amount_received || 0;
        });
        return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [filteredJobs, vendors]);

    // Group by Client
    const clientData = useMemo(() => {
        const map = new Map<string, { client: any; jobs: typeof filteredJobs; totalAmount: number; vendorCount: number }>();
        filteredJobs.forEach(job => {
            if (!job.client_id) return;
            if (!map.has(job.client_id)) {
                const client = clients.find(c => c.id === job.client_id);
                map.set(job.client_id, { client, jobs: [], totalAmount: 0, vendorCount: 0 });
            }
            const entry = map.get(job.client_id)!;
            entry.jobs.push(job);
            entry.totalAmount += job.total_amount || 0;
        });
        // Count unique vendors per client
        map.forEach(entry => {
            const uniqueVendors = new Set(entry.jobs.filter(j => j.vendor_id).map(j => j.vendor_id));
            entry.vendorCount = uniqueVendors.size;
        });
        return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [filteredJobs, clients]);

    // Group by Job Type
    const jobTypeData = useMemo(() => {
        const map = new Map<string, { type: string; jobs: typeof filteredJobs; totalAmount: number; vendorCount: number; clientCount: number }>();
        filteredJobs.forEach(job => {
            const type = job.job_type || 'Unspecified';
            if (!map.has(type)) {
                map.set(type, { type, jobs: [], totalAmount: 0, vendorCount: 0, clientCount: 0 });
            }
            const entry = map.get(type)!;
            entry.jobs.push(job);
            entry.totalAmount += job.total_amount || 0;
        });
        map.forEach(entry => {
            entry.vendorCount = new Set(entry.jobs.filter(j => j.vendor_id).map(j => j.vendor_id)).size;
            entry.clientCount = new Set(entry.jobs.filter(j => j.client_id).map(j => j.client_id)).size;
        });
        return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [filteredJobs]);

    // Export CSV
    const handleExport = () => {
        let rows: string[][] = [];
        const header = ['Job #', 'Project', 'Client', 'Vendor', 'Job Type', 'Amount', 'Received', 'Date'];
        rows.push(header);
        filteredJobs.forEach(job => {
            rows.push([
                job.job_number || '',
                job.project_name || '',
                job.client?.name || '',
                vendors.find(v => v.id === job.vendor_id)?.name || '',
                job.job_type || '',
                String(job.total_amount || 0),
                String(job.amount_received || 0),
                job.order_date ? new Date(job.order_date).toLocaleDateString() : '',
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vendor_reports_${dateRange}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-44">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">Loading reports...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 px-2 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/admin/finance/reports" className="p-2 hover:bg-gray-100 rounded-md">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl lg:text-page-title text-gray-900">Vendor / Client Reports</h1>
                        <p className="text-sm text-gray-500">Vendor-client-job relationship analysis</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Jobs</p>
                    <p className="text-page-title text-gray-900">{totalJobs}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Billing</p>
                    <p className="text-page-title text-gray-900">{formatCurrency(totalBilling)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Received</p>
                    <p className="text-page-title text-green-700">{formatCurrency(totalReceived)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pending</p>
                    <p className="text-page-title text-red-600">{formatCurrency(totalPending)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-gray-100 flex flex-col sm:flex-row gap-3">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('vendor')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'vendor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                        <Building2 className="w-4 h-4 inline mr-1" />
                        By Vendor
                    </button>
                    <button
                        onClick={() => setViewMode('client')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'client' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                        <Users className="w-4 h-4 inline mr-1" />
                        By Client
                    </button>
                    <button
                        onClick={() => setViewMode('job_type')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'job_type' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                        <Printer className="w-4 h-4 inline mr-1" />
                        By Job Type
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 flex-1 justify-end">
                    <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                        <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                            <Calendar className="w-4 h-4 mr-1" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="quarter">This Quarter</SelectItem>
                            <SelectItem value="year">This Year</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={vendorFilter} onValueChange={setVendorFilter}>
                        <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                            <SelectValue placeholder="All Vendors" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Vendors</SelectItem>
                            {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={clientFilter} onValueChange={setClientFilter}>
                        <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                            <SelectValue placeholder="All Clients" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Clients</SelectItem>
                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Data Tables */}
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    {/* By Vendor View */}
                    {viewMode === 'vendor' && (
                        <table className="w-full min-w-[700px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Jobs</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Amount</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Received</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pending</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Clients</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {vendorData.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No vendor data found for the selected filters.</td></tr>
                                ) : vendorData.map((entry, idx) => {
                                    const uniqueClients = Array.from(new Set(entry.jobs.map(j => j.client?.name).filter(Boolean)));
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                                        <Building2 className="w-4 h-4 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{entry.vendor?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-gray-500">{entry.vendor?.category || ''}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-gray-100 px-2.5 py-1 rounded-md text-sm font-medium">{entry.jobs.length}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(entry.totalAmount)}</td>
                                            <td className="px-4 py-3 text-right text-green-700">{formatCurrency(entry.totalReceived)}</td>
                                            <td className="px-4 py-3 text-right text-red-600">{formatCurrency(entry.totalAmount - entry.totalReceived)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {uniqueClients.slice(0, 3).map((name, i) => (
                                                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{name}</span>
                                                    ))}
                                                    {uniqueClients.length > 3 && (
                                                        <span className="text-xs text-gray-400">+{uniqueClients.length - 3} more</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* By Client View */}
                    {viewMode === 'client' && (
                        <table className="w-full min-w-[700px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Jobs</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vendors Used</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Amount</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Job Types</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {clientData.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">No client data found for the selected filters.</td></tr>
                                ) : clientData.map((entry, idx) => {
                                    const jobTypes = Array.from(new Set(entry.jobs.map(j => j.job_type).filter(Boolean)));
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <Users className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{entry.client?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-gray-500">{entry.client?.company || ''}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-gray-100 px-2.5 py-1 rounded-md text-sm font-medium">{entry.jobs.length}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-sm font-medium">{entry.vendorCount}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(entry.totalAmount)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {jobTypes.slice(0, 3).map((type, i) => (
                                                        <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">{type}</span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* By Job Type View */}
                    {viewMode === 'job_type' && (
                        <table className="w-full min-w-[700px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Job Type</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Jobs</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vendors</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Clients</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {jobTypeData.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">No job type data found for the selected filters.</td></tr>
                                ) : jobTypeData.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                                    <Printer className="w-4 h-4 text-purple-600" />
                                                </div>
                                                <p className="font-medium text-gray-900">{entry.type}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-gray-100 px-2.5 py-1 rounded-md text-sm font-medium">{entry.jobs.length}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-sm font-medium">{entry.vendorCount}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-sm font-medium">{entry.clientCount}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(entry.totalAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
