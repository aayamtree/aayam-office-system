'use client';

import { useState } from 'react';
import { useJobs } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Palette, Play, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function DesignTasksPage() {
    const { profile } = useAuth();

    // Fetch jobs relevant to design
    // Ideally filtering should be done on server/query level, but for now filtering locally
    const { jobs, loading, updateJobStage, refetch } = useJobs({
        orderBy: { column: 'created_at', ascending: false }
    });

    const [processingId, setProcessingId] = useState<string | null>(null);

    // Filter for design stages
    const designJobs = jobs.filter(job =>
        ['new', 'designing', 'approval'].includes(job.current_stage)
    );

    const handleStageUpdate = async (id: string, newStage: any) => {
        if (!confirm(`Move job to ${newStage}?`)) return;

        setProcessingId(id);
        await updateJobStage(id, newStage);
        setProcessingId(null);
        refetch();
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading tasks...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Design Queue</h1>
                    <p className="text-gray-500">Manage design tasks and approvals</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
                    <span className="font-bold text-indigo-600">{designJobs.length}</span> Pending Tasks
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {designJobs.map(job => (
                    <div key={job.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded">{job.job_number}</span>
                                <h3 className="font-bold text-gray-900 mt-2">{job.project_name}</h3>
                                <p className="text-sm text-gray-500">{job.client?.company}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize
                ${job.current_stage === 'new' ? 'bg-blue-100 text-blue-700' :
                                    job.current_stage === 'designing' ? 'bg-indigo-100 text-indigo-700' :
                                        'bg-purple-100 text-purple-700'}`}>
                                {job.current_stage}
                            </span>
                        </div>

                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-4 line-clamp-3">
                            {job.description || 'No description provided.'}
                        </p>

                        <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                            {job.current_stage === 'new' && (
                                <button
                                    disabled={processingId === job.id}
                                    onClick={() => handleStageUpdate(job.id, 'designing')}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2">
                                    <Play size={16} /> Start Design
                                </button>
                            )}

                            {job.current_stage === 'designing' && (
                                <button
                                    disabled={processingId === job.id}
                                    onClick={() => handleStageUpdate(job.id, 'approval')}
                                    className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 flex items-center justify-center gap-2">
                                    <Clock size={16} /> Send Approval
                                </button>
                            )}

                            {job.current_stage === 'approval' && (
                                <button
                                    disabled={processingId === job.id}
                                    onClick={() => handleStageUpdate(job.id, 'printing')}
                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
                                    <CheckCircle size={16} /> Approved (Print)
                                </button>
                            )}
                        </div>
                        {job.client_deadline && (
                            <div className="mt-3 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle size={12} /> Due: {new Date(job.client_deadline).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                ))}

                {designJobs.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <Palette className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No pending designs</h3>
                        <p className="text-gray-500">Good job! Typically new orders will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
