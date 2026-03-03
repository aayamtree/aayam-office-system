'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Package, Layers } from 'lucide-react';

interface PendingJob {
    id: string;
    job_number: string;
    project_name: string;
    client_id: string;
    client_name: string;
    job_type: string;
    quantity?: number;
    urgency?: 'low' | 'normal' | 'high' | 'urgent';
    due_date?: string;
}

interface PrintJobQueueProps {
    onAddJob: (job: PendingJob) => void;
    selectedJobType: string | null;
    disabledJobIds: Set<string>;
}


export function PrintJobQueue({ onAddJob, selectedJobType, disabledJobIds }: PrintJobQueueProps) {
    const [jobs, setJobs] = useState<PendingJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [jobTypes, setJobTypes] = useState<string[]>(['ALL']);

    useEffect(() => {
        fetchPendingJobs();
        fetchCategories();
    }, []);

    // Fetch job type filters from product_categories (central source)
    const fetchCategories = async () => {
        const { data } = await supabase
            .from('product_categories')
            .select('name')
            .eq('is_active', true)
            .order('name', { ascending: true });
        if (data && data.length > 0) {
            setJobTypes(['ALL', ...data.map((c: any) => c.name.toUpperCase())]);
        }
    };

    const fetchPendingJobs = async () => {
        try {
            const { data, error } = await supabase
                .from('pending_print_jobs')
                .select('*')
                .neq('is_on_hold', true)  // ← exclude on-hold jobs from Print Planner
                .order('created_at', { ascending: true });

            if (error) throw error;
            // Extra client-side safety: also filter out any on_hold that slipped through
            setJobs((data || []).filter((j: any) => !j.is_on_hold));
        } catch (error) {
            console.error('Error fetching pending jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredJobs = jobs.filter(job => {
        const matchesFilter = filter === 'ALL' || (job.job_type || '').toUpperCase() === filter;
        const matchesSearch = job.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getUrgencyColor = (urgency?: string) => {
        switch (urgency) {
            case 'urgent': return 'bg-gray-900 text-white border-gray-900';
            case 'high': return 'bg-gray-700 text-white border-gray-700';
            case 'normal': return 'bg-gray-200 text-gray-700 border-gray-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    const getJobTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            STICKER: 'bg-gray-900 text-white',
            POUCH: 'bg-gray-700 text-white',
            BOX: 'bg-gray-500 text-white',
            BANNER: 'bg-gray-300 text-gray-900',
            FLEX: 'bg-gray-200 text-gray-800',
            VINYL: 'bg-gray-800 text-white',
            LABEL: 'bg-gray-400 text-white',
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    };

    const isJobDisabled = (job: PendingJob) => {
        if (disabledJobIds.has(job.id)) return true;
        if (selectedJobType && job.job_type !== selectedJobType) return true;
        return false;
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-md border border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                        <Package className="text-gray-700" size={20} />
                    </div>
                    <div>
                        <h2 className="text-page-title text-gray-900">Pending Print Jobs</h2>
                        <p className="text-sm text-gray-500">Ready for print assignment</p>
                    </div>
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder="Search jobs or clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all outline-none"
                />
            </div>

            {/* Job Type Filters — sourced from product_categories */}
            <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex gap-2 flex-wrap">
                    {jobTypes.map((type: string) => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`px-4 py-2 rounded-md text-xs font-medium border whitespace-nowrap transition-all ${filter === type
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No pending jobs</p>
                        <p className="text-sm text-gray-400">All jobs are assigned or none match filter</p>
                    </div>
                ) : (
                    filteredJobs.map(job => {
                        const disabled = isJobDisabled(job);
                        return (
                            <div
                                key={job.id}
                                className={`p-4 rounded-md border transition-all ${disabled
                                    ? 'bg-gray-50 border-gray-200 opacity-50'
                                    : 'bg-white border-gray-200 hover:border-gray-400'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-mono text-sm font-bold text-gray-900">
                                                {job.job_number}
                                            </span>
                                            {job.job_type && (
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${getJobTypeColor(job.job_type)}`}>
                                                    {job.job_type}
                                                </span>
                                            )}
                                            {job.urgency && (
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${getUrgencyColor(job.urgency)}`}>
                                                    {job.urgency.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 mb-1">{job.project_name}</p>
                                        <p className="text-xs text-gray-500">
                                            {job.client_name}
                                            {job.quantity && ` • ${job.quantity.toLocaleString()} qty`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onAddJob(job)}
                                        disabled={disabled}
                                        className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${disabled
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-900 text-white hover:bg-gray-800'
                                            }`}
                                        title={disabled && selectedJobType ? `Only ${selectedJobType} jobs can be added` : ''}
                                    >
                                        {disabledJobIds.has(job.id) ? 'Added' : 'Add'}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Job Type Lock Warning */}
            {selectedJobType && (
                <div className="p-4 border-t border-gray-200 bg-gray-100">
                    <div className="flex items-center gap-2 text-sm">
                        <Layers size={16} className="text-gray-700" />
                        <span className="font-medium text-gray-900">
                            Locked to: <span className="font-bold">{selectedJobType}</span> jobs only
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
