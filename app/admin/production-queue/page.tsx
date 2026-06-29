'use client';

import { useState, useEffect } from 'react';
import { Palette, Printer, AlertCircle, Clock, CheckCircle2, TrendingUp, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Job, ProductionSummary } from '@/types/database';
import { ShareToChat } from '@/components/ShareToChat';
import DesignBillingBadge from '@/components/jobs/DesignBillingBadge';

export default function ProductionQueuePage() {

    const [jobs, setJobs] = useState<Job[]>([]);
    const [summary, setSummary] = useState<ProductionSummary>({
        design_stage: 0,
        print_ready: 0,
        awaiting_approval: 0,
        high_priority: 0,
        in_production: 0,
        total_active: 0
    });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [categories, setCategories] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
        // Poll every 30 seconds for live updates
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            // Fetch production summary from database
            const { data: summaryData } = await supabase
                .rpc('get_production_summary');

            if (summaryData) {
                setSummary(summaryData);
            }

            // Fetch all active jobs
            const { data: jobsData, error } = await supabase
                .from('jobs')
                .select(`
          *,
          client:clients(name, company)
        `)
                .eq('status', 'active')
                .order('client_deadline', { ascending: true, nullsFirst: false });

            if (error) throw error;
            setJobs(jobsData || []);

            // Extract unique product categories from jobs
            const cats = Array.from(new Set(
                (jobsData || []).map((j: any) => j.product_category).filter(Boolean)
            )) as string[];
            setCategories(cats.sort());
        } catch (error) {
            console.error('Error fetching production data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter jobs based on clicked card
    const getFilteredJobs = () => {
        if (!filter) return jobs;

        switch (filter) {
            case 'design_stage':
                return jobs.filter(j => j.current_stage === 'designing');
            case 'print_ready':
                return jobs.filter(j => j.print_ready && j.client_approval);
            case 'awaiting_approval':
                return jobs.filter(j => !j.client_approval && (j.current_stage === 'approval' || j.current_stage === 'designing'));
            case 'high_priority':
                return jobs.filter(j => j.priority === 'high' || j.priority === 'urgent');
            case 'in_production':
                return jobs.filter(j => j.current_stage === 'printing' || j.current_stage === 'finishing');
            default:
                return jobs;
        }
    };

    const filteredJobs = getFilteredJobs().filter(job => {
        if (categoryFilter === 'all') return true;
        return job.product_category === categoryFilter;
    });

    const getStageBadge = (job: Job) => {
        if (job.print_ready && job.client_approval) {
            return <span className="px-3 py-1 bg-gray-100 text-gray-900 text-xs rounded-md font-bold">Print Ready</span>;
        }
        if (!job.client_approval) {
            return <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded-md font-bold">Awaiting Approval</span>;
        }
        switch (job.current_stage) {
            case 'designing':
                return <span className="px-3 py-1 bg-gray-900 text-white text-xs rounded-md font-bold">Designing</span>;
            case 'printing':
            case 'finishing':
                return <span className="px-3 py-1 bg-muted text-foreground text-xs rounded-md font-bold">In Production</span>;
            default:
                return <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-bold capitalize">{job.current_stage}</span>;
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900 flex items-center gap-3">
                        <TrendingUp className="text-primary" size={28} />
                        Production Queue
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Live overview of all active jobs • Updates every 30s</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    Live Updates Active
                </div>
            </div>

            <div className="space-y-6">
                {/* Summary Cards - Clickable Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
                    {/* Design Stage */}
                    <button
                        onClick={() => setFilter(filter === 'design_stage' ? null : 'design_stage')}
                        className={`bg-white rounded-md md:rounded-md p-3 md:p-4 border-2 transition-all  text-left ${filter === 'design_stage' ? 'border-purple-400 ring-4 ring-primary' : 'border-gray-100 hover:border-border'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-muted rounded-md">
                                <Palette className="text-primary" size={20} />
                            </div>
                        </div>
                        <p className="text-page-title text-primary">{summary.design_stage}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">Design Stage</p>
                    </button>

                    {/* Print Ready */}
                    <button
                        onClick={() => setFilter(filter === 'print_ready' ? null : 'print_ready')}
                        className={`bg-white rounded-md md:rounded-md p-3 md:p-4 border-2 transition-all  text-left relative ${filter === 'print_ready' ? 'border-green-400 ring-4 ring-green-100' : 'border-gray-100 hover:border-green-200'
                            }`}
                    >
                        {summary.print_ready > 0 && (
                            <div className="absolute top-4 right-4 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        )}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-green-50 rounded-md">
                                <CheckCircle2 className="text-gray-900" size={20} />
                            </div>
                        </div>
                        <p className="text-page-title text-gray-900">{summary.print_ready}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">Print Ready</p>
                    </button>

                    {/* Awaiting Approval */}
                    <button
                        onClick={() => setFilter(filter === 'awaiting_approval' ? null : 'awaiting_approval')}
                        className={`bg-white rounded-md md:rounded-md p-3 md:p-4 border-2 transition-all  text-left ${filter === 'awaiting_approval' ? 'border-gray-400 ring-4 ring-amber-100' : 'border-gray-100 hover:border-gray-200'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-50 rounded-md">
                                <Clock className="text-destructive" size={20} />
                            </div>
                        </div>
                        <p className="text-page-title text-destructive">{summary.awaiting_approval}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">Awaiting Approval</p>
                    </button>

                    {/* High Priority */}
                    <button
                        onClick={() => setFilter(filter === 'high_priority' ? null : 'high_priority')}
                        className={`bg-white rounded-md md:rounded-md p-3 md:p-4 border-2 transition-all  text-left relative ${filter === 'high_priority' ? 'border-red-400 ring-4 ring-red-100' : 'border-gray-100 hover:border-red-200'
                            }`}
                    >
                        {summary.high_priority > 0 && (
                            <div className="absolute top-4 right-4">
                                <AlertCircle className="text-red-500 animate-pulse" size={20} />
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-red-50 rounded-md">
                                <AlertCircle className="text-red-600" size={20} />
                            </div>
                        </div>
                        <p className="text-page-title text-red-600">{summary.high_priority}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">High Priority</p>
                    </button>

                    {/* In Production */}
                    <button
                        onClick={() => setFilter(filter === 'in_production' ? null : 'in_production')}
                        className={`bg-white rounded-md md:rounded-md p-3 md:p-4 border-2 transition-all  text-left ${filter === 'in_production' ? 'border-gray-400 ring-4 ring-gray-100' : 'border-gray-100 hover:border-border'}
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-muted rounded-md">
                                <Printer className="text-foreground" size={20} />
                            </div>
                        </div>
                        <p className="text-page-title text-foreground">{summary.in_production}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">In Production</p>
                    </button>

                    {/* Total Active */}
                    <button
                        onClick={() => setFilter(null)}
                        className={`bg-gray-900 rounded-md md:rounded-md p-3 md:p-4 border-2 transition-all  text-left ${!filter ? 'border-primary-400 ring-4 ring-primary' : 'border-gray-200 hover:border-border'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white/20 rounded-md">
                                <TrendingUp className="text-white" size={20} />
                            </div>
                        </div>
                        <p className="text-page-title text-white">{summary.total_active}</p>
                        <p className="text-sm text-gray-300 font-medium mt-1">Total Active</p>
                    </button>
                </div>

                {/* Active Filter Indicator */}
                {filter && (
                    <div className="bg-muted border-2 border-border rounded-md p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-gray-900 rounded-full animate-pulse"></div>
                            <p className="text-sm font-bold text-foreground">
                                Filtering by: <span className="capitalize">{filter.replace('_', ' ')}</span>
                            </p>
                            <span className="px-3 py-1 bg-muted text-gray-800 rounded-md text-xs font-bold">
                                {filteredJobs.length} jobs
                            </span>
                        </div>
                        <button
                            onClick={() => setFilter(null)}
                            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-900 transition-all text-sm font-bold"
                        >
                            Clear Filter
                        </button>
                    </div>
                )}

                {/* Product Category Tabs */}
                <div className="bg-white rounded-md border border-gray-100 p-3">
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap mr-1">
                            <Package size={14} className="inline mr-1" />Type:
                        </span>
                        <button
                            onClick={() => setCategoryFilter('all')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${categoryFilter === 'all'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            All Types
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${categoryFilter === cat
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Jobs Table */}
                <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-section text-gray-900">
                            {filter ? `Filtered Jobs (${filteredJobs.length})` : `All Active Jobs (${jobs.length})`}
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredJobs.length === 0 ? (
                        <div className="p-12 text-center">
                            <TrendingUp className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No jobs found</p>
                            <p className="text-sm text-gray-400 mt-1">
                                {filter ? 'Try clearing the filter' : 'All jobs are completed'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Job #</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Client</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Project</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Category</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Designer</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Stage</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Priority</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Deadline</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Share</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredJobs.map((job) => {
                                        const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
                                        return (
                                            <tr
                                                key={job.id}
                                                className={`hover:bg-gray-50 transition-colors ${job.priority === 'high' ? 'bg-red-50/30' : ''
                                                    }`}
                                            >
                                                <td className="px-6 py-4">
                                                    <Link
                                                        href={`/admin/jobs/${job.id}`}
                                                        className="font-mono text-sm text-primary hover:text-primary font-bold"
                                                    >
                                                        {job.job_number}
                                                    </Link>
                                                    {job.job_type !== 'Print Only' && (
                                                        <div className="mt-1">
                                                            <DesignBillingBadge jobId={job.id} value={job.design_billing} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                    {(job.client as any)?.company || (job.client as any)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{job.project_name}</td>
                                                <td className="px-6 py-4 text-xs text-gray-600">
                                                    {job.product_category || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {(job.designer as any)?.full_name || 'Unassigned'}
                                                </td>
                                                <td className="px-6 py-4">{getStageBadge(job)}</td>
                                                <td className="px-6 py-4">
                                                    {job.priority === 'high' && (
                                                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-xs font-bold flex items-center gap-1 w-fit">
                                                            <AlertCircle size={14} />
                                                            HIGH
                                                        </span>
                                                    )}
                                                    {job.priority === 'urgent' && (
                                                        <span className="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-bold flex items-center gap-1 w-fit animate-pulse">
                                                            <AlertCircle size={14} />
                                                            URGENT
                                                        </span>
                                                    )}
                                                    {job.priority === 'normal' && (
                                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">
                                                            Normal
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {job.client_deadline ? (
                                                        <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-900'}>
                                                            {new Date(job.client_deadline).toLocaleDateString()}
                                                            {isOverdue && (
                                                                <span className="ml-2 text-xs">(OVERDUE)</span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">No deadline</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <ShareToChat
                                                        jobId={job.id}
                                                        jobNumber={job.job_number}
                                                        projectName={job.project_name}
                                                        clientName={(job.client as any)?.company || (job.client as any)?.name}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
