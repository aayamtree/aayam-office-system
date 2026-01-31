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

const JOB_TYPES = ['ALL', 'STICKER', 'POUCH', 'BOX', 'BANNER', 'FLEX', 'VINYL', 'LABEL'];

export function PrintJobQueue({ onAddJob, selectedJobType, disabledJobIds }: PrintJobQueueProps) {
    const [jobs, setJobs] = useState<PendingJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPendingJobs();
    }, []);

    const fetchPendingJobs = async () => {
        try {
            const { data, error } = await supabase
                .from('pending_print_jobs')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            setJobs(data || []);
        } catch (error) {
            console.error('Error fetching pending jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredJobs = jobs.filter(job => {
        const matchesFilter = filter === 'ALL' || job.job_type === filter;
        const matchesSearch = job.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getUrgencyColor = (urgency?: string) => {
        switch (urgency) {
            case 'urgent': return 'bg-red-100 text-red-700 border-red-300';
            case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
            case 'normal': return 'bg-blue-100 text-blue-700 border-blue-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    const getJobTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            STICKER: 'bg-[rgba(0,0,255,0.1)] text-oms-blue',
            POUCH: 'bg-green-100 text-green-700',
            BOX: 'bg-amber-100 text-amber-700',
            BANNER: 'bg-blue-100 text-blue-700',
            FLEX: 'bg-pink-100 text-pink-700',
            VINYL: 'bg-[rgba(0,0,255,0.1)] text-oms-blue',
            LABEL: 'bg-cyan-100 text-cyan-700',
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    };

    const isJobDisabled = (job: PendingJob) => {
        if (disabledJobIds.has(job.id)) return true;
        if (selectedJobType && job.job_type !== selectedJobType) return true;
        return false;
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-[rgba(0,0,255,0.1)] rounded-xl flex items-center justify-center">
                        <Package className="text-oms-blue" size={20} />
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
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all"
                />
            </div>

            {/* Job Type Filters */}
            <div className="px-4 py-3 border-b border-gray-100 overflow-x-auto">
                <div className="flex gap-2 flex-nowrap">
                    {JOB_TYPES.map(type => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold border-2 whitespace-nowrap transition-all flex-shrink-0 ${filter === type
                                ? 'bg-[rgba(0,0,255,0.1)] text-white border-[rgba(0,0,255,0.2)]-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-oms-blue-300'
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
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(0,0,255,0.2)]-600"></div>
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
                                className={`p-4 rounded-xl border-2 transition-all ${disabled
                                    ? 'bg-gray-50 border-gray-200 opacity-50'
                                    : 'bg-white border-gray-200 hover:border-oms-blue-300 '
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-mono text-sm font-bold text-oms-blue">
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
                                            👤 {job.client_name}
                                            {job.quantity && ` • ${job.quantity.toLocaleString()} qty`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onAddJob(job)}
                                        disabled={disabled}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${disabled
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-[rgba(0,0,255,0.1)] text-white hover:bg-[rgba(0,0,255,0.1)]'
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
                <div className="p-4 border-t border-gray-200 bg-[rgba(0,0,255,0.1)]">
                    <div className="flex items-center gap-2 text-sm">
                        <Layers size={16} className="text-oms-blue" />
                        <span className="font-medium text-purple-900">
                            Locked to: <span className="font-bold">{selectedJobType}</span> jobs only
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
