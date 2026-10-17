'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Building2, Users, Calendar,
    Download, Loader2,
    ChevronDown, ChevronRight, Printer
} from 'lucide-react';
import { useJobs, useVendors, useClients } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProjectTypeLabel } from '@/lib/job-workflow';

type ViewMode = 'vendor' | 'client' | 'job_type';
type DateRange = 'all' | 'month' | 'quarter' | 'year';

export default function VendorReportsPage() {
    // A vendor report needs vendor_id to group by and order_date for the CSV
    // export — neither is in the default select, so jobs grouped into nothing and
    // the date column exported blank. The 50-row default also truncated the report.
    const { jobs, loading: jobsLoading } = useJobs({
        select: 'id, job_number, project_name, client_id, vendor_id, current_stage, job_type, order_date, total_amount, amount_received, payment_status, client:clients(id, name, company)',
        limit: 2000,
    });
    const { vendors, loading: vendorsLoading } = useVendors();
    const { clients, loading: clientsLoading } = useClients();

    // jobs.vendor_id is filled on only a handful of jobs, but most jobs sit on a
    // print run, and every print run has a printer (vendor). No job is on runs with
    // two different printers, so a job's vendor can be read from its print run
    // without double counting. jobs.vendor_id still wins when it is set.
    //
    // Purchase bills and vendor payments are not tied to a job (bills carry no
    // job_id), so they are shown beside the jobs, per vendor, never summed into them.
    const [printVendorByJob, setPrintVendorByJob] = useState<Record<string, string>>({});
    const [bills, setBills] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [extraLoading, setExtraLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [runJobs, billRes, payRes] = await Promise.all([
                supabase.from('print_run_jobs').select('job_id, print_run:print_runs(vendor_id)').limit(5000),
                supabase.from('purchase_bills')
                    .select('id, bill_number, vendor_bill_number, vendor_id, bill_date, total_amount, amount_paid, payment_status')
                    .limit(5000),
                supabase.from('vendor_payments')
                    .select('id, payment_number, vendor_id, payment_date, amount, payment_mode')
                    .limit(5000),
            ]);
            if (cancelled) return;
            if (!runJobs.error && runJobs.data) {
                const map: Record<string, string> = {};
                (runJobs.data as any[]).forEach(r => {
                    const run = Array.isArray(r.print_run) ? r.print_run[0] : r.print_run;
                    if (r.job_id && run?.vendor_id) map[r.job_id] = run.vendor_id;
                });
                setPrintVendorByJob(map);
            }
            if (!billRes.error && billRes.data) setBills(billRes.data as any[]);
            if (!payRes.error && payRes.data) setPayments(payRes.data as any[]);
            setExtraLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    // Two vendors can be entered twice under the same name (e.g. "Nem's" as both
    // Printing and Paper). Everything below works on the oldest record of each name,
    // so a duplicate never shows up as a second row. Nothing in the database changes.
    const canon = useMemo(() => {
        const firstByName = new Map<string, string>();
        const map: Record<string, string> = {};
        [...vendors]
            .sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
            .forEach((v: any) => {
                const key = (v.name || '').trim().toLowerCase();
                if (!firstByName.has(key)) firstByName.set(key, v.id);
                map[v.id] = firstByName.get(key)!;
            });
        return map;
    }, [vendors]);
    const canonOf = (id?: string | null) => (id ? (canon[id] || id) : null);

    const jobsWithVendor = useMemo(
        () => jobs.map(j => ({ ...j, vendor_id: canonOf(j.vendor_id || printVendorByJob[j.id]) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [jobs, printVendorByJob, canon]
    );

    const [open, setOpen] = useState<Set<string>>(new Set());
    const toggle = (key: string) =>
        setOpen(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    const [viewMode, setViewMode] = useState<ViewMode>('vendor');
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [vendorFilter, setVendorFilter] = useState('all');
    const [clientFilter, setClientFilter] = useState('all');

    const loading = jobsLoading || vendorsLoading || clientsLoading || extraLoading;

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    const rangeStart = useMemo(() => {
        const now = new Date();
        if (dateRange === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
        if (dateRange === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        if (dateRange === 'year') return new Date(now.getFullYear(), 0, 1);
        return null;
    }, [dateRange]);
    const inRange = (d?: string | null) => !rangeStart || (!!d && new Date(d) >= rangeStart);

    const vendorFilterCanon = vendorFilter === 'all' ? 'all' : (canonOf(vendorFilter) as string);

    // Filter jobs by date range
    const filteredJobs = useMemo(() => {
        let filtered = [...jobsWithVendor];

        if (rangeStart) {
            filtered = filtered.filter(j => new Date(j.order_date) >= rangeStart);
        }

        if (vendorFilterCanon !== 'all') {
            filtered = filtered.filter(j => j.vendor_id === vendorFilterCanon);
        }
        if (clientFilter !== 'all') {
            filtered = filtered.filter(j => j.client_id === clientFilter);
        }

        return filtered;
    }, [jobsWithVendor, rangeStart, vendorFilterCanon, clientFilter]);

    // Summary Stats
    const totalJobs = filteredJobs.length;
    const totalBilling = filteredJobs.reduce((sum, j) => sum + (j.total_amount || 0), 0);
    // Received / Pending used to be summed from jobs.amount_received. That field
    // is zero on all 484 jobs: since 1 September, payment is recorded in Zoho, and
    // the app's own ledger stopped being written on 5 August. Summing it produced
    // "Received ₹0" and a Pending figure equal to the whole billing — a confident
    // number that was simply wrong. It is not shown here any more.
    //
    // The honest replacement is a Zoho-backed figure, and that needs the job ↔
    // invoice link to be filled in first: at the time of writing 8 of 484 jobs are
    // linked, so a Zoho total would cover under 2% of this report. Until Invoice
    // Matching has been worked through, this page reports jobs and billing only.
    const jobsWithNoAmount = filteredJobs.filter(j => !j.total_amount).length;

    // One row per vendor — including vendors with no jobs (a vendor can exist only
    // through bills and payments). Jobs with no vendor go in their own row, so the
    // rows always add up to the Total Jobs card.
    const vendorData = useMemo(() => {
        const rows = vendors
            .filter((v: any) => canon[v.id] === v.id)
            .filter((v: any) => vendorFilterCanon === 'all' || v.id === vendorFilterCanon)
            .map((v: any) => {
                const vJobs = filteredJobs.filter(j => j.vendor_id === v.id);
                const vBills = bills.filter(b => canonOf(b.vendor_id) === v.id && inRange(b.bill_date));
                const vPays = payments.filter(p => canonOf(p.vendor_id) === v.id && inRange(p.payment_date));
                return {
                    key: v.id as string,
                    vendor: v,
                    jobs: vJobs,
                    totalAmount: vJobs.reduce((sum, j) => sum + (j.total_amount || 0), 0),
                    bills: vBills,
                    payments: vPays,
                    billed: vBills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0),
                    paid: vPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
                };
            })
            // With a client chosen, only vendors that did work for that client matter.
            .filter(r => clientFilter === 'all' || r.jobs.length > 0)
            .sort((a, b) =>
                (b.jobs.length - a.jobs.length) ||
                (b.billed - a.billed) ||
                String(a.vendor?.name || '').localeCompare(String(b.vendor?.name || '')));
        return rows;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vendors, canon, filteredJobs, bills, payments, vendorFilterCanon, clientFilter, rangeStart]);

    const unassignedJobs = useMemo(
        () => (vendorFilterCanon === 'all' ? filteredJobs.filter(j => !j.vendor_id) : []),
        [filteredJobs, vendorFilterCanon]
    );

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
            // Two forms wrote two vocabularies for the same three work types, so
            // grouping on the raw word produced six rows for three real types
            // (Design/Design Only, Printing/Print Only, Design + Printing/Design +
            // Print). getProjectTypeLabel is the system's single answer to "what
            // type is this job", and it knows every spelling ever written.
            const type = getProjectTypeLabel(job.job_type);
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

    const vendorNameById = useMemo(() => {
        const m: Record<string, string> = {};
        vendors.forEach((v: any) => { m[v.id] = v.name; });
        return m;
    }, [vendors]);

    // Export CSV
    const handleExport = () => {
        let rows: string[][] = [];
        // No 'Received' column: jobs.amount_received is zero on every row (money
        // lives in Zoho), and an all-zero column in a spreadsheet reads as fact.
        const header = ['Job #', 'Project', 'Client', 'Vendor', 'Job Type', 'Amount', 'Date'];
        rows.push(header);
        filteredJobs.forEach(job => {
            rows.push([
                job.job_number || '',
                job.project_name || '',
                job.client?.name || '',
                vendors.find(v => v.id === job.vendor_id)?.name || '',
                getProjectTypeLabel(job.job_type),
                String(job.total_amount || 0),
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

            {/* Summary Cards — jobs and billing only. See the note on the totals
                above: what has been received is a question only Zoho can answer. */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-md p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Jobs</p>
                    <p className="text-page-title text-gray-900">{totalJobs}</p>
                </div>
                <div className="bg-white rounded-md p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Billing</p>
                    <p className="text-page-title text-gray-900">{formatCurrency(totalBilling)}</p>
                    {jobsWithNoAmount > 0 && (
                        <p className="text-xs text-amber-700 mt-1">
                            {jobsWithNoAmount} of these {totalJobs} jobs carry no amount, so this total is not the period&apos;s billing.
                        </p>
                    )}
                </div>
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <span className="font-semibold">Money is not on this page.</span>{' '}
                What was invoiced and what was received live in Zoho Books, which is the
                book of record. This report answers a different question: which jobs went
                to which vendor for which client. To see what is owed and what was paid,
                open{' '}
                <Link href="/admin/finance/money-in" className="underline font-medium">Money In</Link>
                {' '}or{' '}
                <Link href="/admin/finance/money-out" className="underline font-medium">Money Out</Link>.
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-md border border-gray-100 flex flex-col sm:flex-row gap-3">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
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
                            {vendors.filter((v: any) => canon[v.id] === v.id).map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
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

            {/* Data Tables — every row opens to show the jobs behind its numbers */}
            <div className="bg-white rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                    {/* By Vendor View */}
                    {viewMode === 'vendor' && (
                        <table className="w-full min-w-[700px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Jobs</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Job Billing</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Bills / Payments</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Clients</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendorData.length === 0 && unassignedJobs.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">No vendor data found for the selected filters.</td></tr>
                                ) : (
                                    <>
                                        {vendorData.map(entry => {
                                            const isOpen = open.has('v:' + entry.key);
                                            const uniqueClients = Array.from(new Set(entry.jobs.map(j => j.client?.name).filter(Boolean)));
                                            return (
                                                <VendorRowGroup key={entry.key} isOpen={isOpen} onToggle={() => toggle('v:' + entry.key)}
                                                    colSpan={5}
                                                    summary={
                                                        <>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                                    <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                                                                        <Building2 className="w-4 h-4 text-orange-600" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-gray-900">{entry.vendor?.name || 'Unknown'}</p>
                                                                        <p className="text-xs text-gray-500">{entry.vendor?.category || ''}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`px-2.5 py-1 rounded-md text-sm font-medium ${entry.jobs.length ? 'bg-gray-100' : 'bg-gray-50 text-gray-400'}`}>{entry.jobs.length}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(entry.totalAmount)}</td>
                                                            <td className="px-4 py-3 text-center text-xs text-gray-600">
                                                                {entry.bills.length || entry.payments.length
                                                                    ? <>{entry.bills.length} bill{entry.bills.length === 1 ? '' : 's'} · {entry.payments.length} payment{entry.payments.length === 1 ? '' : 's'}</>
                                                                    : <span className="text-gray-300">—</span>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <ChipList names={uniqueClients as string[]} />
                                                            </td>
                                                        </>
                                                    }
                                                >
                                                    {entry.jobs.length > 0 && (
                                                        <JobList jobs={entry.jobs} showVendor={false} showClient vendorNameById={vendorNameById} formatCurrency={formatCurrency} />
                                                    )}
                                                    {(entry.bills.length > 0 || entry.payments.length > 0) && (
                                                        <MoneyList bills={entry.bills} payments={entry.payments} billed={entry.billed} paid={entry.paid} formatCurrency={formatCurrency} />
                                                    )}
                                                    {entry.jobs.length === 0 && entry.bills.length === 0 && entry.payments.length === 0 && (
                                                        <p className="text-sm text-gray-400 py-2">Nothing recorded for this vendor in the selected period.</p>
                                                    )}
                                                    {entry.jobs.length === 0 && (entry.bills.length > 0 || entry.payments.length > 0) && (
                                                        <p className="text-xs text-gray-500 mt-2">
                                                            No job is linked to this vendor. Printers come from the print run a job is on; paper vendors are only recorded through bills and payments.
                                                        </p>
                                                    )}
                                                </VendorRowGroup>
                                            );
                                        })}
                                        {unassignedJobs.length > 0 && (
                                            <VendorRowGroup isOpen={open.has('v:none')} onToggle={() => toggle('v:none')} colSpan={5}
                                                summary={
                                                    <>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                {open.has('v:none') ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                                <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-gray-700">No vendor assigned</p>
                                                                    <p className="text-xs text-gray-500">Not on any print run, no vendor chosen on the job</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-sm font-medium">{unassignedJobs.length}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                                                            {formatCurrency(unassignedJobs.reduce((sum, j) => sum + (j.total_amount || 0), 0))}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-300">—</td>
                                                        <td className="px-4 py-3">
                                                            <ChipList names={Array.from(new Set(unassignedJobs.map(j => j.client?.name).filter(Boolean))) as string[]} />
                                                        </td>
                                                    </>
                                                }
                                            >
                                                <JobList jobs={unassignedJobs} showVendor={false} showClient vendorNameById={vendorNameById} formatCurrency={formatCurrency} />
                                            </VendorRowGroup>
                                        )}
                                    </>
                                )}
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
                            <tbody>
                                {clientData.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">No client data found for the selected filters.</td></tr>
                                ) : clientData.map((entry, idx) => {
                                    const key = 'c:' + (entry.client?.id || idx);
                                    const isOpen = open.has(key);
                                    const jobTypes = Array.from(new Set(entry.jobs.map(j => getProjectTypeLabel(j.job_type)).filter(Boolean)));
                                    return (
                                        <VendorRowGroup key={key} isOpen={isOpen} onToggle={() => toggle(key)} colSpan={5}
                                            summary={
                                                <>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                            <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
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
                                                </>
                                            }
                                        >
                                            <JobList jobs={entry.jobs} showVendor showClient={false} vendorNameById={vendorNameById} formatCurrency={formatCurrency} />
                                        </VendorRowGroup>
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
                            <tbody>
                                {jobTypeData.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">No job type data found for the selected filters.</td></tr>
                                ) : jobTypeData.map(entry => {
                                    const key = 't:' + entry.type;
                                    const isOpen = open.has(key);
                                    return (
                                        <VendorRowGroup key={key} isOpen={isOpen} onToggle={() => toggle(key)} colSpan={5}
                                            summary={
                                                <>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                            <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
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
                                                </>
                                            }
                                        >
                                            <JobList jobs={entry.jobs} showVendor showClient vendorNameById={vendorNameById} formatCurrency={formatCurrency} />
                                        </VendorRowGroup>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// A summary row that opens (click, Enter or Space) to reveal the detail under it.
function VendorRowGroup({ summary, children, isOpen, onToggle, colSpan }: {
    summary: React.ReactNode; children: React.ReactNode; isOpen: boolean; onToggle: () => void; colSpan: number;
}) {
    return (
        <>
            <tr
                className={`cursor-pointer border-b hover:bg-gray-50 ${isOpen ? 'bg-gray-50' : ''}`}
                onClick={onToggle}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
            >
                {summary}
            </tr>
            {isOpen && (
                <tr className="border-b bg-gray-50/60">
                    <td colSpan={colSpan} className="px-4 pb-4 pt-1">{children}</td>
                </tr>
            )}
        </>
    );
}

function ChipList({ names }: { names: string[] }) {
    return (
        <div className="flex flex-wrap gap-1">
            {names.slice(0, 3).map((name, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{name}</span>
            ))}
            {names.length > 3 && <span className="text-xs text-gray-400">+{names.length - 3} more</span>}
        </div>
    );
}

function JobList({ jobs, showVendor, showClient, vendorNameById, formatCurrency }: {
    jobs: any[]; showVendor: boolean; showClient: boolean; vendorNameById: Record<string, string>; formatCurrency: (n: number) => string;
}) {
    const sorted = [...jobs].sort((a, b) => String(b.order_date || '').localeCompare(String(a.order_date || '')));
    return (
        <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50 border-b">
                    <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left px-3 py-2 font-semibold">Job #</th>
                        <th className="text-left px-3 py-2 font-semibold">Project</th>
                        {showClient && <th className="text-left px-3 py-2 font-semibold">Client</th>}
                        {showVendor && <th className="text-left px-3 py-2 font-semibold">Vendor</th>}
                        <th className="text-left px-3 py-2 font-semibold">Date</th>
                        <th className="text-right px-3 py-2 font-semibold">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {sorted.map(j => (
                        <tr key={j.id} className="hover:bg-blue-50/40">
                            <td className="px-3 py-2 whitespace-nowrap">
                                <Link href={`/admin/jobs/${j.id}`} className="text-blue-700 hover:underline font-medium" onClick={e => e.stopPropagation()}>
                                    {j.job_number || 'Open'}
                                </Link>
                            </td>
                            <td className="px-3 py-2 text-gray-800">{j.project_name || '—'}</td>
                            {showClient && <td className="px-3 py-2 text-gray-600">{j.client?.name || '—'}</td>}
                            {showVendor && <td className="px-3 py-2 text-gray-600">{(j.vendor_id && vendorNameById[j.vendor_id]) || <span className="text-amber-600">None</span>}</td>}
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{j.order_date ? new Date(j.order_date).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{j.total_amount ? formatCurrency(j.total_amount) : <span className="text-gray-300">no amount</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function MoneyList({ bills, payments, billed, paid, formatCurrency }: {
    bills: any[]; payments: any[]; billed: number; paid: number; formatCurrency: (n: number) => string;
}) {
    return (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-white p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Purchase bills · {formatCurrency(billed)}
                </p>
                {bills.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
                    <ul className="text-sm divide-y">
                        {bills.map(b => (
                            <li key={b.id} className="py-1.5 flex justify-between gap-3">
                                <span className="text-gray-700">{b.bill_number || b.vendor_bill_number || 'Bill'}
                                    <span className="text-gray-400"> · {b.bill_date ? new Date(b.bill_date).toLocaleDateString('en-IN') : '—'} · {b.payment_status || ''}</span>
                                </span>
                                <span className="text-gray-900 whitespace-nowrap">{formatCurrency(Number(b.total_amount) || 0)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="rounded-md border bg-white p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Payments made · {formatCurrency(paid)}
                </p>
                {payments.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
                    <ul className="text-sm divide-y">
                        {payments.map(p => (
                            <li key={p.id} className="py-1.5 flex justify-between gap-3">
                                <span className="text-gray-700">{p.payment_number || 'Payment'}
                                    <span className="text-gray-400"> · {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'} · {p.payment_mode || ''}</span>
                                </span>
                                <span className="text-gray-900 whitespace-nowrap">{formatCurrency(Number(p.amount) || 0)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
