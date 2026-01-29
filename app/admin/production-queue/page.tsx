'use client';

import { useState, useEffect } from 'react';
import { Palette, Printer, AlertCircle, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Job, ProductionSummary } from '@/types/database';

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
          client:clients(name, company),
          designer:profiles!jobs_designer_id_fkey(full_name),
          product_category:product_categories(name)
        `)
                .eq('status', 'active')
                .order('client_deadline', { ascending: true, nullsFirst: false });

            if (error) throw error;
            setJobs(jobsData || []);
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

    const filteredJobs = getFilteredJobs();

    const getStageBadge = (job: Job) => {
        if (job.print_ready && job.client_approval) {
            return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">Print Ready</span>;
        }
        if (!job.client_approval) {
            return <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-bold">Awaiting Approval</span>;
        }
        switch (job.current_stage) {
            case 'designing':
                return <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-bold">Designing</span>;
            case 'printing':
            case 'finishing':
                return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">In Production</span>;
            default:
                return <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-bold capitalize">{job.current_stage}</span>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <TrendingUp className="text-indigo-600" size={32} />
                                Production Queue
                            </h1>
                            <p className="text-gray-500 mt-1">Live overview of all active jobs • Updates every 30s</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            Live Updates Active
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Summary Cards - Clickable Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Design Stage */}
                    <button
                        onClick={() => setFilter(filter === 'design_stage' ? null : 'design_stage')}
                        className={`bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg text-left ${filter === 'design_stage' ? 'border-purple-400 shadow-lg ring-4 ring-purple-100' : 'border-gray-100 hover:border-purple-200'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Palette className="text-purple-600" size={20} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-purple-600">{summary.design_stage}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">Design Stage</p>
                    </button>

                    {/* Print Ready */}
                    <button
                        onClick={() => setFilter(filter === 'print_ready' ? null : 'print_ready')}
                        className={`bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg text-left relative ${filter === 'print_ready' ? 'border-green-400 shadow-lg ring-4 ring-green-100' : 'border-gray-100 hover:border-green-200'
                            }`}
                    >
                        {summary.print_ready > 0 && (
                            <div className="absolute top-4 right-4 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        )}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle2 className="text-green-600" size={20} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">{summary.print_ready}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">Print Ready</p>
                    </button>

                    {/* Awaiting Approval */}
                    <button
                        onClick={() => setFilter(filter === 'awaiting_approval' ? null : 'awaiting_approval')}
                        className={`bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg text-left ${filter === 'awaiting_approval' ? 'border-amber-400 shadow-lg ring-4 ring-amber-100' : 'border-gray-100 hover:border-amber-200'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Clock className="text-amber-600" size={20} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-amber-600">{summary.awaiting_approval}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">Awaiting Approval</p>
                    </button>

                    {/* High Priority */}
                    <button
                        onClick={() => setFilter(filter === 'high_priority' ? null : 'high_priority')}
                        className={`bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg text-left relative ${filter === 'high_priority' ? 'border-red-400 shadow-lg ring-4 ring-red-100' : 'border-gray-100 hover:border-red-200'
                            }`}
                    >
                        {summary.high_priority > 0 && (
                            <div className="absolute top-4 right-4">
                                <AlertCircle className="text-red-500 animate-pulse" size={20} />
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-red-50 rounded-lg">
                                <AlertCircle className="text-red-600" size={20} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-red-600">{summary.high_priority}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">High Priority</p>
                    </button>

                    {/* In Production */}
                    <button
                        onClick={() => setFilter(filter === 'in_production' ? null : 'in_production')}
                        className={`bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg text-left ${filter === 'in_production' ? 'border-blue-400 shadow-lg ring-4 ring-blue-100' : 'border-gray-100 hover:border-blue-200'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Printer className="text-blue-600" size={20} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-blue-600">{summary.in_production}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">In Production</p>
                    </button>

                    {/* Total Active */}
                    <button
                        onClick={() => setFilter(null)}
                        className={`bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 transition-all hover:shadow-lg text-left ${!filter ? 'border-indigo-400 shadow-lg ring-4 ring-indigo-100' : 'border-indigo-100 hover:border-indigo-200'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white rounded-lg">
                                <TrendingUp className="text-indigo-600" size={20} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-indigo-900">{summary.total_active}</p>
                        <p className="text-sm text-gray-700 font-medium mt-1">Total Active</p>
                    </button>
                </div>

                {/* Active Filter Indicator */}
                {filter && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                            <p className="text-sm font-bold text-blue-900">
                                Filtering by: <span className="capitalize">{filter.replace('_', ' ')}</span>
                            </p>
                            <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-bold">
                                {filteredJobs.length} jobs
                            </span>
                        </div>
                        <button
                            onClick={() => setFilter(null)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold"
                        >
                            Clear Filter
                        </button>
                    </div>
                )}

                {/* Jobs Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900">
                            {filter ? `Filtered Jobs (${filteredJobs.length})` : `All Active Jobs (${jobs.length})`}
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
                                                        className="font-mono text-sm text-indigo-600 hover:text-indigo-800 font-bold"
                                                    >
                                                        {job.job_number}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                    {(job.client as any)?.company || (job.client as any)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{job.project_name}</td>
                                                <td className="px-6 py-4 text-xs text-gray-600">
                                                    {(job.product_category as any)?.name || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {(job.designer as any)?.full_name || 'Unassigned'}
                                                </td>
                                                <td className="px-6 py-4">{getStageBadge(job)}</td>
                                                <td className="px-6 py-4">
                                                    {job.priority === 'high' && (
                                                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                                                            <AlertCircle size={14} />
                                                            HIGH
                                                        </span>
                                                    )}
                                                    {job.priority === 'urgent' && (
                                                        <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold flex items-center gap-1 w-fit animate-pulse">
                                                            <AlertCircle size={14} />
                                                            URGENT
                                                        </span>
                                                    )}
                                                    {job.priority === 'normal' && (
                                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
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
