'use client';

import { useState } from 'react';
import { useJobs } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Palette, Play, CheckCircle, Clock, AlertCircle, CheckSquare } from 'lucide-react';
import ChecklistModal from '@/components/design/ChecklistModal';
import { useJobChecklists } from '@/lib/hooks';
import { useConfirm } from '@/components/ConfirmModal';

export default function DesignTasksPage() {
    const { profile } = useAuth();
    // The task card shows the brief (description) and checklist completion; neither
    // is in the default select, so both rendered as empty.
    const { jobs, loading, updateJobStage, refetch } = useJobs({
        select: 'id, job_number, project_name, client_id, designer_id, priority, current_stage, job_type, product_category, parent_job_id, client_deadline, description, checklist_progress, files, total_amount, amount_received, payment_status, client:clients(id, name, company)',
        filter: [{ column: 'current_stage', value: ['new', 'designing', 'approval'], op: 'in' }],
        orderBy: { column: 'created_at', ascending: false },
        limit: 500,
    });

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [checklistJob, setChecklistJob] = useState<any>(null);
    const confirm = useConfirm();

    // Fetch checklists for progress calculation
    const { checklists } = useJobChecklists();

    const designJobs = jobs.filter(job =>
        ['new', 'designing', 'approval'].includes(job.current_stage)
    );

    const handleStageUpdate = async (id: string, newStage: any) => {
        const { confirmed } = await confirm({ title: 'Move Job', message: `Move job to ${newStage}?`, confirmLabel: 'Move' });
        if (!confirmed) return;

        setProcessingId(id);
        await updateJobStage(id, newStage);
        setProcessingId(null);
        refetch();
    };

    function getChecklistProgress(job: any) {
        if (!checklists || !job.checklist_progress) return null;
        const productCat = job.product_category || '';
        const template =
            checklists.find(c => productCat && c.job_type?.toLowerCase() === productCat.toLowerCase()) ||
            checklists.find(c => c.job_type?.toLowerCase() === (job.job_type || '').toLowerCase()) ||
            checklists[0];

        if (!template || !template.items?.length) return null;

        const total = template.items.length;
        // items can be strings (legacy) or objects { label, type, required }
        const completed = template.items.filter((i: any) => {
            const key = typeof i === 'string' ? i : i.label;
            return !!job.checklist_progress[key];
        }).length;

        return { completed, total, percentage: (completed / total) * 100 };
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Loading tasks...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-page-title text-gray-900">Design Queue</h1>
                    <p className="text-gray-500">Manage design tasks and approvals</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-md border">
                    <span className="font-bold text-primary">{designJobs.length}</span> Pending Tasks
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 p-4">
                {designJobs.map(job => (
                    <div key={job.id} className="bg-white rounded-md border border-gray-200  transition-shadow p-5 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded">{job.job_number}</span>
                                <h3 className="font-bold text-gray-900 mt-2">{job.project_name}</h3>
                                <p className="text-sm text-gray-500">{job.client?.company}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-bold rounded-md capitalize
                ${job.current_stage === 'new' ? 'bg-muted text-foreground' :
                                    job.current_stage === 'designing' ? 'bg-gray-900 text-white' :
                                        'bg-gray-900 text-white'}`}>
                                {job.current_stage}
                            </span>
                        </div>

                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md mb-4 line-clamp-3">
                            {job.description || 'No description provided.'}
                        </p>

                        {/* Checklist Progress Indicator */}
                        {(() => {
                            const progress = getChecklistProgress(job);
                            if (progress) {
                                return (
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span className="flex items-center gap-1 font-medium text-gray-700">
                                                <CheckSquare size={12} /> QC Checklist
                                            </span>
                                            <span>{progress.completed}/{progress.total}</span>
                                        </div>
                                        <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full ${progress.percentage === 100 ? 'bg-white0' : 'bg-primary'}`}
                                                style={{ width: `${progress.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                            {job.current_stage === 'new' && (
                                <button
                                    disabled={processingId === job.id}
                                    onClick={() => handleStageUpdate(job.id, 'designing')}
                                    className="flex-1 bg-gray-900 text-white py-2 rounded-md text-sm font-semibold hover:bg-gray-900 flex items-center justify-center gap-2">
                                    <Play size={16} /> Start Design
                                </button>
                            )}

                            {job.current_stage === 'designing' && (
                                <>
                                    <button
                                        onClick={() => setChecklistJob(job)}
                                        className="bg-white border border-gray-200 text-gray-700 p-2 rounded-md hover:bg-gray-50 transition-colors"
                                        title="Quality Checklist"
                                    >
                                        <CheckSquare size={16} />
                                    </button>
                                    <button
                                        disabled={processingId === job.id}
                                        onClick={() => handleStageUpdate(job.id, 'approval')}
                                        className="flex-1 bg-gray-900 text-white py-2 rounded-md text-sm font-semibold hover:bg-gray-900 flex items-center justify-center gap-2">
                                        <Clock size={16} /> Send Approval
                                    </button>
                                </>
                            )}

                            {job.current_stage === 'approval' && (
                                <button
                                    disabled={processingId === job.id}
                                    onClick={() => handleStageUpdate(job.id, 'printing')}
                                    className="flex-1 bg-gray-900 text-white py-2 rounded-md text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
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
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-md border-2 border-dashed border-gray-200">
                        <Palette className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No pending designs</h3>
                        <p className="text-gray-500">Good job! Typically new orders will appear here.</p>
                    </div>
                )}
            </div>

            {checklistJob && (
                <ChecklistModal
                    job={checklistJob}
                    onClose={() => setChecklistJob(null)}
                    onSave={() => {
                        refetch(); // Refresh to update progress bar
                    }}
                />
            )}
        </div>
    );
}
